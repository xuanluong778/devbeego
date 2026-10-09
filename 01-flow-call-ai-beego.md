# Flow Call AI trong tab Học AIBeego

Ngày lập: 09/10/2026 · Trạng thái: đặc tả triển khai, chưa phải chức năng đã phát hành.

## 01. Mục tiêu và phạm vi

Gia sư AI giúp học viên vận dụng bài vừa học qua hội thoại giọng nói tự nhiên. Call nằm trong tab Học, không tạo tab mới. Giữ nguyên 112 bài thường với 12 hoạt động, Boss Test, SRS và tiến độ hiện có.

Call là hoạt động bổ sung: từ chối hoặc không có quyền gọi không chặn hoàn thành bài và mở khóa lộ trình. Chỉ Pro/VIP đang có hiệu lực được gọi theo chính sách đề xuất; cần chốt hạn mức từng gói trước phát hành. Trial, free và expired không được tạo phiên. Ngoại lệ quản trị phải rõ ràng, có ghi nhận.

## 02. Flow tổng thể của học viên

1. Học và hoàn thành bài hiện tại.
2. Màn tổng kết hiện nút “Gọi AI — thực hành bài vừa học”.
3. Server kiểm tra đăng nhập, gói đang hoạt động, hạn mức và phiên đồng thời.
4. Nếu không đủ quyền: hiện thông tin nâng cấp, vẫn cho tiếp tục học bình thường.
5. Nếu đủ quyền: hiện mục tiêu, độ khó, thời lượng tối đa và phút còn lại.
6. Học viên bấm bắt đầu, cho phép micro; chỉ tính thời lượng theo chính sách phiên đã kết nối, không từ lúc xem màn chuẩn bị.
7. AI chào, giới thiệu vai trò và bắt đầu tình huống gắn với bài học.
8. Học viên nói; AI nghe, phản hồi và hỏi tiếp theo ngữ cảnh.
9. Học viên có thể tắt micro, bật phụ đề, yêu cầu nhắc lại, nói chậm hoặc giải thích tiếng Việt.
10. Học viên kết thúc hoặc server kết thúc khi đến giới hạn; dừng micro và toàn bộ âm thanh.
11. Hiện tổng kết có căn cứ và nội dung nên ôn; quay về đúng bài/vị trí trong tab Học.

## 03. Mức 1 — Làm quen: trả lời có hỗ trợ

Mục tiêu: dám nói và hiểu lượt hỏi ngắn. Dành cho Pre-A1 hoặc học viên mới dùng Call.

- Thời lượng mục tiêu: 1–2 phút, khoảng 3–4 lượt học viên; đây là gợi ý thiết kế, cần đo thực tế.
- AI hỏi một câu mỗi lượt, tốc độ chậm, dùng kiến thức vừa học.
- Hiện 2–3 gợi ý trả lời và phụ đề tùy chọn; chấp nhận câu ngắn có nghĩa.
- Chủ đề: tên, chào hỏi, đồ uống, sở thích đơn giản.
- Ví dụ: “Hi! What is your name?” → học viên trả lời → AI nhắc đúng tên và hỏi tiếp.
- Tiêu chí luyện tập: trả lời liên quan và hoàn thành mục tiêu với hỗ trợ; không xem đây là chứng nhận trình độ.

## 04. Mức 2 — Hội thoại ngắn theo bài

Mục tiêu: trả lời bằng câu đơn và nối các lượt hỏi–đáp. Dành cho Pre-A1/A1 khi mức 1 đã phù hợp.

- Thời lượng mục tiêu: 2–3 phút, khoảng 4–6 lượt.
- Gợi ý chỉ xuất hiện khi bấm; AI không đọc sẵn đáp án.
- Chủ đề: thói quen, gia đình, giờ giấc, món ăn và mua đồ đơn giản.
- AI hỏi tiếp dựa trên câu vừa nghe, không lặp câu hỏi đã được trả lời.
- Ví dụ: “What do you drink in the morning?” → “Tea.” → “Do you drink it with milk?”
- Cuối buổi chọn 1–2 cách diễn đạt để luyện lại, không sửa mọi lỗi giữa cuộc gọi.

