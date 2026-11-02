# Báo cáo Giai đoạn 2: Trạng thái hội thoại và cách gia sư hướng dẫn (AI Tutor Stage 2)

**Dự án**: Beego AI Tutor (`Learn Call` & `Luyện nói`)  
**Mục tiêu**: Nâng cấp trạng thái học tập và phương pháp giảng dạy tự nhiên (dựa trên trải nghiệm chuẩn như ChatGPT Voice English Tutor), sửa triệt để các lỗi nhận nhầm thực thể (slot extraction), hỗ trợ ghép câu/scaffolding, phân tách chế độ bài học ngắn và trò chuyện mở.

---

## 1. Các vấn đề cốt lõi đã xác minh và xử lý

### 1.1. Sửa nhận nhầm thực thể (False Slot Extraction)
- **"I am hungry" không phải tên**:
  - *Nguyên nhân trước đây*: `FACET_HEARD.name` sử dụng negative lookahead giới hạn thiếu các tính từ chỉ trạng thái cơ bản, dẫn đến việc `I am hungry` bị nhận nhầm thành tên học viên (`name: "hungry"`).
  - *Giải pháp*: Bổ sung danh sách mở rộng `NON_NAME_ADJECTIVES` (hungry, thirsty, sleepy, tired, busy, ready, sick, cold, hot...) và thiết lập regex nhận dạng tên theo cấu trúc rõ ràng (`my name is`, `call me`, `tên tôi là`) kết hợp với ngữ cảnh câu hỏi đang chờ (`pendingQuestion.intent === "name"`).
- **"I have 2 cats" không phải tuổi**:
  - *Nguyên nhân trước đây*: Regex `age` có `(?:\s*(?:years?\s*old|tuổi))?` ở dạng tùy chọn (optional) kết hợp với `\d{1,2}`, khiến cho bất kỳ số nào từ 1–2 chữ số trong một câu bình thường (ví dụ: `2 cats`, `room 10`) đều bị nhận nhầm thành số tuổi.
  - *Giải pháp*: Yêu cầu rõ cấu trúc tuổi: hoặc có cụm từ `years old` / `tuổi`, hoặc đứng sau `I'm` / `I am` / `tôi`, hoặc là số đơn lẻ khi câu hỏi đang chờ chính là câu hỏi tuổi (`pendingQuestion.intent === "age"`).
- **Hiểu câu ngắn và câu 1 từ ("Hi", "OK", "Yes", "Luong", "25")**:
  - *Nguyên nhân trước đây*: `learnCallTranscriptUnclear` lọc bỏ các từ dưới 2–4 ký tự coi là unclear/nghẽn nhận dạng STT.
  - *Giải pháp*: Cho phép các từ hợp lệ có nguyên âm và các từ giao tiếp ngắn thông dụng (`COMMON_SHORT_CLEAR`). Khi câu hỏi đang hỏi tên hoặc tuổi, các câu trả lời 1 từ như "Luong" hoặc "25" được giải mã chuẩn xác theo `pendingQuestion`.

### 1.2. Theo dõi trạng thái học tập & hội thoại (State Tracker)
Module `evaluateLearnCallState(memory, options)` được bổ sung để theo dõi toàn diện phiên hội thoại:
1. **`pendingQuestion`**: Lưu vết câu hỏi gia sư đã hỏi kèm `intent` (`name`, `age`, `home`, `job`, `hobby`...), thời điểm hỏi (`askedAtTurn`), và trạng thái rõ ràng (`asked`, `pending`, `confirmed`, `skipped`).
2. **`confirmedFacts`**: Chỉ lưu các thông tin thực tế được học viên xác nhận kèm bằng chứng lượt nói (`turnRequestId`, `turnEvidence`). Không lưu câu mẫu hoặc câu hỏi của gia sư thành thông tin học sinh; không nhận nhầm khi học sinh hỏi lại ("còn bạn?").
3. **`helpLevel`**: Quản lý mức độ trợ giúp thích ứng (adaptive scaffolding):
   - Mức 0: Bình thường.
   - Mức 1: Gợi ý từ khóa (keyword hint).
   - Mức 2: Khung câu ngắn (sentence frame).
   - Mức 3: Giải thích tiếng Việt + ví dụ chia nhỏ (breakdown).
   - Tự động reset về mức 0 ngay khi học viên trả lời thành công.
   - **Hỗ trợ tức thì**: Khi học viên chủ động xin giải thích tiếng Việt hoặc xin ví dụ (`helpKind === "vietnamese"` hoặc `"example"`), hệ thống nhảy thẳng lên Mức 3 hỗ trợ ngay, **không bắt trải qua tuần tự 1 -> 2 -> 3**.
