# Báo cáo tổng quan — dev.beego.vn (SaaS readiness)

**Ngày lập:** 2026-10-25  
**Phạm vi:** Mã nguồn tại `/var/www/dev_beego_vn_usr/data/www/dev.beego.vn`  
**Môi trường tham chiếu:** `https://dev.beego.vn` (Docker `beego-app`, MySQL, Redis, voice workers)  
**Lưu ý:** Báo cáo **chỉ đánh giá**, **không thay đổi mã** trong phiên lập báo cáo.

---

## 1. Tóm tắt điều hành

Beego là **ứng dụng học tiếng Anh full-stack** (Next.js 14 + MySQL + Redis + WebSocket voice/AI), có **lộ trình curriculum-50**, luyện nói/nghe, từ vựng, quiz, Kids, billing (Stripe/SePay/Google Play), và **khu vực quản trị học viên** đang được modernize (RBAC, lộ trình mẫu, Pro, dashboard).

Để **SaaS hóa tốt** (multi-tenant, bảo mật, vận hành, doanh thu), các hạng mục **ưu tiên cao nhất** hiện tại:

| Ưu tiên | Hạng mục | Lý do |
|--------|-----------|--------|
| **P0** | **Lộ trình admin chưa điều khiển app học viên** | Gán lộ trình chỉ có trên admin; UI `/` vẫn curriculum-50 mặc định |
| **P0** | **Hai hệ quản trị song song (RBAC mới vs legacy admin)** | API/UI legacy (`requireAdminUser`, `/admin/tong-quan`) ≠ phân quyền chi tiết |
| **P0** | **Multi-tenant / org chưa gắn billing & admin** | Có `organizations` API nhưng chưa mô hình SaaS tenant |
| **P1** | **Admin mutation không CSRF** | Cookie session + POST admin không `assertMutationOrigin` |
| **P1** | **Allowlist admin email hardcode + bootstrap `system_owner`** | Rủi ro leo quyền khi clone repo / thiếu env |
| **P1** | **Google Play verify / RTDN** | Audit cũ: production cần verify API trước khi bật Play billing |
| **P2** | **Migration schema runtime (`ensure*Schema`)** | Khó audit DB giữa môi trường, rollback, compliance |
| **P2** | **UI phạm vi giáo viên, chỉnh lộ trình cá nhân (add/remove bài)** | API có, UI thiếu |
| **P2** | **Legacy kích hoạt gói** (`/api/admin/users/.../activate-plan`) | Bỏ qua ledger Pro mới, không thống nhất audit |

---

## 2. Stack kỹ thuật (source & runtime)

### 2.1 Frontend / app shell

| Thành phần | Chi tiết |
|------------|----------|
| Framework | **Next.js 14.2** (App Router), **React 18** |
| Ngôn ngữ | JavaScript + TypeScript (admin, billing, org, một phần API) |
| Mobile | **Capacitor 6** (Android), Bearer token + cookie hybrid |
| UI học | Component tree `components/beego/*`, CSS module / global |
| Nav | `BottomNav` + sidebar (`lib/beego/nav.js`) |

### 2.2 Backend (trong Next.js + workers)

| Thành phần | Chi tiết |
|------------|----------|
| API | ~**121** route handlers dưới `app/api/**` |
| DB | **MySQL 8** (`mysql2`), bảng users, subscriptions, progress, payments, admin_* |
| Cache / queue | **Redis** (`ioredis`, BullMQ cho voice) |
| Auth | Cookie `session_token`, JWT Bearer (mobile), Google OAuth |
| Email / SMS | SendGrid, Nodemailer, Twilio (OTP) |
| Thanh toán | **Stripe**, **SePay**, Google Play (một phần) |
| AI / giọng | Azure Speech SDK, WS gateway (`voice-ws-gateway`, LLM/TTS workers) |
| Nội dung học | `lib/beego/learn/curriculum-50`, integrated lessons, learning-path-progress |

### 2.3 Hạ tầng triển khai (dev)

| Thành phần | Chi tiết |
|------------|----------|
| Container | `docker-compose`: `web`, `mysql`, `redis`, `voice-gateway`, `voice-llm`, `voice-tts`, … |
| Image | `beego-app:latest`, build `npm run build` trong Dockerfile |
| Public URL | `NEXT_PUBLIC_APP_URL=https://dev.beego.vn` |
| Edge | Nginx reverse proxy → `127.0.0.1:3025` |

### 2.4 Scripts & vận hành

- Health: `/api/health`, `/api/health/db` (prod cần `DB_PING_SECRET`)
- Test học: `scripts/test-learn-phase*.mjs`, admin path/pro smoke scripts
- Tài liệu: `docs/BEEGO_SECURITY_AUDIT.md`, `docs/phuong-an-deploy-dev.md`

---

