# Phương án phát triển Gọi gia sư AI Beego

## Kết luận đề xuất
Giữ stack mức 1 đang chạy, thay màn gọi và hoàn thiện độ tin cậy trước khi mở cho học viên. Chưa mở mức 2, chưa kích hoạt hạn mức phút thương mại. Báo cáo production là thông tin do chủ sản phẩm cung cấp, chưa được kiểm tra trực tiếp máy chủ.

## Những gì đã xem
Video `video beego.wmv` dài 401,4 giây. Đã xem các khung hình cách 10 giây xuyên suốt và khung lớn ở đoạn cuối; chưa nghe/đối chiếu toàn bộ âm thanh. Quan sát được màn gọi toàn màn hình, thanh tiến trình, nhân vật có biểu cảm, nút nhấn nói và nút CC, phụ đề ngắn, tổng kết có hội thoại. Ảnh tham chiếu dùng nhân vật Lily; bản demo sử dụng nhân vật SVG riêng cho Beego, cùng hướng bố cục. Nhân vật demo chưa phải tài sản thương hiệu cuối cùng.

Tham khảo chính thức: https://blog.duolingo.com/ai-and-video-call/ và https://blog.duolingo.com/video-call/. Duolingo mô tả hội thoại theo nội dung đã học và câu mở đầu được chuẩn bị riêng. Beego nên dùng nguyên tắc này nhưng giữ luật bài, quyền truy cập và phần thưởng của mình.

## Giao diện đã dựng
`beego-call-demo.html` là bản HTML độc lập, không cần cài thư viện. Nhân vật lớn, nền tím, X kết thúc, thanh thời gian 2 phút, nút nghe lại, nút nói và CC. CC mở bảng hội thoại cuộn, bật/tắt không dừng thời gian. Phụ đề câu hiện tại vẫn hiện trên nhân vật. Có trạng thái đang nghe, suy nghĩ, nói và ngắt lời, cùng màn tổng kết. Hội thoại và biểu cảm được mô phỏng; không dùng micro, không gọi Azure, không kết nối API. Bấm nút nói lần đầu để nghe mẫu, lần hai để gửi câu mẫu. Kết thúc sau 3 lượt trả lời hoặc hết 2 phút. Nút nghe lại mô phỏng trạng thái, chưa phát âm thanh.

## Thứ tự triển khai
1. Thay giao diện trong lớp phủ bản đồ, dùng đúng session hiện có; đừng tạo thêm hệ thống phiên. Đưa trạng thái vào một bộ điều khiển duy nhất để nút, micro, âm thanh và nhân vật cùng nhận một nguồn sự thật.
2. Xác nhận micro trên iPhone Safari và Android Chrome bằng cuộc gọi thật. Kiểm tra từ chối quyền, rút tai nghe, đưa app ra nền, khóa màn hình, mất mạng và nối lại. Trên máy tính kiểm tra Chrome/Edge. Ghi nhận thiết bị và lỗi thực tế.
3. Thêm một nhóm Pro/VIP còn hạn vào allowlist có chủ đích, sau khi kiểm tra đầy đủ cổng quyền và khả năng dừng khẩn cấp. Không bỏ cổng hoặc tự mở toàn bộ tài khoản.
4. Chạy pilot mức 1. Đo thời gian từ kết thúc phát biểu đến âm thanh đầu tiên, tỷ lệ lỗi STT/WS, số cuộc gọi hoàn tất, ngắt lời và chi phí/phút. Mục tiêu sản phẩm đề xuất: phản hồi p95 dưới 3 giây, phần lớn cuộc gọi hoàn tất không lỗi kỹ thuật; quyết định ngưỡng chính thức sau khi có baseline.
5. Khi đủ ổn định mới thiết kế mức 2 theo bài học và chốt gói phút bằng chi phí pilot. Không dùng 8/12 phút thử làm quyền thương mại.

## Bộ điều khiển production
Các tên bên dưới là đặc tả đề xuất, không phải giao thức máy chủ đã xác minh.

Trạng thái: connecting → tutor_speaking → ready → learner_listening → transcribing → thinking → tutor_speaking. Có reconnecting, error, ending và ended. ready là chờ học viên chủ động nhấn nói; không tự thu khi chỉ đứng ở màn hình. Nút nói khi gia sư đang nói sẽ hủy phát hiện tại, hủy phần sinh đang chạy và bắt đầu nghe theo quy tắc phiên hiện có.

