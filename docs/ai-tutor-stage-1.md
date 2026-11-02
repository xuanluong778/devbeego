# Báo Cáo Bàn Giao: Giai Đoạn 1 — Ổn Định Lượt Nói Và Stream

**Dự án**: Gọi gia sư AI Beego (`Learn Call`)  
**Mục tiêu giai đoạn 1**: Ổn định lượt nói, khắc phục xung đột lượt (race conditions), đảm bảo thứ tự stream SSE và dọn dẹp tài nguyên (cleanup) idempotent mà không thay đổi auth, UI tổng thể hay chuyển đổi Realtime API.  
**Tài liệu hành vi tham chiếu**: `docs/ai-tutor-reference.md` (được lập từ video mẫu `docs/hoc-tieng-anh.wmv`).

---

## 1. Các lỗi xác minh được và nguyên nhân

1. **Kết quả chấm lượt cũ can thiệp vào lượt mới (Media / Phase hijacking)**:
   - *Hiện tượng*: Khi người học kết thúc câu A và bắt đầu bấm nói câu B (`requestRef = 2`, mic đang thu âm), dịch vụ Azure STT / Pronunciation Assessment nền của câu A trả về kết quả trễ (`listen_retry`, `practice_result`, `pronunciation_coach` mang `requestId: 1`).
   - *Nguyên nhân*: Các sự kiện trên được xử lý trước lệnh kiểm tra `requestId`. Khi nhận được thông điệp, hàm xử lý tự động gọi `stopMic()`, đặt lại `listeningRef.current = false` và gọi `talkRef.current.notePracticeDone()` chuyển trạng thái về `ready`, làm ngắt microphone của lượt B và hủy lượt đang nói của học viên.

2. **Stream SSE không tuần tự và rò rỉ token (Out-of-order SSE token streaming)**:
   - *Hiện tượng*: Các token hiển thị hoặc tổng hợp câu bị đảo lộn, hoặc thông điệp `ai_done` và tác vụ TTS được kích hoạt trước khi các token cuối cùng được xử lý xong; khi người học ngắt lời (cancel), worker vẫn tiếp tục gửi `ai_done` và tạo TTS thừa.
   - *Nguyên nhân*: Vòng lặp đọc SSE gọi `onToken` bất đồng bộ mà không `await`, trong khi hàm callback lại `await` Redis (`isCancelled` và kiểm tra quota lặp đi lặp lại trên từng token). Các Promise chạy đua (race condition) dẫn đến token đến không theo thứ tự FIFO; khi luồng đọc kết thúc, hàm thoát ngay trong khi các token cuối còn đang xử lý dở dang.

3. **Cleanup không triệt để khi đổi trang / kết thúc / unmount**:
   - *Hiện tượng*: Khi người dùng tắt màn hình gọi hoặc chuyển bài, âm thanh mẫu phát âm (`playLessonTts`) hoặc các timer nhận dạng vẫn có thể tiếp tục chạy ngầm; gọi cleanup nhiều lần (ví dụ trong React StrictMode) có thể gây lỗi hoặc phát sinh sự kiện `onStopped` lặp lại.

---

## 2. Các file đã sửa và tạo mới

| File | Trạng thái | Nội dung thực hiện |
| :--- | :---: | :--- |
| `docs/ai-tutor-reference.md` | Tạo mới | Tài liệu tham chiếu chuẩn hành vi gia sư AI dựa trên video `hoc-tieng-anh.wmv`. |
| `lib/beego/learn/learn-call-stream.js` | Tạo mới | Module chuẩn hóa xử lý SSE, hàng đợi token tuần tự FIFO (`createOrderedTokenQueue`) và đọc stream tuần tự có xử lý hủy/lỗi/finish_reason. |
| `lib/beego/learn/learn-call-talk.js` | Sửa đổi | Bổ sung hàm pure logic `evaluateLearnCallInbound` và kiểm tra `requestId` guard trong `notePracticeDone`, `noteFinal`, `noteTimeout` nhằm bảo vệ state machine không bị can thiệp bởi lượt cũ. |
| `components/beego/lesson-player/LearnCallRoom.jsx` | Sửa đổi | Tách biệt attempt ownership (`activeListenIdRef`, `activePracticeIdRef`); sử dụng trực tiếp `evaluateLearnCallInbound`; kết quả muộn từ lượt A vẫn lưu coach/điểm nhưng không gọi `stopMic()` hay đổi phase của lượt B; bổ sung `stopLessonTts()` và dọn dẹp sạch sẽ khi unmount. |
| `hooks/useStreamingTtsPlayer.js` | Sửa đổi | Đảm bảo hàm `close()` hoạt động an toàn và idempotent khi được gọi nhiều lần. |
| `scripts/voice-llm-worker.mjs` | Sửa đổi | Tích hợp `streamOpenAIChatSse`; tuần tự hóa xử lý token; bỏ kiểm tra quota thừa trên từng token; xử lý abort/cancel và bắt lỗi stream không làm treo giao diện. |
| `scripts/test-learn-call-stage1-behavior.mjs` | Tạo mới | Bộ test hành vi trực tiếp sử dụng chính các module production (`learn-call-talk.js`, `learn-call-stream.js`, `learn-call-playback.js`) cho 5 kịch bản cốt lõi. |

---

## 3. Rà soát Chi tiết theo Yêu cầu Kiểm tra