## 3. Bản đồ tab / màn hình — **ứng dụng học viên** (dev.beego.vn)

### 3.1 Thanh dưới (mobile) — 5 mục cố định

| Tab | Route | Mô tả ngắn |
|-----|-------|------------|
| **Học** | `/` | Lộ trình curriculum-50, bài học, thi vượt cửa, AI call (gate Redis) |
| **Luyện nói** | `/luyen-noi` | Speaking / grammar hub |
| **Từ vựng** | `/vocabulary` | SRS, topic, gán từ (một phần org) |
| **Tiến độ** | `/progress` | XP, streak, thống kê cá nhân |
| **Thêm** | Sheet | Mở menu phụ (xem bảng dưới) |

### 3.2 Menu **Thêm** (nhóm)

**Học tập:** Luyện nghe (`/luyen-nghe`), Luyện phát âm (`/pronunciation`), Quiz (`/quiz`), Câu chuyện (`/kids-fun-stories`), Từ điển (`/dictionary`).

**Kids:** `/kids`, `/kids/games`, `/kids/ai-teacher`.

**Tài khoản:** `/account` (gói/thanh toán), onboarding/cài đặt (`/onboarding`).

### 3.3 Sidebar (tablet/desktop)

Học, Luyện nói, Từ vựng, Câu truyện, Phát âm, Ngữ pháp (→ luyện nói), Luyện nghe, Quiz, Tiến độ, Tài khoản.

### 3.4 Trang chính khác (không trên bottom bar)

| Route | Vai trò |
|-------|---------|
| `/dashboard` | Dashboard **cá nhân** học viên (`/api/dashboard/me`) |
| `/learn/lesson/[lessonId]` | Player bài học chi tiết |
| `/auth` | Đăng nhập / đăng ký / OAuth |
| `/billing/*` | Stripe/SePay return |
| `/teacher` | Portal org (lớp, giao bài từ vựng) — **khác** admin staff |
| `/tracks/[trackId]` | Track marketing (vd. Kids) |
| Kids vocabulary | `/kids-learn-vocabulary`, `/kids-fun-stories/[storyId]` |

### 3.5 Tab / vùng nội bộ trang **Học** (`/`)

- Bản đồ **cửa / chương / bài** (curriculum-50)
- Panel phải: streak, honey, daily goal, nhiệm vụ ngày
- Placement, Today for you, Achievements
- Sheet bắt đầu bài / thi; **Learn Call** (WebSocket, gate `voice:learn-call-gate`)
- Tiến độ thật: `user_lesson_progress`, complete API (không tính xong khi chỉ mở bài)

---

## 4. Bản đồ **Quản trị** (`/admin/*`)

### 4.1 Menu sidebar admin (mới)

| Menu | Route | Trạng thái |
|------|-------|------------|
| **Dashboard** | `/admin/dashboard` | Chỉ số học viên & Pro (RBAC `dashboard.read`) |
| **Học viên** | `/admin/students` | Danh sách, lọc, RBAC + teacher scope |
| **Lộ trình mẫu** | `/admin/paths`, `/admin/paths/[id]` | Draft/publish, sắp xếp bài catalog-50 |
| **Tổng quan** | `/admin/tong-quan` | **Legacy** `AdminDashboard` (users/plans/payments…) |
| **Thanh toán** | `/admin/payments` | Xác nhận chuyển khoản (legacy auth) |
| **Cài đặt** | `/admin/options` | App settings |

**Legacy bổ sung:** `/admin/users/[id]`, `/admin/listening`, `/admin/vocabulary-images`.

### 4.2 Tab hồ sơ học viên `/admin/students/[id]`

| Tab | Nội dung | Hoàn thiện |
|-----|----------|------------|
| **Thông tin** | Sửa tên/SĐT, khóa TK, lý do audit | ✅ |
| **Ghi chú nội bộ** | CRUD ghi chú staff | ✅ |
| **Lịch sử quản trị** | `admin_audit_log` | ✅ (path + pro actions) |
| **Lộ trình** | Gán mẫu, preview tiến độ, áp dụng cập nhật mẫu | ⚠️ Admin-only; **chưa filter app học** |
| **Gói Pro** | Xem/gia hạn/thu hồi, ledger, preview thời hạn | ✅ (tab mới); legacy API vẫn tồn tại |

---

## 5. Tính năng tổng thể (module)

