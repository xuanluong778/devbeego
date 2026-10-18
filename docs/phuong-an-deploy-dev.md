# Phương án chuyển VPS cũ → `dev.beego.vn` (tái sử dụng stack hiện có)

**Trạng thái: CHỈ LÀ PHƯƠNG ÁN — chưa triển khai.**  
Cập nhật: 2026-10-17 (phiên bản 2)  
Thay thế hướng “dựng stack Docker song song cùng máy prod” trong bản trước.

---

## 0. Tóm tắt một câu

**Production `beego.vn` đã chuyển sang VPS mới.** VPS này (cũ) vẫn còn source + Docker Compose `beego` + MySQL/Redis/volume đang chạy. Mục tiêu: **đổi vai stack hiện có thành môi trường `dev.beego.vn`**, không dựng thêm compose, không copy source, không import lại DB nếu dữ liệu hiện tại dùng được.

---

## 1. Bối cảnh mới

| Thành phần | Vai trò sau khi chuyển |
| --- | --- |
| **VPS production mới** | Phục vụ `https://beego.vn` (nguồn sự thật production). **Không đụng** trong phương án này. |
| **VPS cũ (máy này)** | Giữ nguyên stack Docker đang chạy → đổi thành **`https://dev.beego.vn`**. |
| Domain `beego.vn` | Trỏ DNS / nginx / app tới VPS **mới** — không sửa trong kế hoạch này. |
| Domain `dev.beego.vn` | Trỏ về IP VPS **cũ**; nginx + URL app + OAuth chỉnh về `dev`. |

### 1.1. Stack đang có trên VPS cũ (giữ nguyên — tái sử dụng)

| Hạng mục | Giá trị hiện tại (không đổi cổng/volume nếu không bắt buộc) |
| --- | --- |
| Thư mục Compose | `/var/www/beego_vn_usr/data/docker/beego/` |
| Project name | `beego` |
| Image | `beego-app:latest` |
| Source tham chiếu | `/var/www/beego_vn_usr/data/www/beego.vn` (và/hoặc context trong thư mục docker) |
| Web | `beego-web` → `127.0.0.1:3025` |
| Voice cũ | `beego-voice-gateway` → `127.0.0.1:3031` |
| Learn Call | `beego-voice-gateway-learn` → `127.0.0.1:3033` |
| MySQL | `beego-mysql` → `127.0.0.1:3307` · volume `beego_mysql_data` |
| Redis | `beego-redis` → `127.0.0.1:6399` · volume `beego_redis_data` |
| Network | `beego_net` |
| Env file | `.env.docker` (nội bộ Docker: `DB_HOST=mysql`, `REDIS_URL=redis://redis:6379`) |

**Không** tạo project `beego-dev`, **không** đổi sang cổng 3125/3131/…, **không** tạo volume MySQL/Redis mới, **không** `mysqldump`/`import` lại trừ khi kiểm tra thấy DB hỏng.

---

## 2. Mục tiêu & nguyên tắc cứng

### 2.1. Mục tiêu

1. Người dùng/dev mở `https://dev.beego.vn` và dùng được app trên **VPS cũ**.
2. Stack Docker hiện tại tiếp tục chạy (cùng cổng, cùng volume).
3. App trên VPS cũ **chỉ** nói chuyện với MySQL/Redis **local** (container `mysql` / `redis` trên `beego_net`) — **không** kết nối DB/Redis của VPS production mới.
4. Tắt / chặn thanh toán và tác vụ gửi thật (email OTP ồ ạt, webhook prod, RTDN…).
5. Làm việc git trên nhánh `dev` sau khi đã cất thay đổi chưa commit.

### 2.2. Nguyên tắc

| # | Nguyên tắc |
| --- | --- |
| 1 | **Tái sử dụng**, không nhân đôi stack |
| 2 | **Không** copy thêm source tree |
| 3 | **Không** tạo/import DB mới nếu data hiện tại OK |
| 4 | Giữ nguyên cổng **3025 / 3031 / 3033 / 3307 / 6399**, thư mục Compose, project `beego`, volumes |
| 5 | **Không** thay đổi `beego.vn` hay bất kỳ cấu hình trên VPS production mới |
| 6 | Cô lập hướng ra ngoài: URL, OAuth, secret, webhook = **dev** |
| 7 | Xác minh tường minh: không có host/IP/connection string trỏ DB/Redis VPS mới |
| 8 | **Chưa triển khai** cho đến khi phương án được duyệt |

