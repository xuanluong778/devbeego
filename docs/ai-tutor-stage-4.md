# Báo Cáo Kỹ Thuật Giai Đoạn 4: Trải Nghiệm Nói Tự Nhiên & Đối Chiếu Build Baseline Thực Nghiệm

**Dự án**: Beego AI Tutor (`dev.beego.vn`)  
**Thư mục làm việc trên VPS**: `/var/www/dev_beego_vn_usr/data/www/dev.beego.vn`  
**Ngày thực hiện**: 01/11/2026  
**Trạng thái cấu hình**: `LEARN_AI_CALL_REALTIME_ENABLED=0` (Bảo lưu tắt mặc định, chưa deploy, chưa gọi API tính phí)  
**File patch giai đoạn 3–4**: [`docs/ai-tutor-stage-3-4.patch`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/ai-tutor-stage-3-4.patch) (~175 KB)  
**Log build Baseline cô lập**: [`docs/build-baseline.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-baseline.log)  
**Log build Current cô lập**: [`docs/build-current.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-current.log)

---

## I. ĐỐI CHIẾU BUILD BẰNG HAI THƯ MỤC CÔ LẬP THỰC NGHIỆM

Để giải quyết dứt điểm nghi vấn build mà không phỏng đoán, hệ thống đã thiết lập 2 môi trường build hoàn toàn độc lập trong thư mục `/tmp/` để đối chiếu trực tiếp:

### 1. Phương Pháp Thiết Lập Thực Nghiệm
- **Thư mục 1 (Baseline trước Giai đoạn 3–4)**: `/tmp/beego-build-baseline`
  - Khôi phục nguyên trạng toàn bộ các file trước Giai đoạn 3–4 từ `git HEAD`: không có `realtime/` API, không có `useRealtimeTutor.js`, không có `learn-call-realtime.js`, không có adapter WebRTC trong `LearnCallRoom.jsx` và `LearnLessonCall.jsx`.
- **Thư mục 2 (Mã nguồn hiện tại sau Giai đoạn 3–4)**: `/tmp/beego-build-current`
  - Chứa đầy đủ toàn bộ mã nguồn của Giai đoạn 3 và 4.
- **Tính đồng nhất**:
  - Cả hai thư mục đều symlink chung vào thư mục `node_modules` thực tế của dự án (`/var/www/dev_beego_vn_usr/data/www/dev.beego.vn/node_modules`) -> **100% cùng dependency và package version**.
  - Cùng cấu hình `next.config.mjs`.
- **Loại bỏ hoàn toàn ảnh hưởng của generated types cũ**:
  - Không sao chép thư mục `.next` cũ của dự án sang các thư mục tạm.
  - Điều chỉnh `tsconfig.json` trong hai thư mục tạm về cấu hình chuẩn sạch:
    ```json
    "include": [
      "next-env.d.ts",
      "**/*.ts",
      "**/*.tsx",
      ".next/types/**/*.ts"
    ]
    ```
    (Để Next.js tự tạo types mới trong `.next/types/` của chính thư mục tạm đó thay vì đọc file type rác sinh từ ngày 26/10).
  - **Bảo toàn 100%**: Thư mục `.next` gốc đang phục vụ website trên VPS **không bị xóa, không bị sửa đổi hay ghi đè**.

---

### 2. Kết Quả Thực Nghiệm Đối Chiếu Hai Bản Build

