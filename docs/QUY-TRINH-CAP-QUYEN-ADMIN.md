# Cấp quyền quản trị (không chạy trong request)

Quyền staff nằm ở cột `users.staff_role` (`system_owner`, `support_staff`, `teacher`).

- Request đăng nhập và API **không** tự gán `system_owner`.
- Không còn danh sách email admin trong mã nguồn.
- `ADMIN_EMAILS` chỉ còn dùng cho quyền học/VIP đã cấu hình sẵn (`isAdminUser`), không tạo staff role.

## Cấp owner cho một tài khoản đã tồn tại

Không xóa owner khác.

```bash
docker exec -e GRANT_EMAIL=user@example.com beego-web node scripts/grant-system-owner.mjs
```

## Thu hồi để không bị cấp lại

Đặt `staff_role` về rỗng và thêm email vào `admin_staff_bootstrap_block`. Script grant xóa dòng chặn rồi mới gán lại.

Nếu chưa có owner nào, dùng script trên với email tài khoản đang dùng. Không chạy script nếu không chủ đích đổi đúng email đó.
