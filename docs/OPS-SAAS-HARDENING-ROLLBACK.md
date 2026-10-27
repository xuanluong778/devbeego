# Vận hành: hardening SaaS (dev) — triển khai & rollback

**Phạm vi thay đổi:** bảo mật edge (CSRF/rate limit), pool MySQL, Redis rate-limit ổn định hơn, admin bootstrap từ env. **Không đổi UI/tính năng.**

---

## 1. Vấn đề đã xác minh

| # | Vấn đề | Nguồn xác minh |
|---|--------|----------------|
| 1 | POST `/api/admin/*` không có CSRF Origin khi dùng cookie staff | Grep `assertMutationOrigin` trên `app/api/admin` → không có; báo cáo SaaS §6 |
| 2 | Admin/org API không rate-limit tại edge | Chỉ auth/TTS/learn có limit; admin phụ thuộc handler |
| 3 | `parseAdminEmails()` fallback email trong repo khi thiếu env | `lib/auth/is-admin-user.ts` — production Docker **có** `ADMIN_EMAILS` trong `.env.docker` |
| 4 | Bootstrap `system_owner` chạy cả khi chỉ có fallback dev | `ensure-student-admin-schema.ts` dùng `parseAdminEmails()` |
| 5 | Redis rate-limit vô hiệu vĩnh viễn sau lỗi kết nối | `redis-rate-limit.js` set `redisFailed=true` |
| 6 | Pool MySQL mặc định 10 connection, không keep-alive | `lib/db.js` |

**Chưa xử lý trong đợt này (cần thay đổi sản phẩm / kiến trúc):** lộ trình admin → app học, multi-tenant, load test số liệu.

---

## 2. Thay đổi đã làm

| File | Thay đổi |
|------|----------|
| `middleware.ts` | CSRF + IP rate limit cho `/api/admin/*`, `/api/org/*` mutation; read limit GET admin/org |
| `lib/security/csrf-origin.js` | Origins từ `ALLOWED_APP_ORIGINS` (env) |
| `lib/security/app-allowed-origins.js` | **Mới** — parse origins env |
| `lib/auth/is-admin-user.ts` | Production: không fallback `DEFAULT_ADMIN_EMAILS`; `parseAdminEmailsFromEnvOnly()` |
| `lib/admin/ensure-student-admin-schema.ts` | Bootstrap staff chỉ email từ env |
| `lib/db.js` | `DB_CONNECTION_LIMIT` default 20, `enableKeepAlive` |
| `lib/security/redis-rate-limit.js` | Bỏ cờ fail vĩnh viễn; retry strategy |

### Biến môi trường (tùy chọn)

| Biến | Mặc định | Ý nghĩa |
|------|----------|---------|
| `ADMIN_EMAILS` | *(bắt buộc prod)* | Admin + bootstrap system_owner |
| `ALLOWED_APP_ORIGINS` | — | Thêm origin CSRF (SaaS domain sau này) |
| `DB_CONNECTION_LIMIT` | `20` | Pool MySQL |
| `EDGE_ADMIN_MUTATION_RATE_MAX` | `90` | POST admin/org/phút/IP (edge) |
| `EDGE_ADMIN_READ_RATE_MAX` | `240` | GET admin/org/phút/IP (edge) |

---

## 3. Kiểm tra

```bash
# Build
cd /var/www/beego_vn_usr/data/docker/beego
docker compose -p beego build web

# Triển khai (dev)
docker compose -p beego up -d --force-recreate web
curl -fsS http://127.0.0.1:3025/api/health

# Smoke hardening
docker exec beego-web node scripts/test-saas-hardening-smoke.mjs
# hoặc trên host:
BASE=http://127.0.0.1:3025 node scripts/test-saas-hardening-smoke.mjs
```

**Kỳ vọng:** health OK; POST admin với cookie giả + không Origin → **403** `CSRF_ORIGIN`.  
**Regression thủ công:** đăng nhập admin trên `https://dev.beego.vn`, lưu nháp lộ trình, gia hạn Pro (same-origin → Origin hợp lệ).

**Không chạy:** load test, migration DB, thay đổi production ngoài dev trừ khi được phép.

---

## 4. Triển khai dev (chuẩn repo)

```bash
rsync -aH --exclude node_modules --exclude .next --exclude .git \
  /var/www/dev_beego_vn_usr/data/www/dev.beego.vn/ \
  /var/www/beego_vn_usr/data/docker/beego/

cd /var/www/beego_vn_usr/data/docker/beego
docker compose -p beego build web
docker compose -p beego up -d --force-recreate web
docker exec beego-redis redis-cli SET voice:learn-call-gate 1
```

Xác nhận `.env.docker` vẫn có `ADMIN_EMAILS=...` (đã có trên dev).

---

## 5. Rollback

1. **Git:** revert commit hardening (hoặc khôi phục file từ backup tar trước deploy).
2. **Nhanh (chỉ middleware):** tạm comment block `isStaffOrBillingMutationPath` trong `middleware.ts`, build + recreate web.
3. **Pool DB:** đặt `DB_CONNECTION_LIMIT=10` trong `.env.docker` nếu cần hành vi cũ.
4. **Redis limiter:** rollback `lib/security/redis-rate-limit.js` nếu Redis báo lỗi bất thường (hiếm).

Không cần migration DB; không xóa dữ liệu.

---

## 6. Rủi ro còn lại

- Rate limit edge **theo process** (một container web = ổn; nhiều replica cần Redis limiter ở handler — chưa bật thêm để tránh double-limit).
- CSRF không áp dụng khi **không** có cookie (Bearer mobile vẫn qua).
- **Chưa đo** RPS/concurrent users — không khẳng định tăng chịu tải.
- Các mục P0 báo cáo SaaS (path → học viên, tenant) **chưa** thuộc phạm vi hardening này.

---

*Cập nhật: 2026-10-25*