| Module | Mô tả | Mức hoàn thiện |
|--------|--------|----------------|
| **Curriculum-50 & lesson player** | 50 cửa, bài + thi, chấm Azure, IPA | **Production-ready** trên dev |
| **Learning path progress** | Khóa/mở cửa, complete có điều kiện | **Cao** |
| **Voice / Learn Call** | WS, quota, workers | **Cao** (phụ thuộc Redis gate & Azure) |
| **Từ vựng & review** | SRS, quiz | **Cao** |
| **Kids track** | Hub, games, stories | **Trung bình** (tách brand) |
| **Billing** | Stripe webhook, SePay IPN, trial 15 ngày | **Trung bình** (Play chưa đủ) |
| **Org / teacher** | Organizations, classrooms, assignments | **API có**, UI `/teacher`, **chưa SaaS tenant** |
| **Admin học viên v2** | RBAC, notes, audit, path template, Pro, dashboard | **Đang triển khai** (~70%) |
| **Admin legacy** | Users list, overview, payments confirm | **Song song**, cần hợp nhất |
| **Đa tenant SaaS** | Tenant isolation, subdomain, plan per org | **Chưa** |

---

## 6. Lỗ hổng & rủi ro bảo mật (ưu tiên)

> Tham chiếu thêm: `docs/BEEGO_SECURITY_AUDIT.md` (Phase 1). Dưới đây là **tổng hợp cập nhật** cho góc nhìn SaaS.

### 6.1 Critical / High (cần xử lý trước khi SaaS công khai)

1. **Phân quyền admin không thống nhất**  
   - Route mới: `requireStaffPermission` + `staff_role`.  
   - Route cũ: `requireAdminUser` + `ADMIN_EMAILS` / `role=admin`.  
   - **Rủi ro:** Lệch quyền, bypass RBAC qua endpoint legacy, khó chứng minh compliance.

2. **Email admin mặc định trong source** (`lib/auth/is-admin-user.ts`)  
   - `DEFAULT_ADMIN_EMAILS` hardcode nếu thiếu env.  
   - **Rủi ro:** Clone repo → quyền owner trên môi trường mới.

3. **Bootstrap `system_owner` từ ADMIN_EMAILS** (`ensure-student-admin-schema`)  
   - Tự gán role khi schema ensure.  
   - **Rủi ro:** Nhầm env production/staging.

4. **Admin POST không kiểm tra CSRF Origin**  
   - `app/api/admin/**` không dùng `assertMutationOrigin`.  
   - **Rủi ro:** CSRF trên trình duyệt staff (mitigate một phần bởi SameSite; không đủ cho SaaS).

5. **Middleware: nhiều API “public”**  
   - API không bị chặn ở edge; phụ thuộc handler.  
   - **Rủi ro:** Route mới quên auth → lộ dữ liệu (cần checklist CI).

6. **Google Play billing** (audit cũ **C3/H**)  
   - Verify purchase / RTDN chưa đủ cho production subscription lifecycle.

7. **Client-trust scoring** (Medium nhưng quan trọng sản phẩm)  
   - `review/result`, một phần progress — client gửi kết quả.  
   - **Rủi ro:** Gian lận XP (ảnh hưởng gamification, không phải tiền trực tiếp).

### 6.2 Medium

- **Không rate-limit toàn bộ admin API** (chỉ một số route học/auth/TTS).  
- **`/uploads/` public** — cần policy upload + antivirus/scan.  
- **`GET /api/learning-path` public** (middleware) — lộ cấu trúc curriculum (IP).  
- **Voice JWT / quota** — cần review định kỳ secret rotation.  
- **Health endpoints** — `/api/health` public (chấp nhận được); `/api/health/db` cần secret prod (đã có logic).  
- **CSRF allowlist origin cố định** — SaaS custom domain phải mở rộng `csrf-origin.js` + env.

### 6.3 Low / vận hành

- Scraping quiz/dictionary/listening (chi phí CDN, không phải breach).  
- Dependency vulnerabilities (`npm audit` high/critical trong Docker build log).  
- Thiếu CSP/HSTS đồng nhất trên mọi vhost (kiểm tra Nginx riêng).

---

## 7. Tính năng chưa hoàn thiện — **hạng mục quan trọng cho SaaS**

### 7.1 P0 — Blocker SaaS

| # | Hạng mục | Hiện trạng | Cần làm |
|---|----------|-------------|---------|
| 1 | **Lộ trình gán cho học viên ↔ app học** | Admin snapshot `admin_student_path_*`; **không** đọc trong `lib/beego/learning-path*` | Filter/sắp xếp bài trên `/` theo assignment; optional fallback policy |
| 2 | **Single-tenant → multi-tenant** | Bảng `organizations` cho vocab/teacher; **không** tách subscription, admin, domain | Model tenant_id, billing per tenant, data isolation |
| 3 | **Hợp nhất admin** | 2 UI + 2 auth pattern | Deprecate `/admin/tong-quan`, `/admin/users/*`; map legacy → RBAC |
| 4 | **Secrets & admin bootstrap** | Hardcode email, runtime ALTER | Env-only, zero default admin in git, migration có version |

### 7.2 P1 — Cần sớm sau P0