| Tiêu chí | Bản sao Baseline (`/tmp/beego-build-baseline`) | Bản sao Current (`/tmp/beego-build-current`) | Đánh giá so sánh |
| :--- | :---: | :---: | :--- |
| **Lệnh chạy** | `node ./node_modules/next/dist/bin/next build` | `node ./node_modules/next/dist/bin/next build` | Giống nhau 100% |
| **Mã thoát (Exit Code)** | **`0` (THÀNH CÔNG)** | **`0` (THÀNH CÔNG)** | **Cả hai đều PASS 100%** |
| **Kiểm tra cú pháp & Type** | `Linting and checking validity of types ...` **PASS** | `Linting and checking validity of types ...` **PASS** | 0 lỗi TypeScript trên cả hai bản |
| **Tạo trang tĩnh (SSG)** | `Generating static pages (76/76)` **PASS** | `Generating static pages (76/76)` **PASS** | Không có route nào bị lỗi |
| **Trang `/learn/lesson/[lessonId]`** | `39.4 kB` (First Load: `184 kB`) | `39.4 kB` (First Load: `188 kB`) | Tăng nhẹ `+4 kB` First Load do adapter WebRTC |
| **Trang `/luyen-noi`** | `6 kB` (First Load: `175 kB`) | `6 kB` (First Load: `179 kB`) | Tăng nhẹ `+4 kB` First Load |
| **File log ghi nhận** | [`docs/build-baseline.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-baseline.log) | [`docs/build-current.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-current.log) | Đầy đủ bằng chứng thực tế |

### 3. Kết Luận Thực Nghiệm Về Lỗi Build
1. Khi **loại bỏ ảnh hưởng của generated types cũ** trong `.next/types/` (vốn sinh từ ngày 26/10 và bị kẹt trong `tsconfig.json`), **CẢ HAI BẢN BUILD BASELINE VÀ CURRENT ĐỀU THÀNH CÔNG RỰC RỠ VỚI EXIT CODE 0**.
2. **Mã nguồn Giai đoạn 3 và 4 của Gia sư AI hoàn toàn sạch sẽ**:
   - Không gây ra bất kỳ lỗi TypeScript nào.
   - Không phá vỡ bất kỳ cơ chế biên dịch trang hay middleware nào của Next.js 14.2.35.
   - Chỉ tăng thêm 4 kB JavaScript tải ban đầu cho các module thoại để nạp WebRTC adapter.
3. **Giải thích rõ ràng lỗi Exit 1 trước đó**:
   - Lệnh build trước đó (`task-1714`) chạy trực tiếp trong thư mục gốc dự án đã bị `tsconfig.json` kéo theo các file `.next/types/**/*.ts` cũ của thư mục `.next` có sẵn từ ngày 26/10, gây ra 46 lỗi type signature của các route handler cũ ngoài phạm vi (`/api/admin/...`, `/api/org/...`).
   - `task-1771` bị dừng giữa chừng do phát hiện file nháp `sdp/route.js` (đã được dọn dẹp sạch).
   - Khi tách ra môi trường cô lập sạch: **Build ứng dụng chạy trơn tru 100% với Exit Code 0**.

---

## II. PHÂN BIỆT RÕ RÀNG POLICY TAB ẨN VÀ POLICY MẤT HEARTBEAT

Để đảm bảo tính nhất quán tuyệt đối giữa mã nguồn và tài liệu:

### 1. Policy Tab Ẩn / App Nền (Background Tab Policy)
- **Nguyên tắc**: Ứng dụng **HỖ TRỢ TIẾP TỤC ĐÀM THOẠI TRONG TAB ẨN**.
- **Hành vi thực tế**:
  - Khi người học chuyển tab hoặc ứng dụng chuyển xuống nền, kết nối WebRTC (PeerConnection) và micro vẫn duy trì. Client **tuyệt đối không tự ngắt kết nối** chỉ vì sự kiện `document.hidden`.
  - Miễn là trình duyệt hoặc OS vẫn cho phép timer chạy ngầm gửi heartbeat (hoặc tab vẫn phát âm thanh), cuộc gọi diễn ra liên tục, bình thường.

### 2. Policy Mất Heartbeat (Server Watchdog Liveness Timeout = 25 giây)
- **Nguyên tắc**: Áp dụng cơ chế **chủ động bảo vệ chi phí khi mất liên lạc**: Server theo dõi liveness độc lập qua Redis key `voice:realtime-liveness:${sessionId}`.
- **Hành vi thực tế**:
  - Chỉ khi máy chủ thực sự **không nhận được heartbeat quá 25 giây** (do tắt mạng, tắt máy, đóng tab hoàn toàn, hoặc hệ điều hành di động đóng băng sâu ứng dụng quá 25s): Server Watchdog coi đây là mất liên lạc (`client_disconnect_liveness_timeout`), chủ động gửi lệnh POST hangup lên OpenAI và đánh dấu phiên kết thúc.
