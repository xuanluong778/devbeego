# Beego — bản mẫu nâng cấp tab Học trên mobile

## Trạng thái bàn giao

Đã tạo bản mẫu HTML/CSS/JavaScript độc lập. Chưa chỉnh sửa dev.beego.vn, chưa tích hợp backend và chưa build APK/AAB/iOS. Không nên thay trang hiện tại bằng nguyên bản mẫu vì nội dung và tiến độ của bản mẫu chỉ là dữ liệu minh họa.

Mở `beego-learn-preview.html` bằng Chrome hoặc Edge. Tệp này chứa đầy đủ CSS và JavaScript, không cần cài thư viện hay chạy máy chủ. Bấm nút loa để bật hiệu ứng, bấm **Học ngay** để thử bài 3 câu. Nút nghe trong bài chủ động phát giọng đọc tiếng Anh của thiết bị. Giọng đọc phụ thuộc trình duyệt và giọng có sẵn, không phải giọng đã thu riêng cho Beego.

## Đối chiếu video và trang hiện tại

Video `lo-trinh-hoc.wmv` dài 974,635 giây, khoảng 16 phút 15 giây. Đã trích và xem các khung hình định kỳ trên toàn bộ thời lượng để đối chiếu thiết kế. Chưa nghe và đánh giá toàn bộ phần âm thanh gốc; các hiệu ứng trong bản mẫu được tạo mới, không trích lại từ video.

Những đặc điểm nhìn thấy trong video:

- Nền trắng và khoảng trống rộng để tập trung vào một câu hỏi.
- Nút xanh lá có cạnh dưới tạo cảm giác nổi; xanh dương dùng cho nghe, phát âm và lựa chọn.
- Nhân vật hoạt hình đứng cạnh bong bóng hội thoại.
- Thanh tiến độ chạy theo từng câu; phản hồi đúng màu xanh và sai màu đỏ.
- Màn hình phần thưởng, nhiệm vụ hằng ngày và rương quà.
- Lộ trình có các nút tròn uốn lượn, chặng tím hoặc xanh lá.

Trang dev.beego.vn đã mở được trên trình duyệt: thấy tiêu đề tím–xanh, khối chặng xanh lá, nút tròn bắt đầu, thẻ Học tiếp và thanh điều hướng dưới. Một số biểu tượng tại khung hình quan sát hiện thành ô vuông; cần kiểm tra cách render icon, font, và SVG ở đúng bản build trước khi kết luận nguyên nhân.

Bản mẫu giữ cách dùng màu và nhịp tương tác của video, dùng ong SVG riêng cho Beego. Không sao chép nhân vật của sản phẩm tham chiếu.

## Phần đã hoạt động trong bản mẫu

- Lộ trình, nút bài học, chỉ dẫn và trạng thái khóa minh họa.
- Ong bay nhẹ, cánh chuyển động, nhãn bắt đầu và nút bấm có phản hồi.
- Bài học 3 câu: chọn nghĩa, nghe–chọn, hoàn thành hội thoại.
- Kiểm tra đúng/sai, giải thích, tiến độ và kết quả bài.
- Hiệu ứng tổng hợp bằng Web Audio cho thao tác, đáp án đúng/sai và phần thưởng.
- Không tự phát hiệu ứng trước khi người dùng bật; nút nghe vẫn phát khi người dùng chủ động yêu cầu.
- Cập nhật Honey và nhiệm vụ mẫu trong bộ nhớ; làm lại không cộng thưởng lặp trong cùng phiên xem.
- Điều hướng bàn phím, nhãn hỗ trợ đọc màn hình, dialog có focus và tôn trọng giảm chuyển động.
- Bố cục đổi theo chiều rộng; mobile có thanh điều hướng dưới và nút học, desktop có cột bên.