| # | Hạng mục | Ghi chú |
|---|----------|---------|
| 5 | **UI phạm vi giáo viên** | API `POST /api/admin/teacher-scope`, chưa có trang |
| 6 | **Chỉnh lộ trình cá nhân (add/remove bài)** | API `personal_update`; UI chỉ goal/due |
| 7 | **Thống nhất Pro** | Chặn hoặc redirect legacy `activate-plan` / `extend-plan` → ledger |
| 8 | **Doanh thu vs quyền** | Ledger `counts_as_revenue` — báo cáo dashboard chưa tách doanh thu thật |
| 9 | **Google Play + Stripe lifecycle** | Hủy/gia hạn/hết hạn đồng bộ webhook đầy đủ |
| 10 | **CSRF + rate limit admin** | Origin check + Redis limit trên `/api/admin/*` |

### 7.3 P2 — Trải nghiệm & scale

| # | Hạng mục |
|---|----------|
| 11 | Migration SQL có phiên bản (Flyway/Liquibase/custom), bỏ `ensure*Schema` im lặng |
| 12 | Dashboard admin: export CSV, cohort, retention, MRR (hiện chỉ counter cơ bản) |
| 13 | Teacher portal `/teacher` gắn RBAC staff `teacher` thay vì org admin riêng |
| 14 | Observability: structured log, audit export, alert Pro sắp hết hạn |
| 15 | E2E test: tìm HV → gán path → Pro → học → thu hồi (automated) |
| 16 | White-label: logo, màu, `NEXT_PUBLIC_*`, email template theo tenant |
| 17 | GDPR/xóa tài khoản, export dữ liệu học viên |

---

## 8. Đối chiếu yêu cầu SaaS “tốt nhất”

| Trụ cột SaaS | Đánh giá dev.beego.vn |
|--------------|------------------------|
| **Identity & RBAC** | ⚠️ Có RBAC staff mới; legacy admin + org roles chưa hợp nhất |
| **Billing & entitlements** | ⚠️ Pro/VIP/trial có; ledger admin tốt; thiếu tenant billing |
| **Configurable product** | ⚠️ Path template admin; **chưa** áp vào trải nghiệm học |
| **Security baseline** | ⚠️ Phase 1 audit đã fix nhiều; admin CSRF, multi-instance rate limit còn thiếu |
| **Ops & migrations** | ⚠️ Docker ổn; schema runtime ensure khó scale nhiều env |
| **Analytics** | ⚠️ Dashboard cơ bản; chưa MRR/churn/tenant |
| **Compliance** | ❌ Chưa đủ quy trình xóa/export/audit retention |

---

## 9. Kiến nghị lộ trình (gợi ý thứ tự)

1. **Sprint 1 (P0):** Nối `admin_student_path_*` → API/UI learning path học viên; feature flag.  
2. **Sprint 2 (P0):** Gộp admin API dưới RBAC; ẩn legacy UI; remove default admin emails khỏi repo.  
3. **Sprint 3 (P1):** CSRF + rate limit admin; khóa legacy plan API; UI teacher scope.  
4. **Sprint 4 (P1):** Play verify + RTDN hoặc tắt hẳn Play trên prod.  
5. **Sprint 5 (P0/P1):** Thiết kế tenant (org_id trên users/subscriptions) + onboarding tenant admin.  
6. **Sprint 6 (P2):** Migration versioning, monitoring, báo cáo doanh thu từ ledger + payments.

---

## 10. Phụ lục — API admin chính (tham khảo)

| Nhóm | Endpoint (mẫu) | Auth |
|------|------------------|------|
| Staff | `GET /api/admin/staff/me` | Staff session |
| Học viên | `GET/PATCH /api/admin/students`, `[id]`, block, notes | RBAC |
| Lộ trình | `path-templates`, `path-catalog`, `students/[id]/path` | RBAC |
| Pro | `GET/POST /api/admin/students/[id]/pro` | RBAC `students.plan` |
| Dashboard | `GET /api/admin/dashboard` | `dashboard.read` |
| Legacy | `overview`, `users`, `payments`, `activate-plan` | `requireAdminUser` |

---

## 11. Kết luận

**dev.beego.vn** đã có **nền sản phẩm học mạnh** (curriculum-50, voice, progress, billing hooks) và **lớp quản trị học viên đang hoàn thiện** (path template, Pro ledger, dashboard). Để **SaaS hóa an toàn và bán được cho nhiều khách hàng**, cần ưu tiên **(1) entitlements end-to-end (path + Pro → app học)**, **(2) một hệ admin + tenant**, **(3) hardening admin & billing**, trước khi mở rộng white-label và analytics nâng cao.

---

*Báo cáo được tạo tự động từ khảo sát mã nguồn; không thay thế pentest chuyên nghiệp hoặc review pháp lý (GDPR, hợp đồng SaaS).*
