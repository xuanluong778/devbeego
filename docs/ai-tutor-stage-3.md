# Báo cáo Giai đoạn 3: Kết nối Realtime GA và kiểm soát phiên từ server (AI Tutor Stage 3)

**Dự án**: Beego AI Tutor (`Learn Call` & `Luyện nói`)  
**Mục tiêu**: Bổ sung tầng vận chuyển (transport) hội thoại giọng nói hai chiều trực tiếp (speech-to-speech) qua WebRTC dựa trên API chính thức General Availability (GA) của OpenAI Realtime Calls API, hoạt động độc lập dưới cờ tính năng (`feature flag`), giữ trọn vẹn và tương thích 100% với pipeline hiện tại (WebSocket + BullMQ + Azure STT/TTS).

---

## 1. Kiến trúc luồng Realtime GA thống nhất (Unified Calls Flow)

Theo tài liệu chính thức của OpenAI Realtime API GA:
- **Loại bỏ hoàn toàn model preview**: Xóa bỏ `gpt-4o-realtime-preview-2024-10-01` (đã shutdown) và các snapshot preview khỏi danh sách cho phép.
- **Danh sách model GA duy nhất**:
  - `gpt-realtime`: Model General Availability (GA) alias chính thức (mặc định hệ thống).
  - `gpt-realtime-2.1`, `gpt-realtime-2.1-mini`: Các model Realtime thế hệ mới.
- **Luồng khởi tạo cuộc gọi duy nhất qua Backend**:
  Thay vì chia 2 bước (lấy ephemeral token rồi client tự gọi OpenAI), hệ thống triển khai luồng GA chuẩn qua endpoint cuộc gọi:
  ```http
  POST https://api.openai.com/v1/realtime/calls
  Authorization: Bearer <OPENAI_API_KEY>
  Content-Type: multipart/form-data
  ```
  - **Part `sdp`**: File blob `application/sdp` chứa SDP offer của trình duyệt.
  - **Part `session`**: File blob `application/json` chứa cấu hình phiên GA (`type: "realtime"`, `model: "gpt-realtime"`, `voice`, `instructions`, `server_vad`).
  - **Phản hồi từ OpenAI**: Mã `201 Created` kèm header:
    ```http
    Location: /v1/realtime/calls/{call_id}
    Content-Type: application/sdp
    ```
  - Backend trích xuất trực tiếp `call_id` từ `Location` header, lưu vào Redis `voice:realtime-session:${sessionId}`, đồng thời trả `sdpAnswer` về cho client thiết lập WebRTC. Máy chủ nắm giữ `call_id` ngay từ giây đầu tiên để sẵn sàng thực hiện lệnh ngắt kết nối (hangup).

---

## 2. Phân định rõ 3 loại ID & Endpoint Hangup chính thức

Hệ thống phân định rạch ròi 3 tầng định danh:
1. **Beego `sessionId` (UUID)**: Định danh phiên học nội bộ của Beego (VD: `c7b2a001-...`), quản lý quyền truy cập JWT, gói cước Pro/VIP, và khóa Redis (`voice:realtime-session:${sessionId}`).
2. **OpenAI Session ID (`sess_...`)**: Định danh cấu hình phiên (Session Configuration ID) trả về từ `POST /v1/realtime/sessions` (nếu dùng ephemeral token).
3. **Provider `callId` (`call_...`)**: Định danh cuộc gọi media WebRTC thực tế (Active WebRTC Call ID), được trả về trong header `Location: /v1/realtime/calls/{call_id}` khi gọi `POST /v1/realtime/calls`.