---

## 3. Kiến trúc sau chuyển đổi (logic)

```
DNS
  beego.vn      ──► VPS production MỚI   (ngoài phạm vi)
  dev.beego.vn  ──► VPS CŨ (IP hiện tại, vd. 116.118.45.72)

VPS CŨ — giữ nguyên Docker project "beego"
  nginx server_name: forcus vào dev.beego.vn
       ├── /            → 127.0.0.1:3025  (beego-web)
       ├── /voice       → 127.0.0.1:3031  (beego-voice-gateway)
       └── /voice-learn → 127.0.0.1:3033  (beego-voice-gateway-learn)
              │
       beego_net:  web ↔ mysql ↔ redis ↔ workers
       (DB_HOST=mysql, REDIS_URL=redis://redis:6379)  ← chỉ nội bộ Docker
```

Production mới và VPS cũ **không share** MySQL/Redis qua mạng công cộng.

---

## 4. Kiểm tra cô lập DB / Redis (bắt buộc trước & sau đổi URL)

Mục tiêu: chứng minh app **không** gọi database/Redis trên VPS production mới.

### 4.1. Checklist đọc cấu hình (VPS cũ)

Trong `/var/www/beego_vn_usr/data/docker/beego/.env.docker` và `docker-compose.yml`:

- [ ] `DB_HOST` = `mysql` (tên service Compose) — **không** là IP/hostname VPS mới
- [ ] `DB_PORT` = `3306` (cổng trong mạng Docker) — publish host chỉ `127.0.0.1:3307`
- [ ] `REDIS_URL` = `redis://redis:6379` — **không** là `redis://<IP-VPS-mới>:…`
- [ ] Không có biến kiểu `PROD_DB_*`, tunnel, hoặc host public của VPS mới
- [ ] MySQL/Redis **không** publish `0.0.0.0` ra Internet (chỉ `127.0.0.1`)

### 4.2. Checklist runtime

- [ ] `docker exec beego-web printenv | grep -E 'DB_|REDIS'` → chỉ host nội bộ
- [ ] Từ container web: resolve `mysql` / `redis` ra IP trong `beego_net`, không ra IP VPS mới
- [ ] Không có connection đang ESTABLISHED từ container app tới IP public/private của VPS production mới (cổng 3306/6379)
- [ ] Gate Learn / queue BullMQ nằm trên Redis **local** (`6399` / service `redis`)

### 4.3. Nếu phát hiện trỏ nhầm sang VPS mới

**Dừng.** Sửa env về `mysql` / `redis` local, recreate container app (không đụng volume data nếu không cần), rồi kiểm tra lại. Không “vá” bằng cách mở DB prod mới cho VPS cũ.

---

## 5. Git — lưu thay đổi chưa commit trước khi sang nhánh `dev`

Trên VPS cũ, trước khi đổi cấu hình/URL theo hướng `dev`:

1. Xem trạng thái:

   ```bash
   cd /var/www/beego_vn_usr/data/www/beego.vn   # hoặc đúng repo đang làm việc
   git status -sb
   git branch --show-current
   ```

2. **Cất** thay đổi chưa commit (chọn một):

   | Cách | Khi nào |
   | --- | --- |
   | `git stash push -u -m "wip before switch to dev branch"` | Muốn chuyển nhánh sạch, lấy lại sau |
   | Commit tạm trên branch phụ `wip/…` | Muốn giữ lịch sử rõ |
   | Commit vào `docs/*` trên `main` rồi mới cắt `dev` | Chỉ có tài liệu |

3. Tạo / chuyển nhánh làm việc dev (ví dụ):

   ```bash
   git fetch origin
   git switch -c dev            # hoặc: git switch dev nếu đã có
   # git stash pop   # nếu đã stash và cần mang theo
   ```

