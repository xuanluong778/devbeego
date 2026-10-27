# Nghiệm thu bước 1 — hardening dev.beego.vn

**Ngày:** 2026-10-25  
**Môi trường:** `dev` (container `beego-web`), không production, không load test, không migration production.  
**Lệnh:** `docker exec beego-web node --experimental-detect-module scripts/test-acceptance-step1.mjs`  
**Kết quả script:** 15 PASS, 0 FAIL.

---

## 1. Kiểm kê quyền API

`requireAdminUser` **không** còn tương đương “có staff guard”. Teacher có `admin.access` nhưng `requireAdminUser` trả `null` nếu `staffRole === "teacher"` (legacy payments/users/settings không mở cho giáo viên).

| Nhóm | Endpoint | Quyền hành động | Phạm vi dữ liệu | Kết luận |
|------|----------|-----------------|-----------------|----------|
| Học viên | `GET /api/admin/students` | `students.list` | Teacher: SQL `admin_teacher_student_scope` | PASS (đọc mã `listStudents`) |
| Học viên | `GET /api/admin/students/[id]` | `students.view` | `getStudentProfile` + `teacherCanAccessStudent` | PASS (đọc mã) |
| Học viên | `PATCH .../students/[id]` | `students.edit` | Thêm `teacherCanAccessStudent` trước khi sửa | PASS (mã); **CHƯA** gọi bằng session giáo viên thật |
| Học viên | `POST .../notes`, `POST .../block` | `notes.write` / `students.lock` | Thêm kiểm tra scope (trước đó ghi chú **không** kiểm scope) | PASS (mã); **CHƯA** session giáo viên thật |
| Học viên | `GET/POST .../path`, `.../pro` | permission riêng từng action | `teacherCanAccessStudent` | PASS (đọc mã) |
| Lộ trình mẫu | templates, catalog | `paths.templates.*` / `paths.catalog.read` | Không gắn học viên | PASS (đọc mã). Teacher không có write/publish |
| Dashboard | `GET /api/admin/dashboard` | `dashboard.read` | Teacher: filter scope | PASS (đọc mã) |
| Phạm vi GV | `/api/admin/teacher-scope` | `teacher.scope.manage` | Owner/support | PASS (đọc mã) |
| Legacy | users, payments, overview, listening, vocabulary images, import, app-settings, voice quota, activate/extend plan | `requireAdminUser` = staff **không** phải teacher | Không lọc từng học viên (toàn bộ học viên với owner/support) | PASS (chặn teacher trong mã). **CHƯA** session giáo viên thật |
| Org | `/api/org/**` | Session + `isOrgStaff` / `isOrgOwner` theo organization | `isSystemAdmin` (role admin) bỏ qua membership | PASS (đọc mã). **CHƯA** IDOR live |
| Dữ liệu cá nhân | `GET/POST /api/progress` | Session user; POST ghi `user.id`, không nhận `user_id` client | Chủ sở hữu session | PASS (đọc mã) |
| Auth | `POST /api/auth/login` | Rate limit | `is_active = 0` → 403 `Account blocked` (khớp `/api/auth/token`) | PASS (mã). **CHƯA** đăng nhập tài khoản bị khóa trên UI |

---

## 2. CSRF và Bearer

**Đã xác minh lỗ trước khi sửa:** `assertMutationOrigin` bỏ qua kiểm tra nếu có header `Authorization: Bearer …`, trong khi `resolveSessionToken` ưu tiên **cookie**. Cookie + Bearer giả = bỏ CSRF và vẫn dùng cookie.

**Đã sửa:**

- Có cookie → luôn kiểm Origin/Referer, kể cả khi kèm Bearer.
- Có Bearer → token đó là duy nhất; Bearer không hợp lệ **không** rơi về cookie.

| Case | Kết quả | Bằng chứng |
|------|---------|------------|
| Cookie, thiếu Origin | **PASS** | 403 `CSRF_ORIGIN` |
| Cookie, Origin lạ | **PASS** | 403 `CSRF_ORIGIN` |
| Cookie + Bearer giả, thiếu Origin | **PASS** | 403 `CSRF_ORIGIN` (không bypass) |
| Cookie + Bearer giả, Origin `https://dev.beego.vn` | **PASS** | 403 (không tạo lộ trình; không dùng cookie) |
| Chỉ Bearer giả, không cookie | **PASS** | Không `CSRF_ORIGIN` (403 auth) |
| Cookie owner thật, không Bearer | **PASS** | `GET /api/admin/staff/me` 200 |
| Webhook Stripe / SePay không Origin | **PASS** | Không 403 CSRF (Stripe 400, SePay 503 — lỗi chữ ký/cấu hình sẵn, không phải CSRF) |
| App mobile Bearer hợp lệ trên thiết bị | **CHƯA KIỂM CHỨNG** | Không có client Android trong phiên này |