### Endpoint Hangup chính thức của OpenAI:
```http
POST https://api.openai.com/v1/realtime/calls/{call_id}/hangup
Authorization: Bearer <OPENAI_API_KEY>
Content-Type: application/json
```
- Server truyền đúng `call_id` của cuộc gọi (không truyền nhầm Beego `sessionId` hay OpenAI `sess_...`).
- *Tài liệu tham chiếu chính thức*: [OpenAI Realtime Calls API Reference](https://platform.openai.com/docs/api-reference/realtime/calls).

---

## 3. Cơ chế Phân biệt: Deadline Watchdog vs. Liveness Disconnect Watchdog

Hệ thống phân tách rạch ròi 2 cơ chế giám sát tại server:

### 3.1. Giám sát Hạn mức (Deadline Watchdog)
- Áp dụng khi cuộc gọi đạt mức thời lượng tối đa cho phép (ví dụ: hết 2 phút bài học, hoặc cạn hạn mức gói ngày trong Redis).
- Khi `now >= deadlineAt`, Watchdog chủ động ngắt cuộc gọi ngay cả khi học viên vẫn đang kết nối.

### 3.2. Giám sát Mất kết nối (Liveness Disconnect Watchdog)
- Xử lý tình huống học viên **tắt tab, mất mạng 4G/WiFi, hoặc crash ứng dụng** mà không kịp gửi lệnh `DELETE`:
- Client duy trì gửi heartbeat định kỳ mỗi 8 giây đến `POST /api/learn/ai-call/realtime/heartbeat`.
- Redis lưu vết thời điểm liveness gần nhất: `voice:realtime-liveness:${sessionId}`.
- Nếu sau `REALTIME_LIVENESS_TIMEOUT_MS = 20_000` (20 giây) mà server không nhận được heartbeat:
  - Watchdog nhận diện học viên đã mất kết nối / bỏ phiên **trước khi hết deadline**.
  - Server chủ động thực hiện hangup ngay lập tức, không để cuộc gọi bị tính tiền vô ích đến hết 2 phút.

---

## 4. Cơ chế Hangup An toàn: Retry & Chống bỏ rơi cuộc gọi mồ côi

- **Vấn đề trước đây**: Nếu OpenAI trả về lỗi mạng hoặc 500 khi gọi hangup, việc xóa record trong Redis sẽ khiến cuộc gọi biến thành mồ côi (vẫn chạy trên OpenAI và tiếp tục phát sinh cước).
- **Cơ chế Retry mới**:
  - Khi `hangupRealtimeCall` thất bại:
    - **TUYỆT ĐỐI KHÔNG XÓA** record cuộc gọi khỏi `REALTIME_ACTIVE_CALLS_SET`.
    - Tăng số lần thử: `hangupAttempts = attempts + 1`.
    - Đặt trạng thái `status: "hangup_pending"`, ghi nhận lỗi `lastHangupError`.
    - Lùi thời gian quét retry với cơ chế backoff (5 giây).
  - Nếu OpenAI trả về `404 Not Found` hoặc `410 Gone`: Coi như cuộc gọi đã được đóng từ trước trên nhà cung cấp → Tiến hành quyết toán và giải phóng an toàn.
  - Sau khi vượt quá `REALTIME_MAX_HANGUP_RETRIES = 3`, bản ghi được đẩy vào Dead-letter queue (`voice:realtime-dead-letter`) để đội ngũ kỹ thuật đối soát, tránh loop vô tận.

---

## 5. Rà soát Interruption theo WebRTC: Bỏ Truncate thủ công trên MediaStream

- **Loại bỏ hoàn toàn truncate theo `audio.currentTime`**:
  - Với WebRTC `MediaStream`, thuộc tính `audio.currentTime` phản ánh tổng thời gian track phát thanh đang chạy từ lúc mở kết nối, **không phải thời lượng đã nghe của từng câu nói riêng biệt**.
  - Với `turn_detection: { type: "server_vad" }`, máy chủ OpenAI **tự động cắt đứt luồng phát âm thanh và quản lý ngữ cảnh** ngay khi nhận thấy người dùng nói chèn ngang.
- **Hành vi chuẩn hóa trên client**:
  - Khi nhận `input_audio_buffer.speech_started`, client chỉ thực hiện ngắt tiếng cục bộ: `audioEl.pause()`.
  - Không gửi lệnh `conversation.item.truncate` với giá trị `currentTime` sai lệch.
  - Không gửi lệnh `response.cancel` trùng lặp với Server VAD.

---

## 6. Kết quả kiểm thử & Phân định trạng thái

### 6.1. Bảng phân định trạng thái kiểm thử
| Hạng mục | Trạng thái | Ghi chú |
|---|---|---|
| **MOCK CONTRACT TESTS** | **PASS (5/5)** | 100% tuân thủ request/response chuẩn của OpenAI GA Calls API (`POST /v1/realtime/calls` & `Location`) |
| **LIVE API TESTS** | **NOT RUN** | Cờ `LEARN_AI_CALL_REALTIME_ENABLED=0` được giữ tắt; không gọi API tính phí khi chưa có phép |
| **REGRESSION SUITE** | **PASS (100%)** | Toàn bộ 9 bộ test hồi quy của Stage 1, Stage 2 và legacy stack đạt 100% |

### 6.2. Chi tiết kết quả kiểm thử GA (`node scripts/test-learn-call-stage3-realtime.mjs`)
1. `Test 1: Strict GA models only`: `[PASS]` (Chỉ chấp nhận `gpt-realtime`, loại bỏ toàn bộ model preview).
2. `Test 2: Unified POST /v1/realtime/calls`: `[PASS]` (Gửi multipart `sdp` + `session`, trích xuất `callId` từ `Location`).
3. `Test 3: Hangup failure retry safety`: `[PASS]` (Lỗi hangup 500 giữ nguyên active-call record, retry thành công mới unregister).
4. `Test 4: Dual Watchdog (Deadline vs Liveness)`: `[PASS]` (Hết deadline hoặc mất heartbeat 20s đều kích hoạt hangup).
5. `Test 5: Server VAD interruption`: `[PASS]` (Quản lý barge-in tự nhiên, không truncate bừa bãi).

---

## 7. Diff các đoạn mã nguồn then chốt

### 7.1. Unified Call Creation & Location Extraction ([lib/beego/learn/learn-call-realtime.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/learn-call-realtime.js#L143-L177))
```javascript
const formData = new FormData();
formData.append("sdp", new Blob([sdpOffer], { type: "application/sdp" }));
formData.append("session", new Blob([JSON.stringify(sessionConfig)], { type: "application/json" }));

const res = await fetchFn("https://api.openai.com/v1/realtime/calls", {
  method: "POST",
  headers: { Authorization: `Bearer ${apiKey}` },
  body: formData,
});

// Extract call_id from official Location header (/v1/realtime/calls/{call_id})
let callId = "";
const location = res.headers?.get?.("location") || "";
const match = location.match(/\/calls\/([^/?#]+)/);
if (match) {
  callId = match[1];
} else {
  callId = res.headers?.get?.("x-call-id") || "";
}
```

### 7.2. Hangup Retry Safety & No Orphan Calls ([lib/beego/learn/learn-call-realtime.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/learn-call-realtime.js#L360-L382))
```javascript
const hangupRes = await hangupRealtimeCall({ apiKey, callId, fetchFn });
if (!hangupRes.ok) {
  const attempts = (sessionData.hangupAttempts || 0) + 1;
  sessionData.hangupAttempts = attempts;
  sessionData.lastHangupError = hangupRes.message;

  if (attempts < REALTIME_MAX_HANGUP_RETRIES) {
    // Keep in active set with short backoff for next tick
    await redis.set(realtimeSessionKey(sid), JSON.stringify(sessionData), "KEEPTTL");
    retriedCount += 1;
    continue; // DO NOT unregister! Retries on next tick.
  }
}
```

### 7.3. Client Interruption mà không Truncate MediaStream ([hooks/useRealtimeTutor.js](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/hooks/useRealtimeTutor.js#L104-L115))
```javascript
case "user_speech_started":
  // Interruption: Pause local playback immediately.
  // Server VAD natively cuts off speech generation on provider.
  // We do NOT send artificial truncate based on MediaStream currentTime.
  if (audioElRef.current && !audioElRef.current.paused) {
    audioElRef.current.pause();
  }
  updateStatus("listening");
  break;
```