4. Mọi chỉnh sửa env/nginx **dev** sau đó ưu tiên commit trên nhánh `dev` (không force-push `main` production trên VPS mới từ máy này nếu không được giao).

> Ghi chú: thư mục Compose `/data/docker/beego/` có thể là bản copy độc lập với git web — vẫn nên ghi nhận thay đổi env bằng backup file (`cp .env.docker .env.docker.bak-$(date +%F)`) trước khi sửa.

---

## 6. Các bước chuyển đổi (thứ tự đề xuất — chưa chạy)

### Bước A — Xác nhận sức khỏe stack hiện tại

- [ ] `docker compose -p beego ps` — web/mysql/redis healthy
- [ ] `curl -s http://127.0.0.1:3025/api/health` → 200
- [ ] MySQL local có dữ liệu (`users`, …) — **nếu OK thì không import lại**
- [ ] Redis local `PING` OK
- [ ] Hoàn tất mục 4 (cô lập DB/Redis)

### Bước B — DNS `dev.beego.vn` → VPS cũ

- [ ] Tạo/ cập nhật bản ghi `A` (và `AAAA` nếu có) `dev.beego.vn` → **IP VPS cũ**
- [ ] **Không** đổi DNS `beego.vn` (đang về VPS mới)
- [ ] Chờ propagate; kiểm tra `dig +short dev.beego.vn`

### Bước C — nginx trên VPS cũ

Mục tiêu: hostname công khai cho stack local là `dev.beego.vn`.

Đề xuất (chọn một cách, ưu tiên ít đụng nhất):

1. **Thêm** `server_name dev.beego.vn` (và giữ tạm `beego.vn` trên máy cũ **chỉ nếu** vẫn còn vhost cũ — tránh contest với DNS đã trỏ đi nơi khác).
2. Hoặc tách vhost riêng `dev.beego.vn.conf` proxy đúng:
   - `/` → `127.0.0.1:3025`
   - `/voice` → `127.0.0.1:3031` (WebSocket upgrade, timeout dài)
   - `/voice-learn` → `127.0.0.1:3033`
3. SSL: Certbot / panel cho **`dev.beego.vn`** (cert riêng).
4. Bảo vệ dev (khuyến nghị):
   - `add_header X-Robots-Tag "noindex, nofollow"`
   - IP allowlist và/hoặc Basic Auth
5. **Không** sửa nginx trên VPS production mới.

### Bước D — URL app / WebSocket / build-arg public

Cập nhật **trên VPS cũ** file `.env.docker` (và rebuild web nếu `NEXT_PUBLIC_*` đã bake vào image):

| Biến | Giá trị đích |
| --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://dev.beego.vn` |
| `NEXT_PUBLIC_VOICE_WS_URL` | `wss://dev.beego.vn/voice` |
| `LEARN_AI_CALL_WS_URL` | `wss://dev.beego.vn/voice-learn` |
| `GOOGLE_CALLBACK_URL` | `https://dev.beego.vn/api/auth/google/callback` |
| `DB_HOST` / `REDIS_URL` | **Giữ** `mysql` / `redis://redis:6379` |

Vì `NEXT_PUBLIC_*` thường được nhúng lúc `docker build`, có thể cần:

```text
# KẾ HOẠCH — chưa chạy
docker compose -p beego build --build-arg NEXT_PUBLIC_APP_URL=https://dev.beego.vn \
  --build-arg NEXT_PUBLIC_VOICE_WS_URL=wss://dev.beego.vn/voice \
  --build-arg LEARN_AI_CALL_WS_URL=wss://dev.beego.vn/voice-learn web
docker compose -p beego up -d web voice-gateway voice-gateway-learn …
```

Giữ nguyên map cổng host. Không đổi tên volume.

### Bước E — OAuth Google

- [ ] Google Cloud Console: **thêm** Authorized redirect URI  
  `https://dev.beego.vn/api/auth/google/callback`
- [ ] **Giữ** URI production `https://beego.vn/api/auth/google/callback` (VPS mới)
- [ ] Client ID có thể dùng chung; callback phải khớp domain đang mở