- Session API trả về thời điểm hết hạn do server quyết định. Client hiển thị dựa trên mốc này; server thực thi giới hạn. Nối lại không khởi tạo đồng hồ mới.
- Nhận dạng dùng Azure qua đường voice-learn hiện hữu. Không nhận dạng bằng trình duyệt khi Azure lỗi.
- Dùng turnId và sequence để bỏ chunk trễ sau ngắt lời/nối lại. Hủy TTS queue và buffer đang phát trước khi mở micro.
- Khi kết thúc phải dừng tracks micro, audio source, timer, pending request và socket; đóng phiên idempotent. Session hết hạn/tính năng tắt đều dừng từ server lẫn client.
- Khi tab ra nền, dừng thu và phát; mốc hết hạn vẫn chạy. Khi quay lại, kiểm tra phiên trước khi mở micro.
- Không đưa token phiên vào URL, nhật ký, localStorage hoặc nội dung tổng kết; chỉ giữ theo cơ chế xác thực hiện hữu.

## CC và transcript
CC là bảng xem hội thoại trong cuộc gọi. aria-pressed phản ánh bật/tắt. Bảng không chiếm toàn màn hình, có nút đóng và không khóa điều khiển micro. Auto-scroll chỉ khi người dùng đang ở cuối; không kéo về cuối khi họ đọc câu cũ. Có tên người nói, chữ interim phân biệt chữ final, không lưu interim vào tổng kết. Khi bị ngắt, hiển thị dấu 'Bị ngắt'; tổng kết dựa vào audio đã phát, không coi toàn bộ văn bản sinh là đã nói. Thêm focus management, Escape và khả năng đọc bằng trình đọc màn hình.

Nghe lại chỉ phát câu gia sư gần nhất đã có âm thanh, không gọi LLM hoặc tạo phiên mới. Không thay đổi lịch sử theo hướng cộng thêm lượt. Không tạm dừng đồng hồ. Nếu hết giờ thì không cho nghe lại trong phiên.

## Hội thoại và nhân vật
Câu chào/câu hỏi đầu lấy từ bài thường được chọn, từ vựng và cấu trúc mức 1. Câu tiếp theo bám câu vừa trả lời, nhớ tên/chi tiết trong phiên và hỏi một câu ngắn. Chấp nhận câu trả lời ngắn. Nếu chưa hiểu: hỏi lại một lần, sau đó đưa hai lựa chọn đơn giản. Không tự khẳng định câu nhận dạng sai là điều học viên muốn nói. Trước hết dùng trí nhớ trong phiên; trí nhớ qua nhiều phiên chỉ triển khai sau khi có cơ chế xem/xóa và chính sách phù hợp.

Animation sản xuất nên dùng tài sản Beego trong Rive hoặc sprite đã có: idle, listening, thinking, speaking, encouraging, goodbye. Miệng theo âm thanh phát thực tế hoặc viseme, không theo lúc LLM bắt đầu sinh. Nếu nguồn âm thanh dừng thì miệng phải dừng. Có chế độ giảm chuyển động. SVG hiện tại chỉ chứng minh bố cục và trạng thái.

## Kiểm tra trước khi mở pilot
- Admin gọi được; allowlist Pro/VIP còn hạn gọi được. Ngoài allowlist, gói trial/hết hạn, chưa đăng nhập, cờ tắt hoặc Redis khác 1 đều bị chặn đúng phía server.
- Bài thường đúng cửa được chọn; bài kiểm tra/ôn bị loại. Cửa khóa không gọi được. Hoàn thành bài gọi đúng bài đó.
- Hai tab không tạo hai phiên hoạt động; reconnect giữ mốc cũ; token hết hạn xử lý rõ ràng.
- Ngắt lời nhanh, nghe lại, CC, hết giờ và kết thúc không để lại micro/âm thanh hoạt động.
- Transcript phân biệt interim/final, thứ tự lượt đúng, câu bị ngắt khớp audio; tổng kết không chấm phát âm/điểm, không cộng XP/Honey.
- Cổng 3031 và luyện nói cũ không bị ảnh hưởng; không dựa vào preview 3118.

## Phần cần tiếp tục ở mã nguồn
Thư mục D:\vibe coding\beego hiện có docs/flows/tools, chưa thấy ứng dụng production. Cần đường dẫn repo/checkout để chuyển thiết kế thành component thật, đọc giao thức API/WS đang chạy, nối state machine và kiểm chứng. Chưa có thay đổi production nào trong lần làm này.