## 05. Mức 3 — Nhập vai hoàn thành nhiệm vụ

Mục tiêu: thực hiện một việc giao tiếp cụ thể. Dành cho nội dung hướng A1/A2.

- Thời lượng mục tiêu: 3–5 phút.
- AI đóng vai nhân viên quán, người bán hàng, lễ tân hoặc người chỉ đường.
- Có 2–3 mục tiêu rõ ràng: gọi đồ uống, nêu yêu cầu, xác nhận đơn.
- Tình huống có nhánh theo lời học viên; vẫn giới hạn độ khó và vốn từ.
- Ví dụ: học viên gọi cà phê → AI hỏi nóng/lạnh → hỏi kích thước → xác nhận.
- Thành công dựa trên nhiệm vụ đạt được, không bắt nói giống câu mẫu.

## 06. Mức 4 — Xử lý thay đổi và hỏi lại

Mục tiêu: duy trì giao tiếp khi gặp thông tin bất ngờ. Dành cho nội dung hướng A2.

- Thời lượng mục tiêu: 4–6 phút.
- Thêm một thay đổi hợp lý: món hết, đổi giờ, phòng chưa sẵn hoặc chưa nghe rõ.
- Học viên luyện hỏi lại, yêu cầu giải thích, chọn phương án khác và xác nhận.
- AI chỉ tăng một khó khăn mỗi lần, tránh đưa nhiều thông tin mới cùng lúc.
- Ví dụ: “We don’t have tea today. Would you like coffee instead?”
- Lỗi STT không được coi là lỗi học viên: hỏi lại khi độ chắc chắn thấp hoặc nội dung bất thường.

## 07. Mức 5 — Kể chuyện và giải thích ý kiến

Mục tiêu: nói nhiều câu có liên kết, đưa lý do và ví dụ. Dành cho nội dung hướng A2/B1.

- Thời lượng mục tiêu: 5–8 phút.
- Chủ đề: chuyến đi, trải nghiệm, kế hoạch và lựa chọn cá nhân.
- AI hỏi mở, chờ học viên diễn đạt và đưa gợi ý khi được yêu cầu.
- Ví dụ: “Tell me about a trip you enjoyed. What made it special?”
- Gợi ý phản hồi dựa trên ý đã nói; không tự bịa trải nghiệm cho học viên.
- Tổng kết tập trung vào tổ chức ý, từ/cụm và ngữ pháp có bằng chứng trong transcript.

## 08. Mức 6 — Trao đổi công việc và thảo luận

Mục tiêu: trình bày, làm rõ và phản hồi quan điểm. Dành cho nội dung hướng B1 trở lên khi đã được biên tập phù hợp.

- Thời lượng mục tiêu: 6–10 phút.
- Tình huống: cập nhật công việc, đề xuất phương án, phản hồi lịch sự và trình bày ngắn.
- AI đặt câu hỏi nối tiếp, đưa quan điểm khác nhẹ nhàng và yêu cầu ví dụ.
- Ví dụ: “Which solution would you recommend, and why?”
- Không gán nhãn “đạt B1” chỉ vì hoàn thành cuộc gọi; mức khó là cấu hình luyện tập.

## 09. Quy tắc chuyển từ dễ lên khó

Không đồng nhất độ khó Call với số phần hoặc điểm XP. Dùng placement và kết quả hiện có để đề xuất mức khởi đầu, đồng thời cho học viên chọn mức dễ hơn.