### Bước F — Secret / định danh môi trường dev

- [ ] Đổi `VOICE_JWT_SECRET` trên VPS cũ sang giá trị **riêng dev** (token cũ invalidate — chấp nhận được trên dev)
- [ ] Backup `.env.docker` trước khi sửa
- [ ] Cân nhắc tách OpenAI/Azure key “dev” (khuyến nghị) hoặc giữ key cũ nhưng theo dõi usage
- [ ] `ADMIN_EMAILS` giữ để vào Learn Call
- [ ] (Tuỳ chọn) `LEARN_AI_CALL_ALLOWLIST` cho email nội bộ
- [ ] Đặt marker rõ ràng trong env hoặc README: `BEEGO_ENV=dev` / ghi chú “đây không phải production”

### Bước G — Tắt thanh toán & tác vụ gửi thật

Trên **VPS cũ / dev** (không đụng VPS mới):

| Hạng mục | Hướng xử lý đề xuất |
| --- | --- |
| Thanh toán / billing API | nginx `return 403` cho `/api/payments`, `/api/billing` (pattern giống learn-staging) |
| Stripe / Sepay webhook | Không trỏ URL webhook nhà cung cấp về `dev.beego.vn`; hoặc 403 |
| Google Play RTDN | Không đăng ký endpoint dev là receiver production |
| OTP / email đăng ký ồ ạt | Giữ `ENABLE_PHONE_OTP=false` hoặc chặn route OTP nếu không cần test |
| Push FCM | Không dùng key production gửi nhầm user thật; tắt hoặc dùng project Firebase dev |
| Learn Call gate | Redis **local**: `SET voice:learn-call-gate 1` khi cần mở thử |

### Bước H — Restart có kiểm soát (chỉ container VPS cũ)

- [ ] `docker compose -p beego up -d` sau đổi env (recreate app containers)
- [ ] **Không** `down -v` (tránh xóa volume MySQL/Redis)
- [ ] Smoke: health, login admin, 1 cuộc gọi Learn Call trên `dev.beego.vn`

---

## 7. Việc **không** làm

| Không làm | Lý do |
| --- | --- |
| Tạo Compose `beego-dev` / cổng 3125… | Đã có stack đủ dùng |
| Copy thêm cây source | Trùng lặp, lệch phiên bản |
| Import lại DB từ zip nếu data hiện tại OK | Rủi ro ghi đè volume |
| Đổi DNS `beego.vn` về VPS cũ | Production đã ở VPS mới |
| Sửa nginx / Docker / DB trên VPS production mới | Ngoài phạm vi |
| Publish MySQL/Redis ra `0.0.0.0` | Lộ dữ liệu |
| Trỏ `DB_HOST`/`REDIS_URL` sang IP VPS mới | Phá cô lập, nguy hiểm |

---

## 8. Checklist nghiệm thu (sau khi được duyệt và làm)

- [ ] `https://dev.beego.vn` mở được (SSL OK)
- [ ] `https://beego.vn` vẫn phục vụ từ **VPS mới** (kiểm tra từ máy ngoài)
- [ ] `dig` / browser: `dev` → IP VPS cũ; `beego.vn` → IP VPS mới
- [ ] Health local `3025` và qua domain dev đều OK
- [ ] Env trong container: `DB_HOST=mysql`, Redis = service `redis`
- [ ] Không có kết nối tới DB/Redis VPS mới
- [ ] OAuth login trên dev (nếu bật) dùng callback `dev.beego.vn`
- [ ] WebSocket `wss://dev.beego.vn/voice` và `/voice-learn` OK
- [ ] Thanh toán / webhook nguy hiểm bị chặn hoặc không kích hoạt
- [ ] Volume MySQL/Redis vẫn là volume cũ (data không mất)
- [ ] Git: thay đổi trước đó đã stash/commit; đang làm việc trên nhánh `dev` (hoặc đã ghi nhận rõ)

---

## 9. Rủi ro