- **Ranh giới kỹ thuật**:
  - **Không suy đoán rời tab chắc chắn sẽ mất heartbeat**.
  - Nhưng nếu app ở nền đã bị OS đình chỉ quá 25 giây dẫn đến mất heartbeat, thì khi người học quay lại tab, **heartbeat lúc quay lại không thể hồi sinh phiên đã đóng** (server trả về mã `410 SESSION_NOT_ACTIVE`). Sự kiện `visibilitychange` khi quay lại tab chỉ có tác dụng gửi heartbeat tức thì để làm mới liveness nếu thời gian ở nền ngắn hơn 25 giây.

---

## III. TRẠNG THÁI AZURE REALTIME COACHING TRÊN UI

- **Nguyên tắc**: **GIỮ Ở TRẠNG THÁI CHƯA KHẢ DỤNG; TUYỆT ĐỐI KHÔNG HIỂN THỊ ĐIỂM GIẢ HOẶC GIAO DIỆN MÔ PHỎNG**.
- **Triển khai trong [`components/beego/lesson-player/LearnCallRoom.jsx`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/lesson-player/LearnCallRoom.jsx)**:
  ```jsx
  {!ended && (!isRealtime ? Boolean(coach?.word) : Boolean(coach?.word && coach?.evidence === "azure_phoneme")) ? (
    <div className="beego-call-stage__coach" aria-label="Luyện phát âm">
      ...
    </div>
  ) : null}
  ```
  - Trong chế độ Realtime (`isRealtime === true`), thẻ luyện phát âm (`coach`) mặc định là `null` và chỉ được kích hoạt nếu có dữ liệu phát âm âm học thực tế từ Azure (`evidence === "azure_phoneme"`).
  - Vì pipeline gửi audio sidecar lên Azure chưa được kết nối trên Realtime transport, thẻ này luôn ở trạng thái **chưa khả dụng (ẩn hoàn toàn)**.
  - **Tuyệt đối không hiển thị điểm giả, điểm ngẫu nhiên hay bất kỳ huy hiệu mô phỏng nào trên giao diện**.
  - Đã bổ sung Unit Test (Test 7 trong `scripts/test-learn-call-stage4-behavior.mjs`) để kiểm chứng độc lập việc chặn hoàn toàn điểm giả và dữ liệu coach chưa xác thực.

---

## IV. BÀN GIAO FILE PATCH & BẰNG CHỨNG REVIEW ĐỘC LẬP

### 1. File Patch Giai Đoạn 3–4
File patch Git Unified Diff chuẩn đã được xuất tại:
👉 **[`docs/ai-tutor-stage-3-4.patch`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/ai-tutor-stage-3-4.patch)** *(~175 KB)*

Bao gồm đầy đủ các thay đổi và test case:
- `app/api/learn/ai-call/session/route.js`
- `app/api/learn/ai-call/realtime/session/route.js`
- `app/api/learn/ai-call/realtime/heartbeat/route.js`
- `lib/beego/learn/learn-call-realtime.js`
- `hooks/useRealtimeTutor.js`
- `components/beego/lesson-player/LearnCallRoom.jsx`
- `components/beego/lesson-player/LearnLessonCall.jsx`
- `ecosystem.voice.config.cjs`
- `scripts/voice-realtime-watchdog.mjs`
- `scripts/test-learn-call-stage3-realtime.mjs`
- `scripts/test-learn-call-stage4-behavior.mjs`