Các mục Luyện nói, Từ vựng, Tiến độ chỉ mở thông báo phạm vi bản mẫu. Chưa nhận âm thanh microphone, chấm phát âm, gọi AI, lưu tài khoản, đồng bộ tiến độ hoặc tải bài offline.

## Hướng tích hợp vào dự án hiện có

Đã đọc cấu trúc tham chiếu trong bản backup Beego tìm thấy trên máy: Next.js, React, Capacitor; `LearnPage`, `LearnHeader`, các thành phần lộ trình và lesson player. Chưa xác nhận bản backup này khớp bản chạy trên dev.

1. Đối chiếu commit và đọc AGENTS.md của repository đang triển khai. Giữ nguyên API, lesson ID, nội dung giáo trình và tính toán tiến độ hiện có.
2. Tách ong SVG thành component dùng lại, với trạng thái idle, đang nghe, khích lệ, hoàn thành. Dùng SVG/icon chuẩn thay biểu tượng phụ thuộc font. Dừng hoạt ảnh khi offscreen và khi người dùng yêu cầu giảm chuyển động.
3. Dùng biến màu chung: xanh hành động `#58CC02`, tím chặng `#9064E8`, xanh nghe `#19A9E5`, vàng Honey `#FFC944`; chữ nội dung chính `#273A37`. Dùng xanh đậm hơn cho chữ trên nền trắng. Đo tương phản từng cặp chữ/nền trước khi phát hành; không chỉ dùng màu để báo đúng/sai.
4. Tích hợp audio service dùng chung vào sự kiện lesson player đã chấm đáp án. Phân biệt âm hiệu ứng với giọng bài học, tránh phát chồng khi TTS hoặc microphone hoạt động. Cài đặt âm thanh cần được lưu theo tài khoản hoặc thiết bị; bản mẫu chưa lưu cài đặt.
5. Nối màn hình phần thưởng với phản hồi hoàn thành bài từ server. Điểm, Honey, mở khóa và phần thưởng phải do backend xác nhận và chống cộng lặp, không lấy state của bản mẫu làm dữ liệu thật.
6. Mobile: dùng safe-area, dynamic viewport, khoảng trống cho thanh điều hướng, vùng chạm tối thiểu 44–48px. Khi bàn phím mở, bảo đảm đáp án/nút tiếp tục không bị che. Khi vào bài học, ẩn thanh điều hướng lộ trình để tránh chồng UI.
7. Với Capacitor: kiểm tra nút Back Android, resume/pause, mất mạng, quyền microphone trong chức năng luyện nói thật và audio focus khi có cuộc gọi. Chỉ thêm haptic nhẹ ở bước hoàn thành quan trọng nếu thiết bị và tùy chọn người dùng cho phép.

## Kiểm tra trước khi đưa lên dev

- 320, 360, 390, 430, 768 và 1440px; portrait/landscape; phóng chữ 200%; bàn phím ảo; tai thỏ và thanh home.
- Đúng/sai, thử lại, thoát giữa bài, học tiếp, hoàn thành, khóa/mở bài theo server.
- Tắt tiếng thực sự ngừng hiệu ứng; giọng đọc không chồng; chuyển app dừng âm; thiếu hỗ trợ audio có phản hồi rõ.
- Android WebView và Safari iPhone thật; chạm nhanh nhiều lần không cộng điểm lặp hoặc gửi request trùng.
- Dữ liệu thật không bị thay bằng các chỉ số minh họa trong bản mẫu.

## Giới hạn xác minh của lần bàn giao

JavaScript đã kiểm tra cú pháp bằng `node --check`. Chưa xác minh trực quan và tương tác trên trình duyệt hoặc thiết bị thật: máy chủ xem trước không phản hồi, và phiên truy cập Chrome không hoàn tất. Chưa xác minh giọng đọc hoặc chất lượng âm thanh bằng nghe thực tế. Các mục kiểm tra ở trên là việc cần làm trước khi phát hành, không phải kết quả đã đạt.