---

## 3. Rate limit và Redis

| Hạng mục | Kết quả | Bằng chứng |
|----------|---------|------------|
| Vượt ngưỡng trả từ chối + `retryAfterSec` | **PASS** | Unit `checkIpRateLimit` max=2, window 2s → `ok=false`, `retryAfterSec=2` |
| HTTP 429 trên middleware (90 req/phút) | **CHƯA KIỂM CHỨNG** | Không bắn 91 request lên dev (tránh khóa IP admin). Logic middleware gọi cùng hàm đã unit-test |
| IP sau proxy | **PASS** | `X-Real-IP` được ưu tiên hơn `X-Forwarded-For` → `203.0.113.9` |
| Redis nhiều replica | **PASS** (chuẩn bị) / **CHƯA** (live nhiều replica) | `checkRateLimit`: Redis allow/deny là kết quả cuối, **không** cộng thêm memory. Redis lỗi → một lần memory, request sau thử Redis lại. Middleware Next là Edge nên **không** nhúng ioredis; limit edge admin vẫn theo process. Dev hiện **1** replica `web` |
| TTL Redis | **PASS** | `INCR` + `EXPIRE 3` → `TTL` = 3, sau đó xóa key probe |
| Cố tình tắt Redis rồi phục hồi | **CHƯA KIỂM CHỨNG** | Không dừng Redis đang phục vụ voice |

---

## 4. Bootstrap owner

| Hạng mục | Kết quả | Bằng chứng |
|----------|---------|------------|
| Email nằm trong `admin_staff_bootstrap_block` không được set `system_owner` | **PASS** | Transaction probe + rollback, `affectedRows=0` |
| Owner hiện tại không bị gỡ | **PASS** | user id 3 vẫn `staff_role=system_owner` sau kiểm tra |
| Cấp owner có kiểm soát, ngoài request | **PASS** (công cụ) | `scripts/grant-system-owner.mjs` với `GRANT_EMAIL` — **chưa chạy** lên user thật trong phiên này |
| Session email allowlist khi `staff_role` rỗng và đã block | **PASS** (mã) | `resolveStaffSession` không nâng owner nếu không có role tường minh và email bị block |

Thu hồi có kiểm soát: set `staff_role` về rỗng **và** thêm email vào `admin_staff_bootstrap_block`. Không có nút UI mới.

---

## 5. Session, secrets, dependency, upload

| Hạng mục | Kết quả |
|----------|---------|
| Session hết hạn / `revoked_at` | **PASS** (mã `get-session-user.ts`) — **CHƯA** thử token hết hạn live |
| Khóa tài khoản web login | **PASS** (mã, cùng thông báo với token API) — **CHƯA** live |
| JWT voice | **CHƯA KIỂM CHỨNG** hết hạn/chữ ký trong phiên này |
| Secrets trong báo cáo/log nghiệm thu | **PASS** — script không in token/mật khẩu |
| Email admin mặc định trong source khi thiếu env ở production | **PASS** (đã khóa ở bước hardening trước; dev vẫn có `ADMIN_EMAILS`) |
| `npm audit` từng CVE | **CHƯA KIỂM CHỨNG** |
| Upload `/uploads/` public | **CHƯA KIỂM CHỨNG** nội dung file trên đĩa |

---

## 6. Pool MySQL

| Hạng mục | Kết quả |
|----------|---------|
| Coi 10→20 là tối ưu | **FAIL** nếu giữ 20 — không có số đo. **Đã trả mặc định 10** |
| Đối chiếu | `max_connections=151`. Lúc lấy mẫu `processlist` = 2. Một container `web` + worker voice dùng chung DB. Phần dự phòng chưa đo dưới tải |
| Override | `DB_CONNECTION_LIMIT` trong env |

---

## Triển khai và rollback (dev)

Đã build và recreate **chỉ** `beego-web` trên dev để chạy nghiệm thu.

Rollback: revert các file `middleware.ts`, `lib/security/*`, `lib/auth/resolve-session-token.ts`, `lib/admin/require-admin.ts`, `lib/admin/require-staff.ts`, `lib/admin/ensure-student-admin-schema.ts`, `lib/db.js`, `app/api/auth/login/route.js`, route notes/block/student patch; build lại image trước đó. Không có migration phá dữ liệu. Bảng `admin_staff_bootstrap_block` có thể để trống.

**Không** triển khai production trong phiên này.
