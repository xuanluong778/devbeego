# 06 Theo dõi mục tiêu ngày và huy hiệu

**Mục tiêu:** Ghi nhận nỗ lực và tạo lý do quay lại học.

**Phạm vi:** Yêu cầu mục tiêu cho tab Học Beego. Không thay đổi phần gọi gia sư AI.

## Bắt đầu

Một hoạt động học đã được ghi nhận.

## Các bước chính

1. Cập nhật tiến độ mục tiêu ngày từ dữ liệu thật.
2. Kiểm tra các mốc nhiệm vụ và huy hiệu.
3. Hiển thị tiến độ hoặc thông báo mốc vừa đạt.
4. Cho chọn học tiếp hoặc nghỉ sau khi đạt mục tiêu.

## Nhánh quyết định

**Có mốc mới vừa được xác nhận không?**

- Có: Ăn mừng ngắn và hiển thị phần thưởng hoặc huy hiệu tương ứng.
- Không: Hiển thị phần còn lại cần làm; không tạo phần thưởng giả.

Hai nhánh là các lựa chọn thay thế, không phải hai bước liên tiếp.

## Kết thúc

Học viên hiểu tiến bộ của ngày học.

## Quy tắc

- Dùng cùng hệ mục tiêu và huy hiệu hiện có, không tạo cách tính thứ hai.
- Ngày học và chuỗi ngày liên tiếp dùng cùng múi giờ của hệ thống.
- Không trách móc khi học viên nghỉ hoặc mất chuỗi ngày học.

## Tiêu chí kiểm tra

- Một mốc không được phát thưởng nhiều lần.
- Thông báo không chồng lên thao tác trả lời câu hỏi.

[Xem bản trực quan](06-muc-tieu-ngay-va-huy-hieu.html) · [Danh mục luồng](index.html)
