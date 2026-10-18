# 01 Mở tab Học và học tiếp

**Mục tiêu:** Giúp học viên biết ngay nên học bài nào.

**Phạm vi:** Yêu cầu mục tiêu cho tab Học Beego. Không thay đổi phần gọi gia sư AI.

## Bắt đầu

Học viên mở tab Học.

## Các bước chính

1. Tải lộ trình và tiến độ đã lưu.
2. Hiển thị bài tiếp theo, mục tiêu giao tiếp và thời gian dự kiến.
3. Học viên chọn Học tiếp.
4. Mở bài học đúng với tiến độ.

## Nhánh quyết định

**Đã tải được tiến độ chưa?**

- Có: Hiển thị tiến độ thật và bài có thể học.
- Không: Hiển thị thông báo và nút Thử lại; không tự gán tiến độ mới.

Hai nhánh là các lựa chọn thay thế, không phải hai bước liên tiếp.

## Kết thúc

Học viên vào đúng bài được phép học.

## Quy tắc

- Người mới bắt đầu tại bài đầu hoặc điểm xuất phát đã được xếp lớp.
- Người học cũ tiếp tục từ tiến độ thật; không tự đặt lại tiến độ.

## Tiêu chí kiểm tra

- Bài học tiếp phải khớp dữ liệu đã lưu.
- Tải lỗi không dẫn đến màn hình tiến độ giả.

[Xem bản trực quan](01-hoc-tiep.html) · [Danh mục luồng](index.html)
