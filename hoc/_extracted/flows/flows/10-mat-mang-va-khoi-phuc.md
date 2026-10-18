# 10 Xử lý mất mạng và tiếp tục phiên học

**Mục tiêu:** Giảm mất công sức và tránh ghi nhận kết quả sai khi gặp sự cố.

**Phạm vi:** Yêu cầu mục tiêu cho tab Học Beego. Không thay đổi phần gọi gia sư AI.

## Bắt đầu

Tải bài, gửi câu trả lời hoặc lưu kết quả bị lỗi.

## Các bước chính

1. Thông báo rõ tác vụ chưa được xác nhận.
2. Giữ dữ liệu đã nhập hoặc dữ liệu có thể khôi phục.
3. Cho thử lại khi kết nối trở lại hoặc thoát an toàn.
4. Đối chiếu dữ liệu đã lưu để tiếp tục đúng trạng thái.

## Nhánh quyết định

**Hệ thống đã xác nhận tác vụ trước đó chưa?**

- Có: Dùng kết quả đã ghi nhận, không gửi thưởng hay hoàn thành lần nữa.
- Không: Gửi lại an toàn; khi thành công mới cập nhật tiến độ và phần thưởng.

Hai nhánh là các lựa chọn thay thế, không phải hai bước liên tiếp.

## Kết thúc

Tiếp tục từ trạng thái đáng tin cậy hoặc hướng dẫn rõ phần cần làm lại.

## Quy tắc

- Không hứa học ngoại tuyến đầy đủ nếu chưa triển khai.
- Nếu không thể khôi phục, nói rõ phần cần làm lại; không báo đã lưu.
- Không cộng điểm, trừ kết quả hay mở bài chỉ dựa trên thao tác phía màn hình.

## Tiêu chí kiểm tra

- Mất mạng giữa lúc gửi không gây cộng thưởng trùng.
- Hết phiên đăng nhập có hướng dẫn đăng nhập lại và đối chiếu tiến độ.

[Xem bản trực quan](10-mat-mang-va-khoi-phuc.html) · [Danh mục luồng](index.html)
