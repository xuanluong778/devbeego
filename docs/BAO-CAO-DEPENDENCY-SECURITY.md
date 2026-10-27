# Báo cáo Bước 2 — Dependency security (dev.beego.vn)

**Phạm vi:** chỉ môi trường dev (`/var/www/dev_beego_vn_usr/data/www/dev.beego.vn`, image Docker `beego-web`).  
**Không** triển khai production, không tạo lại MySQL, không xóa dữ liệu.  
**Ngày đánh giá:** 2026-10-26 (UTC+7).

---

## 1. Tóm tắt điều hành

| Chỉ số | Trước Bước 2 | Sau Bước 2 (cây dev đầy đủ) | Runtime container (`npm audit --omit=dev`) |
|--------|----------------|-----------------------------|---------------------------------------------|
| Tổng cảnh báo npm audit | 17 | 5 | 2 |
| Critical | 2 | 2 | 1 |
| High | 10 | 3 | 1 |
| Moderate | 5 | 0 | 0 |

**Đã nâng (có bản vá xác minh, cùng major hoặc override có kiểm thử):** `mysql2`, `ws`, `nodemailer`, `bullmq`, `microsoft-cognitiveservices-speech-sdk`, `axios` (override transitive), pin `next@14.2.35`.

**Chưa xử lý trong phạm vi Bước 2 (cần quyết định riêng):** `next`/`postcss` (cần Next **15.5.x+** hoặc **16.x** — major), `@capacitor/cli`/`tar` (chỉ build mobile, devDependency), `xlsx` (không có bản vá trên npm).

**Kết luận ngắn:** Số cảnh báo giảm mạnh; **không** coi audit sạch là an toàn tuyệt đối. **Production vẫn bị chặn một phần** bởi các advisory Next.js App Router / middleware còn áp dụng trên nhánh 14.2.x (bản vá nằm trên 15.5.x).

---

## 2. Phương pháp