| Rủi ro | Giảm thiểu |
| --- | --- |
| Rebuild image với sai `NEXT_PUBLIC_*` vẫn còn `beego.vn` | Build-arg rõ; kiểm tra HTML/JS có `dev.beego.vn` |
| Quên đổi OAuth → login Google lỗi | Thêm URI dev trước khi announce |
| `docker compose down -v` xóa data | Cấm `-v` trong runbook; backup volume trước thao tác lớn |
| Cert / server_name sót `beego.vn` trên máy cũ gây nhầm | Vhost rõ `dev.beego.vn`; DNS beego.vn không trỏ về đây |
| Dev vẫn gửi webhook/payment thật | 403 nginx + không đăng ký URL dev với cổng thanh toán |
| Nhầm thao tác lên VPS mới | Checklist “chỉ SSH VPS cũ”; không mở session prod trong cùng script |

---

## 10. Ước lượng khi được triển khai

| Việc | Thời gian |
| --- | --- |
| Git stash/branch + backup `.env.docker` | 15–30 phút |
| DNS + SSL + nginx `dev.beego.vn` | 30–90 phút |
| Đổi env URL + rebuild/recreate app | 30–120 phút (build image) |
| OAuth + chặn payment + smoke Learn Call | 30–60 phút |
| **Tổng** | **~½ ngày** (nhanh hơn nhiều so với dựng stack mới) |

---

## 11. Quyết định cần duyệt trước khi làm

1. Có bật Basic Auth / IP allowlist trên `dev.beego.vn` không?
2. Có **đổi** `VOICE_JWT_SECRET` (logout mọi session voice cũ trên máy này) không?
3. Có rebuild image bắt buộc ngay, hay chỉ đổi env runtime trước (chấp nhận một phần asset còn trỏ `beego.vn` tạm)?
4. Thanh toán: chỉ 403 nginx hay tắt sâu hơn trong code/env?
5. Nhánh git tên chính thức: `dev` hay `development`?

---

## 12. Trạng thái triển khai (2026-10-17)

Đã thực hiện trên VPS cũ:

- Backup cấu hình → `/var/www/beego_vn_usr/backups/dev-cutover-20261017-213154/`
- `.env.docker` / compose / Dockerfile: URL → `dev.beego.vn`, `BEEGO_ENV=dev`, `VOICE_JWT_SECRET` mới
- FastPanel nginx `dev.beego.vn` + Let's Encrypt; vhost `beego.vn` trên VPS cũ đã disable
- Chặn `/api/payments` và `/api/billing` → 403
- Rebuild `beego-app:latest`, recreate app containers (giữ MySQL/Redis volume)
- CSRF allowlist thêm `https://dev.beego.vn`
- Learn Call: `voice:learn-call-gate=1`, `LEARN_AI_CALL_ALLOWLIST` (dev)
- Smoke: homepage/health 200, login 200, Learn Call session 200 (`wss://dev.beego.vn/voice-learn`), WS 101, payment 403
- DB/Redis vẫn local (`DB_HOST=mysql`, `REDIS_URL=redis://redis:6379`); không chạm VPS mới / DNS production

**Còn thủ công:** thêm Google OAuth redirect URI  
`https://dev.beego.vn/api/auth/google/callback` trong Google Cloud Console.

---

## 13. Tham chiếu

| Path | Vai trò |
| --- | --- |
| `/var/www/beego_vn_usr/data/docker/beego/docker-compose.yml` | Stack tái sử dụng |
| `/var/www/beego_vn_usr/data/docker/beego/.env.docker` | Env runtime (backup trước khi sửa) |
| `/var/www/beego_vn_usr/data/www/beego.vn` | Source / git trên VPS cũ |
| `/etc/nginx/conf.d/learn-staging.beego.vn.conf` | Mẫu chặn API + bảo vệ staging |
| `docs/huong-dan-deploy.md` | Deploy tổng quát (tham khảo, không áp nguyên xi) |
| Bản phương án cũ (v1) | Dựng `beego-dev` song song — **không còn áp dụng** |

---

**Kết luận:** VPS cũ đã chuyển thành `dev.beego.vn` — giữ nguyên Docker project `beego`, cổng và volume; chỉ đổi nginx/SSL/URL/OAuth/secret và chặn thanh toán; DB/Redis local; không chạm VPS production mới.