### 2. Log Build Đối Chiếu Đầy Đủ
- **Baseline**: [`docs/build-baseline.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-baseline.log) (`BASELINE_EXIT_CODE=0`)
- **Current**: [`docs/build-current.log`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/docs/build-current.log) (`CURRENT_EXIT_CODE=0`)

### 3. Kết Quả Kiểm Thử Tự Động (8/8 PASS)
```
========================================================================
Running Learn Call Stage 4 Behavioral & Realtime Verification Suite
========================================================================

-> Test 1: Remote audio pause and resumption across 2+ interruption cycles...
  [PASS] Test 1: Verified 2 consecutive interruption cycles: 0 stuck paused, stale buffer purged.

-> Test 2: Hangup failure (>3 attempts) retained in reconciliation registry...
[REALTIME_ALERT] Hangup failed after 3 attempts for callId call_stage4_openai_fail_001, sessionId sess-reconcile-stage4-001. Retaining in reconciliation registry.
  [PASS] Test 2: Hangup failure (>3) retained in reconciliation registry; never marked settled.

-> Test 3: Heartbeat authentication, ownership, rejection & zero deadline extension...
  [PASS] Test 3: Heartbeat strictly authenticated, prevents revival/extension, rejects non-owners.

-> Test 4: Talk modes (Auto vs Push-to-Talk) & genuine mute...
  [PASS] Test 4: Auto vs PTT mode verified; genuine mute survives interruptions.

-> Test 5: Azure Pronunciation Coach sidecar (16kHz PCM16 Resampling)...
  [PASS] Test 5: 16kHz PCM16 downsampler sidecar runs asynchronously without blocking WebRTC.

-> Test 6: Watchdog health check functionality...
  [PASS] Test 6: Watchdog health check returned structured healthy status.

-> Test 7: Azure Realtime Coaching UI state (no fake scores when data absent)...
  [PASS] Test 7: Azure Realtime Coaching UI verified unavailable when data absent; zero fake scores displayed.

-> Test 8: Policy separation: background tab continues; lost heartbeat triggers hangup...
  [PASS] Test 8: Verified policy separation: hidden tab continues while liveness loss > 25s safely hangs up.

========================================================================
🎉 ALL 8 STAGE 4 BEHAVIORAL & INTEGRATION TESTS PASSED WITH 100% SUCCESS! 🎉
========================================================================
```

---

## V. CHECKLIST THỬ NGHIỆM TRÌNH DUYỆT THẬT (KHI CÓ QUYỀN MỞ REALTIME)

- [ ] **1. Kiểm tra Ngắt Lời (Barge-in) 2 Chu Kỳ**:
  - Nói chen ngang khi gia sư đang nói -> Tiếng gia sư tắt tức thì (<300ms).
  - Lặp lại lần thứ 2 ở câu tiếp theo -> Tiếng tiếp tục tắt tức thì, không giật lag.
- [ ] **2. Kiểm tra Phát Lại Âm Thanh Sau Ngắt Lời**:
  - Người học im lặng để gia sư trả lời -> Câu trả lời mới phát mượt từ đầu, không phát lại âm thanh dở dang của câu trước.
- [ ] **3. Kiểm tra Nút Mute / Unmute Thật Sự**:
  - Tắt mic -> Không truyền byte âm thanh nào lên mạng, gia sư không phản ứng với tiếng ồn phòng. Bật lại mic -> Nói chuyện bình thường.
- [ ] **4. Kiểm tra Chế Độ Auto vs PTT (Thủ Công)**:
  - Chuyển sang PTT -> Chỉ truyền âm thanh khi nhấn giữ nút "NHẤN GIỮ ĐỂ NÓI". Thả ra -> Dừng truyền.
- [ ] **5. Kiểm tra Giọng Nói Việt–Anh & Zero TTS Overlap**:
  - Yêu cầu nói song ngữ -> Gia sư nói tự nhiên từ luồng WebRTC; tuyệt đối không có giọng TTS thứ 2 nói đè lên.
- [ ] **6. Kiểm tra Tab Ẩn vs Mất Heartbeat**:
  - Ẩn tab 10 giây (vẫn nghe tiếng gia sư) -> Cuộc gọi tiếp tục bình thường.
  - Tắt mạng / đóng băng ứng dụng > 25 giây -> Server ngắt kết nối an toàn, bảo vệ chi phí.