### 3.1. Xác minh test dùng chính module / logic production
- Hàm phân định quyền lượt `evaluateLearnCallInbound` đã được đưa vào module production [`lib/beego/learn/learn-call-talk.js`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/lib/beego/learn/learn-call-talk.js).
- Cả component giao diện [`LearnCallRoom.jsx`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/components/beego/lesson-player/LearnCallRoom.jsx) và bộ test [`scripts/test-learn-call-stage1-behavior.mjs`](file:///var/www/dev_beego_vn_usr/data/www/dev.beego.vn/scripts/test-learn-call-stage1-behavior.mjs) đều import và dùng chung hàm sản xuất này. Bộ test không sử dụng logic mô phỏng riêng để tự báo pass.
- Các test luồng stream (Test 2, 3, 4) và double cleanup (Test 5) import và chạy trực tiếp trên các controller production (`streamOpenAIChatSse`, `createLearnTalkController`, `createLearnPlaybackController`, `createLearnAudioCache`).

### 3.2. Đánh giá cơ chế Quota & Giới hạn trong phạm vi đã xác minh
- **Phạm vi bảo toàn đã xác minh**:
  - Tại Worker LLM: Kiểm tra quota được thực hiện ở đầu mỗi lượt (`quotaCheckAndSignal` tại dòng 173 của `voice-llm-worker.mjs`). Nếu người dùng đã hết quota ngày hoặc tháng trước khi bắt đầu lượt, worker sẽ chặn ngay lập tức, gửi event `quota_exceeded`, `interrupt` và khóa `voice:cancel`.
  - Cơ chế dừng giữa lượt: Cờ `isCancelled(sid, rid)` kiểm tra trên mỗi token vẫn được duy trì để ngắt stream qua `ac.abort()` nếu có sự kiện cancel hoặc interrupt từ hệ thống.
  - Tại Gateway & Learn Call: Rate limit người dùng (`enforceRateLimit`) và chính sách kết thúc bài sau các lượt học (`ws.learnClosingRid` -> `lesson_complete`) tiếp tục hoạt động bình thường.
  - Loại bỏ truy vấn lặp lại: Trong suốt thời gian nhận một phản hồi LLM đơn lẻ, số liệu token tiêu thụ trong Redis không thay đổi (chỉ được cộng dồn khi lượt hoàn tất). Việc gọi `hgetall` lặp lại 50–100 lần mỗi giây trên từng token là dư thừa, gây tắc nghẽn I/O Redis và làm giật stream.
- **Giới hạn kiến trúc đã ghi nhận (chưa thay chính sách quota trong Giai đoạn 1)**:
  - *Cập nhật ở cuối lượt*: `llm_tokens_out` chỉ được ghi tăng vào Redis sau khi toàn bộ stream kết thúc (`redis.hincrby`). Do đó, lượng token đang phát sinh trong một lượt chưa được phản ánh theo thời gian thực (in-flight).
  - *Nhiều phiên chạy đồng thời (Concurrent sessions)*: Nếu cùng một tài khoản kích hoạt nhiều phiên hoặc lượt nói song song tại cùng một thời điểm, các phiên có thể vượt ngưỡng hạn mức một lượng nhỏ trước khi lượt kết thúc và ghi nhận vào Redis.
  - Trong Giai đoạn 1, hệ thống **chưa thay đổi chính sách quota hay cấu trúc bảng dữ liệu usage**; việc tối ưu này chỉ tập trung dỡ bỏ tải Redis thừa trên từng token stream mà vẫn giữ nguyên cổng kiểm soát ở đầu lượt.

### 3.3. Minh bạch lịch sử lỗi test và trạng thái Lint
- **Lỗi Test từng gặp**:
  - `Test 4` trong lần chạy đầu tiên bị fail: `ASSERTION FAILED: Underlying stream reader cancel() must be called`. Nguyên nhân là luồng mock trong file test gọi `controller.close()` đồng bộ quá sớm trong `start()`, khiến stream rơi vào trạng thái closed trước khi gọi `reader.cancel()` (theo chuẩn WHATWG Streams, cancel trên closed stream không gọi hook cancel của source). Sau khi sửa test giữ stream mở khi đang truyền tải, `reader.cancel()` đã kích hoạt hook chuẩn xác và pass 100%.
- **Trạng thái Lint**:
  - Lệnh `npx next lint` trước đó đã bị hủy (`manage_task kill`) do Next.js hiển thị câu hỏi tương tác để khởi tạo file cấu hình ESLint mới (dự án gốc chưa có file `.eslintrc.json`).
  - **Lưu ý**: Lint **chưa được chạy và không được coi là đã pass**. Workspace được giữ nguyên không tạo thêm file cấu hình ngoài ý muốn.
- **Kết quả chạy lại cuối cùng**:
  ```bash
  node scripts/test-learn-call-stage1-behavior.mjs
  ```
  -> **PASS 5/5** kịch bản hành vi.
  ```bash
  node scripts/test-learn-call-talk.mjs
  node scripts/test-learn-call-playback.mjs
  node scripts/test-learn-call-lifecycle.mjs
  node scripts/test-learn-call-transcript.mjs
  node scripts/test-learn-call-coach.mjs
  ```
  -> **PASS 5/5** suite kiểm thử hồi quy.

---

## 4. Giới hạn và Hướng tiếp theo (Giai đoạn 2)

- Giữ nguyên toàn bộ cấu hình hệ thống, token xác thực, phân quyền bài học và chính sách 4 lượt.
- Chưa restart hay deploy dịch vụ theo yêu cầu.
- Sẵn sàng tiến hành các bước nâng cấp trải nghiệm tự nhiên của Giai đoạn 2.