- Giai đoạn đầu dùng quy tắc dễ giải thích, chưa tự tạo điểm mastery mới.
- Đề xuất tăng mức khi học viên thực hiện được mục tiêu qua nhiều phiên và cần ít hỗ trợ hơn; ngưỡng phải được thử nghiệm trước khi cố định.
- Đề xuất giảm mức khi thường xuyên không hiểu câu hỏi hoặc phải dùng gợi ý; lỗi mạng, micro và STT không tính là năng lực yếu.
- Không khóa cứng các mức dựa vào điểm chưa được thẩm định.
- Duy trì nút “Dễ hơn” và ghi nhận lựa chọn cho phiên sau.

## 10. Flow kỹ thuật của một phiên gọi

1. Client gửi lessonId và mode/level được chọn; server xác thực và kiểm tra quyền truy cập bài.
2. Server lấy nội dung thật của bài, chuẩn bị ngữ cảnh tối thiểu: mục tiêu, từ/cụm, trình độ và lỗi cần luyện.
3. Server tạo sessionId ràng buộc userId và thông tin xác thực ngắn hạn; không tin plan hoặc quyền do client gửi.
4. Áp dụng giới hạn phiên đồng thời, hạn mức và thời lượng tối đa bằng server.
5. Kết nối transport thoại; luồng Azure STT → LLM → TTS hiện tại là ứng viên tái sử dụng. Speech-to-speech có thể thử riêng bằng feature flag sau khi đo.
6. Quản lý trạng thái: preparing → connecting → listening/thinking/speaking → ending → ended; trạng thái error/reconnecting có xử lý rõ.
7. Khi học viên ngắt lời: dừng phát, hủy lượt AI cũ và bỏ chunk đến muộn. Bộ nhớ phải phản ánh phần AI thực sự đã nói/người học đã nghe.
8. Khi kết thúc: đóng kết nối/recorder/player, đối soát usage một lần, lưu tổng kết theo chính sách.
9. Reconnect phải xác minh lại phiên, không chiếm session của người khác, không tạo kết quả hoặc trừ hạn mức lặp.

## 11. Thứ tự phát triển 1 — Chuẩn hóa nền tảng và quyền gọi

Đọc và nối các phần đã có: app/luyen-noi/page.js, components/ai-call/AiCallLayout.jsx, components/lessons/VoiceCall.jsx, hooks/useVoiceWebSocket.js, app/api/voice/token/route.js và lib/http/ai-entitlement.ts.

- Xác định luồng đang chạy, tránh duy trì hai “Call” có hành vi khác nhau không rõ ràng.
- Tạo chính sách ai_call thống nhất; không đổi quyền của chat hoặc bài luyện nói khác ngoài phạm vi.
- Chặn trial/expired tại API và gateway; lỗi tải subscription phải từ chối an toàn.
- Ràng buộc session với user và token; kiểm tra token hết hạn, phiên đồng thời và thu hồi quyền.
- Giữ nguyên trang luyện nói cũ; entry mới nằm trong tab Học và dùng dịch vụ chung.
- Nghiệm thu: free/trial/expired không gọi được kể cả truy cập API trực tiếp; gói hợp lệ gọi được trong hạn mức.

## 12. Thứ tự phát triển 2 — Một cuộc gọi mức 1 hoàn chỉnh

- Thêm nút Call sau tổng kết bài; gọi hay không đều không thay đổi hoàn thành bài.
- Tái sử dụng giao diện/audio phù hợp, truyền lessonId và ngữ cảnh server vào phiên.
- Hoàn thành mức 1 với micro, trạng thái, phụ đề, kết thúc và quay lại bài.
- AI nhớ tên/thông tin vừa được nói, hỏi đúng mục tiêu bài và không yêu cầu đọc lại máy móc.
- Nghiệm thu: đi hết một cuộc gọi thật, đúng quyền, không chồng tiếng, không ảnh hưởng các tab khác.

## 13. Thứ tự phát triển 3 — Hội thoại mức 2 và nhập vai mức 3