1. `npm audit` trên source dev, đối chiếu `package.json` + `package-lock.json`.
2. Đọc [GitHub Advisory Database](https://github.com/advisories) (URL trong output audit) cho điều kiện khai thác và phiên bản đã vá.
3. Rà cấu hình: `next.config.mjs` (không `images.remotePatterns`, không `rewrites`/`redirects`), middleware Edge, luồng SMTP/OTP, voice WS, import org.
4. Nâng phiên bản tối thiểu tương thích; **không** dùng `npm audit fix --force`.
5. Kiểm thử: build Docker `web`, health, `scripts/test-authz-step1.mjs` (27), `scripts/test-acceptance-step1.mjs` (15), hồi quy HTTP (lessons, webhook, owner, voice gate).

---

## 3. Thay đổi phiên bản (trực tiếp / override)

| Package | Trước (lock) | Sau (lock) | Loại | Ghi chú |
|---------|--------------|------------|------|---------|
| `mysql2` | 3.20.0 | **3.24.6** | direct, runtime | Pool DB toàn app |
| `ws` | 8.20.0 | **8.22.0** | direct, runtime | `scripts/voice-ws-*.mjs` (gateway dev) |
| `nodemailer` | 8.0.4 | **10.2.1** | direct, runtime | SMTP OTP / forgot-password (`lib/otp-delivery.js`); major 8→10, API `createTransport`/`sendMail` giữ nguyên |
| `bullmq` | 5.73.0 | **5.81.5** | direct, runtime | Voice workers / queue |
| `microsoft-cognitiveservices-speech-sdk` | 1.49.0 | **1.53.0** | direct, runtime | Azure Speech |
| `next` | 14.2.35 | **14.2.35** | direct | Đã là bản cuối nhánh **14.2.x** trên npm |
| `axios` | 1.14.0 (transitive) | **1.20.0** | override | Phụ thuộc `twilio`, `@sendgrid/mail`, v.v. |

`package.json` thêm:

```json
"overrides": {
  "axios": "^1.20.0"
}
```

---

## 4. Phân loại cảnh báo còn lại

### 4.1. `next` + `postcss` — **Có ảnh hưởng tiềm năng; chưa xử lý (major)**

- **Phiên bản:** `next@14.2.35`, `postcss@8.4.31` (bundled bởi Next).
- **Nguồn:** nhiều GHSA gắn dải `>=13.x / >=14.2.0 <15.5.16` … `<15.5.24` … (ví dụ [GHSA-wfc6-r584-vfw7](https://github.com/advisories/GHSA-wfc6-r584-vfw7), [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf), [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f)).
- **Bản vá theo advisory:** Next **≥15.5.10 … ≥15.5.24** (tùy CVE), không có backport 14.2.36+.
- **Bằng chứng cấu hình app (giảm *một số* vector, không loại trừ toàn bộ):**
  - Không dùng `next/image` / Image Optimizer trong mã nguồn (CVE image/AVIF/SVG ít áp dụng hơn nhưng **không** bằng chứng loại trừ mọi CVE Next).
  - Không có `"use server"` (Server Actions) trong repo — giảm bề mặt Server Action DoS/SSRF.
  - Không `rewrites`/`redirects` trong `next.config.mjs`.
  - **Có** App Router, **có** `middleware.ts` (CSRF + rate limit admin) → các advisory middleware/RSC/cache vẫn **có thể** áp dụng khi attacker gửi HTTP tùy ý tới origin.
- **Phân loại:** **Có ảnh hưởng / chặn production** nếu chính sách yêu cầu vá CVE Next công khai trên nhánh đang chạy.
- **Phương án chưa làm:** lên kế hoạch nâng Next **15.5 LTS đã vá** (hoặc 16.x) với QA full UI/mobile — **ngoài** phạm vi Bước 2.

### 4.2. `xlsx` — **Có ảnh hưởng có điều kiện; chưa xử lý (không có fix npm)**

- **Phiên bản:** `0.18.5` (devDependency trong `package.json`, nhưng mã runtime import trong `lib/org-vocab/import-words.ts`).
- **Advisory:** [GHSA-4r6h-8v6p-xvw6](https://github.com/advisories/GHSA-4r6h-8v6p-xvw6), [GHSA-5pgg-2g8v-p4x9](https://github.com/advisories/GHSA-5pgg-2g8v-p4x9) — Prototype Pollution / ReDoS; **No fix available** trên registry công khai.
- **Đường mã:** `POST` import từ vựng org — `parseImportBuffer` gọi `XLSX.read(buffer)` ([`lib/org-vocab/import-words.ts`](../lib/org-vocab/import-words.ts), route [`app/api/org/vocabulary-sets/[id]/import/route.ts`](../app/api/org/vocabulary-sets/[id]/import/route.ts)).
- **Điều kiện khai thác:** tài khoản org có quyền import + file `.xlsx` độc hại; không phải học viên ẩn danh.
- **Phân loại:** **Có ảnh hưởng có điều kiện**; ưu tiên CSV/JSON, giới hạn kích thước, sandbox parse, hoặc thay thư viện (SheetJS Pro / parser khác) — **chưa triển khai** trong Bước 2.

### 4.3. `@capacitor/cli` + `tar` — **Không áp dụng runtime web; rủi ro build/dev**

- **Advisory tar:** nhiều GHSA (ví dụ [GHSA-r292-9mhp-454m](https://github.com/advisories/GHSA-r292-9mhp-454m)) — khai thác khi **giải nén tarball không tin cậy**.
- **Đường dùng:** `@capacitor/cli` devDependency, lệnh `cap sync` / CI Android local; **không** chạy trong request HTTP `beego-web`.
- **Phân loại:** **Không áp dụng** với container web production nếu image không chạy `cap sync` trên tarball lạ. Vẫn nên vá khi nâng Capacitor 8+ (breaking).

### 4.4. Các gói đã xử lý trong Bước 2

#### `mysql2` (HIGH) → **Đã vá**

| Advisory | Điều kiện | Áp dụng app |
|----------|-----------|-------------|
| [GHSA-3f6p-5ww8-9rcr](https://github.com/advisories/GHSA-3f6p-5ww8-9rcr) | MITM downgrade auth plugin | Có nếu attacker trên đường tới MySQL |
| [GHSA-rgwj-5xj2-c3m3](https://github.com/advisories/GHSA-rgwj-5xj2-c3m3) | Compressed protocol bomb | Có nếu bật nén protocol |

**Fix:** `3.24.6` (≥3.22.0 / >3.23.0 theo advisory). **Runtime container đã xác minh:** `require('mysql2/package.json').version === 3.24.6`.

#### `ws` (HIGH) → **Đã vá**

| Advisory | Điều kiện |
|----------|-----------|
| [GHSA-58qx-3vcg-4xpx](https://github.com/advisories/GHSA-58qx-3vcg-4xpx) | Client/server WS đối tác không tin cậy |
| [GHSA-96hv-2xvq-fx4p](https://github.com/advisories/GHSA-96hv-2xvq-fx4p) | Fragment/chunk DoS |

**Fix:** `8.22.0`. Voice gateway expose WS — **ưu tiên cao**, đã nâng.

#### `nodemailer` (HIGH) → **Đã vá (major 10.x)**

Nhiều GHSA SMTP/header/addressparser (ví dụ [GHSA-8c8m-p3m8-cjg8](https://github.com/advisories/GHSA-8c8m-p3m8-cjg8), `<10.1.4`).  
App: `from`/`to` từ cấu hình + user đã xác thực OTP; attacker không điều khiển trực tiếp transport name trừ khi compromise admin settings. Vẫn **nên vá** vì SMTP là đường nhạy cảm.

**Fix:** `10.2.1`. OTP thật không gửi trong test (chỉ rate-limit / login validation).

#### `axios` (HIGH, transitive) → **Đã vá (override)**

Hàng loạt GHSA SSRF/prototype pollution trên `<1.20.0`. Dùng gián tiếp qua Twilio/SendGrid SDK.

**Fix:** override `^1.20.0`.

#### `bullmq` / `uuid`, `microsoft-cognitiveservices-speech-sdk`, `qs`, `nanoid`, `source-map-js`, `form-data`, `follow-redirects`

- Đã hết khỏi báo cáo audit **dev full** sau nâng `bullmq@5.81.5`, speech SDK, `npm audit fix` (non-force).
- `postcss`/`nanoid`/`source-map-js` còn lại chủ yếu qua **next** (build).

---

## 5. Kiểm thử sau thay đổi (dev)

| Kiểm thử | Kết quả |
|----------|---------|
| `docker compose build web` + `up --force-recreate --no-deps web` | **PASS** (health 200) |
| `scripts/test-authz-step1.mjs` | **27 PASS**, 0 FAIL |
| `scripts/test-acceptance-step1.mjs` | **15 PASS**, 0 FAIL |
| `GET /api/lessons` | **200** (công khai) |
| `POST /api/billing/webhook` (body rỗng) | **400** (Stripe validation, **không** 403 CSRF) |
| `voice:learn-call-gate` Redis | **1** |
| `system_owner` count DB | **1** (giữ nguyên) |
| Tài khoản fixture `authz-*@invalid.local` | **0** sau test (script tự dọn) |
| `npm audit --omit=dev` trong container | **2** (next, postcss) |

**Chưa kiểm chứng trong Bước 2:** gửi OTP/email thật, giao dịch Stripe/SePay thật, fuzz `.xlsx` độc hại, PoC CVE Next cụ thể trên dev.

---

## 6. Rủi ro tồn đọng & điều kiện trước production

1. **Next.js 14.2.35:** lập kế hoạch nâng **15.5.x+** (hoặc 16.x) có changelog bảo mật, regression UI/Capacitor/API; đây là **điểm chặn chính** nếu policy yêu cầu vá hết advisory critical/high trên framework.
2. **xlsx:** thay parser hoặc chỉ cho phép CSV/JSON trên import org; giới hạn upload; theo dõi SheetJS/community fork có bản vá.
3. **Capacitor/tar:** chỉ ảnh hưởng pipeline Android local; nâng Capacitor khi sẵn sàng breaking change.
4. **Voice WS (`ws`):** đã vá; vẫn cần WAF/rate-limit ở edge như hiện tại.
5. **Không** kết luận “an toàn” chỉ vì runtime audit còn 2 mục — cả hai gắn **Next/postcss** và bề mặt HTTP công khai.

---

## 7. Rollback (dev)

1. Khôi phục `package.json` / `package-lock.json` trước Bước 2 từ git.
2. `npm ci` trên source → rsync docker context → `docker compose build web` → `up -d --force-recreate --no-deps web`.
3. `docker exec beego-redis redis-cli SET voice:learn-call-gate 1`.
4. Chạy lại `test-authz-step1.mjs` và `test-acceptance-step1.mjs`.

---

## 8. Tham chiếu nội bộ

- Bước 1 auth/RBAC: `docs/NGHIEM-THU-BUOC-1-HARDENING.md`, `scripts/test-authz-step1.mjs`
- Cấp quyền admin: `docs/QUY-TRINH-CAP-QUYEN-ADMIN.md`
- Runtime Docker: `README-DEV-FASTPANEL.txt` (proxy 3025)