4. **`currentPractice`**: Theo dõi bài tập ghép câu / nhắc lại có mục tiêu:
   - Khi gia sư đưa ra mẫu câu cần luyện ghép (ví dụ: `"The assistant is interesting"`), `targetPhrase` được duy trì xuyên suốt các lượt phân mảnh.
   - Các câu nói phân mảnh (ví dụ: `"The assistant"`, `"is interesting"`) được ghi nhận là lượt thử (`attempts`), **không làm tăng lượt nội dung (`contentTurns`)** và không coi là lỗi phát âm. Toàn bộ chuỗi bài tập chỉ tính là 1 lượt nội dung khi hoàn thành.
5. **`sessionMode`**: Phân tách rõ ràng giữa:
   - Chế độ bài học ngắn (`"lesson"`): Tối đa 4 lượt nội dung (`contentTurns >= 4` kích hoạt kết thúc `closing("turns")`).
   - Chế độ trò chuyện mở (`"open"`): Không đóng phiên ở lượt thứ 4. Cuộc trò chuyện tiếp diễn tự nhiên cho đến khi hết thời lượng máy chủ quy định (`remainingMs <= 30s`) hoặc học viên chủ động yêu cầu dừng (`helpKind === "stop"`). Thời lượng và hạn mức vẫn do server quyết định, không tự động nới lỏng hay cấp quyền vượt gói.

### 1.3. Gợi ý câu trả lời động (Dynamic Reply Hints) & Luồng Gateway thực tế
- Cập nhật `learnCallReplyHints` để gắn chặt vào câu hỏi / ý định lượt hiện tại, không hiển thị gợi ý cũ.
- Khi đang có bài tập luyện câu dở dang (`currentPractice.active`), gợi ý ưu tiên hiển thị chính câu mục tiêu để học sinh dễ dàng luyện ghép.
- Khi gia sư đưa ra lời giải thích hoặc câu chưa xác định được ý định luyện tập cụ thể, hệ thống trả về các lựa chọn xin trợ giúp thân thiện (`"Could you say that again?"` / `"Explain in Vietnamese, please."`) thay vì bịa ra câu trả lời không liên quan.
- **Chứng minh luồng runtime thực tế**: `evaluateLearnCallState` được gọi trong `learnCallTurnPlan`, kết quả truyền trực tiếp vào `learnCallTurnDirective` (gửi LLM Worker qua BullMQ), vào `learnShapeForTurn` (chuẩn hóa câu trả lời TTS) và vào `learnHintsForReply` (gửi `replyHints` về client qua WebSocket). Không chỉ dùng trong unit test.

### 1.4. System Prompt v2 & Định hướng một hành động tiếp theo
- Tạo file prompt chuẩn hóa: `lib/beego/learn/prompts/ai-tutor-system-prompt.v2.js`.
- Loại bỏ ràng buộc cưỡng ép: Không bắt buộc mọi câu của gia sư phải kết thúc bằng dấu hỏi `?`. Cho phép:
  - Lời giải thích tiếng Việt ngắn gọn khi học sinh nói "em không hiểu".
  - Lời mời luyện tập: `"Bạn thử cả câu nhé: The assistant is interesting."`
  - Lời đáp trong tình huống giao tiếp (mini role-play): `"You're welcome!"`
- Cải tiến `learnCallShapeReply`: Nhận diện các câu luyện tập, đóng vai hoặc giải thích tiếng Việt hoàn chỉnh để không tự ý chèn câu hỏi fallback máy móc. Tăng giới hạn `maxReplyChars` ở mức Dễ lên 260 ký tự để không cắt đứt lời giải thích tiếng Việt.
- Khắc phục khen ngợi sáo rỗng: Gia sư chỉ khen ngợi cụ thể khi học viên có nỗ lực hoặc nói đúng; không tự ý nhận xét phát âm khi không có bằng chứng âm thanh từ Azure.

---

## 2. Danh sách các file đã tạo và chỉnh sửa