- Tách chế độ luyện đọc câu mẫu khỏi gia sư hội thoại.
- Bổ sung hồ sơ tình huống có vai trò, mục tiêu, vốn từ và tiêu chí kết thúc.
- Giảm gợi ý dần; hỏi tiếp theo thông tin học viên thay vì danh sách câu cố định.
- Nghiệm thu: cùng tình huống nhưng câu trả lời khác nhau dẫn tới hội thoại phù hợp khác nhau.

## 14. Thứ tự phát triển 4 — Ngắt lời, hạn mức và reconnect

- Hoàn thiện barge-in và chống tự nhận tiếng AI qua loa.
- Giới hạn im lặng, tối đa phiên, phút còn lại và cảnh báo trước khi hết.
- Thống nhất quota giữa gateway và worker; dùng số liệu usage của dịch vụ khi có, tách rõ ước lượng.
- Quy định “phút gọi” là thời gian nào; không đồng nhất STT milliseconds với toàn bộ thời lượng gọi.
- Kiểm tra mất mạng, reconnect, đổi tab, tắt màn hình và audio đến muộn.
- Nghiệm thu: server dừng được phiên hết hạn; không tính usage hai lần; micro không tiếp tục sau thoát.

## 15. Thứ tự phát triển 5 — Tổng kết có căn cứ và mức 4–6

- Loại bỏ điểm mặc định/điểm sinh từ hash trong flow Call.
- Không chấm phát âm từ transcript; thiếu dữ liệu thì hiển thị “Chưa đánh giá”.
- Tổng kết gồm nhiệm vụ đã thực hiện, 2–3 câu cần sửa kèm dẫn chứng, câu tự nhiên hơn và mục ôn phù hợp.
- Thời lượng lấy từ phiên thật; không suy từ số lượt nói.
- Lỗi 401/402/403 phải hiển thị đăng nhập/nâng cấp, không fallback thành đánh giá AI thành công.
- Bổ sung mức 4–6 sau khi bản cơ bản hoạt động ổn định, nội dung được rà soát và chi phí được đo.
- Không tự thêm XP hoặc cập nhật mastery/SRS bằng điểm chưa được xác thực.

## 16. Thứ tự phát triển 6 — Kiểm thử và phát hành có kiểm soát

- Kiểm quyền: guest/free/trial/expired, Pro/VIP còn hạn, vừa hết hạn, token sai và session của người khác.
- Kiểm học tập: hiểu bài, nhớ ngữ cảnh, yêu cầu nhắc lại, đổi ý, im lặng và nói tiếng Việt.
- Kiểm kỹ thuật: iPhone Safari, Android Chrome, desktop và Android WebView nếu app hỗ trợ; quyền micro, tai nghe/loa, mạng yếu, ngắt lời và reconnect.
- Kiểm bảo toàn: hoàn thành bài, ID, attempts, XP, Honey, tim, SRS và các tab khác giữ đúng hành vi.
- Đo độ trễ đến âm thanh đầu tiên, độ trễ dừng khi ngắt lời, lỗi phiên, usage/chi phí và mục tiêu giao tiếp hoàn thành. Đặt ngưỡng sau baseline, không hứa độ trễ chưa đo.
- Mặc định không lưu audio. Thông báo đây là AI, cách xử lý giọng nói, thời gian lưu transcript và cách xóa; rà soát riêng nếu phục vụ trẻ em.
- Triển khai bằng feature flag, thử nhóm nhỏ, có cách tắt Call mà không làm gián đoạn học.
- Chỉ phát hành sau kiểm tra và quyết định triển khai của chủ dự án.

## 17. Bản đầu nên bàn giao

Một flow hoàn chỉnh trong tab Học: học xong → kiểm quyền trả phí → Call mức 1 theo bài → kết thúc → tổng kết thật → quay lại học. Có kiểm soát hạn mức server, xử lý micro/mạng và không tạo điểm giả.

Các mức cao hơn được bổ sung sau; không cần triển khai cả 6 mức trước khi kiểm chứng bản đầu. Tài liệu này mô tả thiết kế và thứ tự công việc, không khẳng định các chức năng đã được xây hoặc kiểm thử.
