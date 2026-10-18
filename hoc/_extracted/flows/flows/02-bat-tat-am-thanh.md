# 02 Bật hoặc tắt âm hiệu ứng

**Mục tiêu:** Cho học viên chủ động lựa chọn âm thanh.

**Phạm vi:** Yêu cầu mục tiêu cho tab Học Beego. Không thay đổi phần gọi gia sư AI.

## Bắt đầu

Học viên đang ở màn hình học có tùy chọn âm.

## Các bước chính

1. Hiển thị trạng thái âm hiệu ứng hiện tại.
2. Học viên chọn bật hoặc tắt.
3. Áp dụng lựa chọn và lưu nếu thiết bị cho phép.
4. Những phản hồi tiếp theo dùng thiết lập vừa chọn.

## Nhánh quyết định

**Có thể phát âm hiệu ứng lúc này không?**

- Có: Phát âm ngắn theo sự kiện khi người dùng đã cho phép.
- Không: Chỉ hiển thị phản hồi bằng hình và chữ.

Hai nhánh là các lựa chọn thay thế, không phải hai bước liên tiếp.

## Kết thúc

Lựa chọn âm được áp dụng, không cản trở học.

## Quy tắc

- Lời đọc bài học và ghi âm được ưu tiên hơn âm hiệu ứng.
- Không phát âm học mới vào cuộc gọi gia sư AI; không sửa hệ thống âm cuộc gọi.
- Nếu thiết bị không lưu được, áp dụng lựa chọn trong phiên hiện tại.

## Tiêu chí kiểm tra

- Tắt âm thì các hiệu ứng sau không phát.
- Đổi câu hoặc thoát bài không để âm cũ tiếp tục.

[Xem bản trực quan](02-bat-tat-am-thanh.html) · [Danh mục luồng](index.html)