| File | Hành động | Mô tả chi tiết |
|---|---|---|
| `lib/beego/learn/prompts/ai-tutor-system-prompt.v2.js` | Tạo mới | System prompt phiên bản 2.0.0 tích hợp đầy đủ sư phạm gia sư song ngữ, hỗ trợ scaffolding, phản xạ role-play, giải thích tiếng Việt, khen ngợi có căn cứ |
| `lib/beego/learn/learn-call-topics.js` | Chỉnh sửa | Sửa regex `FACET_HEARD.name` loại bỏ tính từ trạng thái; sửa `FACET_HEARD.age` không nhận nhầm số lượng mèo; thêm `LEARN_CALL_HELP_HINTS`; hỗ trợ nhận diện ngữ cảnh lượt câu hỏi |
| `lib/beego/learn/learn-call-tutor.js` | Chỉnh sửa | Bổ sung `evaluateLearnCallState`; tích hợp `buildAiTutorSystemPromptV2`; sửa `learnCallTranscriptUnclear` cho câu 1 từ; mở rộng `learnCallTurnPlan` cho `sessionMode`; hoàn thiện `learnCallShapeReply` cho lượt không có dấu hỏi |
| `app/api/learn/ai-call/session/route.js` | Chỉnh sửa | Lưu nhận diện `sessionMode` (`open` hoặc `lesson`) vào context phiên trong Redis |
| `scripts/voice-ws-gateway.mjs` | Chỉnh sửa | Đưa `sessionMode` vào `ws.learnTopicCtx` để luồng Gateway và Worker xử lý theo đúng chế độ |
| `scripts/test-learn-call-stage2-behavior.mjs` | Tạo mới | Bộ kiểm thử hành vi chuyên biệt cho 10 kịch bản của Giai đoạn 2 |

---

## 3. Kết quả kiểm thử (Verification & Test Results)

### 3.1. Bộ test hành vi Giai đoạn 2 (`node scripts/test-learn-call-stage2-behavior.mjs`)
Tất cả 10 nhóm kịch bản kiểm thử đều đạt 100%:
1. `Test 1: Sửa nhận nhầm (False slot extraction)`: `[PASS]` ("I am hungry" không phải tên, "I have 2 cats" không phải tuổi).
2. `Test 2: Short answers & single-word comprehension`: `[PASS]` ("Hi", "OK", "Yes", "Luong", "25" được hiểu trong ngữ cảnh).
3. `Test 3: Confirmed facts evidence`: `[PASS]` (Chỉ ghi nhận fact có evidence của học viên; model ví dụ không biến thành fact).
4. `Test 4: Dynamic Reply Hints`: `[PASS]` (Gợi ý khớp câu hỏi hiện tại; khi chưa rõ cho tùy chọn hỗ trợ).
5. `Test 5: Reciprocal question ('and you?')`: `[PASS]` (Gia sư trả lời về mình trước, không nhầm thông tin học viên).
6. `Test 6: Adaptive helpLevel scaffolding`: `[PASS]` (Tăng dần mức trợ giúp khi bí 0 -> 1 -> 2 -> 3; reset khi trả lời được).
7. `Test 7: Scaffolding and currentPractice`: `[PASS]` (Mảnh ghép luyện tập được theo dõi, không coi là lỗi ASR).
8. `Test 8: Mini lesson vs. Open conversation mode`: `[PASS]` (Chế độ mở không bị ngắt ở 4 lượt; chế độ bài học đóng ở 4 lượt).
9. `Test 9: Non-question turns in reply shaping`: `[PASS]` (Không cưỡng ép dấu hỏi lên lời giải thích hay lời luyện tập).
10. `Test 10: System Prompt v2 integration`: `[PASS]` (Tích hợp thành công toàn bộ quy tắc sư phạm mới).

### 3.2. Kiểm thử hồi quy toàn bộ hệ thống (Regression Test Suite)
- `node scripts/test-learn-call-stage1-behavior.mjs`: `5/5 PASS` (Ổn định lượt nói, stream và thứ tự token).
- `node scripts/test-learn-call-tutor.mjs`: `PASS` (Toàn bộ 40+ khẳng định về bài học, prompt và turn plan).
- `node scripts/test-learn-call-talk.mjs`: `PASS` (Luồng quản lý mic, segment và utterance).
- `node scripts/test-learn-call-playback.mjs`: `PASS` (Luồng phát âm thanh và xác nhận hoàn tất).
- `node scripts/test-learn-call-lifecycle.mjs`: `PASS` (Vòng đời kết nối và server deadline).
- `node scripts/test-learn-call-transcript.mjs`: `PASS` (Transcript in-memory của phiên).
- `node scripts/test-learn-call-coach.mjs`: `PASS` (Chấm phát âm Azure và phoneme hint).
- `node scripts/test-learn-call-ipa.mjs`: `PASS` (Phát âm IPA).

---

## 4. Trạng thái cam kết & An toàn triển khai
- **Môi trường & Đường dẫn**: Sử dụng đường dẫn thực tế trên VPS (`/var/www/dev_beego_vn_usr/data/www/dev.beego.vn`).
- **Bảo mật & Giới hạn**: Không gọi API trả phí, không rò rỉ secret, không push git hay restart dịch vụ production ngoài phạm vi.
- **Tính tương thích**: Giữ nguyên toàn bộ logic giao diện, xác thực JWT, gói cước và hạn mức thời gian máy chủ đã được thiết lập.

