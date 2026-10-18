# Hướng dẫn deploy Beego lên VDS mới

Tài liệu này giúp dựng **bản production đầy đủ** trên VDS mới (Ubuntu 22.04/24.04), bám theo cấu hình đang chạy tốt trên VPS hiện tại.

Cập nhật: 2026-10-17 · Repo: `https://github.com/xuanluong778/beego` · Branch: `main`

---

## 0. Kiến trúc tổng quan

```
Internet (HTTPS / WSS)
        │
     nginx :443
        ├── /              → Next.js (127.0.0.1:3025)     PM2: beego
        ├── /voice         → Voice gateway cũ (3031)      PM2: beego-voice-gateway
        └── /voice-learn   → Learn Call gateway (3033)    PM2: beego-voice-gateway-learn
                │
         Redis (BullMQ) + MySQL
                │
     Workers: LLM / TTS / usage
        ├── Stack cũ:     beego-voice-llm, beego-voice-tts, beego-voice-usage
        └── Stack Learn:  beego-voice-llm-learn, beego-voice-tts-learn
```

| Thành phần | Vai trò | Cổng nội bộ |
| --- | --- | --- |
| `beego` | Next.js 14 (web + API) | `127.0.0.1:3025` |
| `beego-voice-gateway` | WebSocket luyện nói cũ + Azure STT | `127.0.0.1:3031` |
| `beego-voice-gateway-learn` | WebSocket **Gọi gia sư AI** | `127.0.0.1:3033` |
| `beego-voice-llm` / `-learn` | Worker OpenAI | hàng đợi Redis |
| `beego-voice-tts` / `-learn` | Worker Azure TTS | hàng đợi Redis |
| `beego-voice-usage` | Ghi usage (stack cũ) | hàng đợi Redis |
| MySQL 8 | Dữ liệu app | `127.0.0.1:3306` |
| Redis 7 | Session voice, queue, gate Learn | `127.0.0.1:6379` |

**Luật vàng:** web + gateway Learn + worker LLM Learn + worker TTS Learn phải cùng một bản mã nguồn. Lệch phiên bản → cuộc gọi lỗi hoặc `worker_outdated`.

Tài liệu bổ sung (Learn Call nâng cao / rollback): `docs/learn-call-deploy.md`.

---

## 1. Yêu cầu VDS (khuyến nghị)

| Hạng mục | Tối thiểu | Khuyến nghị (chạy tốt) |
| --- | --- | --- |
| CPU | 2 vCPU | **4+ vCPU** |
| RAM | 4 GB | **8 GB+** (build Next + nhiều worker) |
| Disk | 40 GB SSD | **80 GB+** |
| OS | Ubuntu 22.04/24.04 LTS x86_64 | Giống trái |
| Mạng | IP public, mở 80/443 | Có firewall (ufw/CSF) |
| Domain | A/AAAA trỏ về VDS | HTTPS bắt buộc (micro trên mobile) |

Phần mềm:

| Phần mềm | Phiên bản đã chạy ổn |
| --- | --- |
| Node.js | **22.x** (nvm) |
| npm | 10.x |
| MySQL | **8.0** |
| Redis | **7.x** (cài native hoặc Docker chỉ listen `127.0.0.1`) |
| nginx | 1.24+ |
| PM2 | mới nhất (`npm i -g pm2`) |
| Git | 2.x |
| Certbot / SSL panel | Let’s Encrypt hoặc panel |

---

## 2. Chuẩn bị trước khi bắt đầu

Checklist mang sang VDS mới:

- [ ] Source: clone `main` từ GitHub **hoặc** rsync bản đã build từ VPS cũ
- [ ] Database: file `beego-db-full-*.zip` (có `beego_vn.sql`)
- [ ] Secrets: nội dung `.env.local` (copy an toàn, **không** commit Git)
- [ ] Domain DNS đã trỏ về IP VDS mới (TTL thấp khi chuyển)
- [ ] Google OAuth: cập nhật callback URL cho domain mới
- [ ] Azure Speech + OpenAI: key còn hạn, region phù hợp (vd. `eastasia`)
- [ ] Email admin (`ADMIN_EMAILS`) để mở Learn Call lúc đầu

**Không** đưa `.env.local`, dump DB, hoặc private key lên GitHub / thư mục web public.

---

## 3. Cài hệ thống cơ bản

Chạy với user có quyền sudo (ví dụ `root`).

```bash
apt update && apt -y upgrade
apt -y install build-essential curl git unzip nginx mysql-server \
  redis-server certbot python3-certbot-nginx ufw
```

### 3.1. Node.js 22 (nvm)

```bash
curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
# mở lại shell hoặc:
source ~/.nvm/nvm.sh
nvm install 22
nvm alias default 22
node -v   # kỳ vọng v22.x
npm -v
npm i -g pm2
```

### 3.2. Firewall

```bash
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
# Không mở public 3025/3031/3033/3306/6379
```

### 3.3. MySQL — user + database

```bash
mysql -u root <<'SQL'
CREATE DATABASE IF NOT EXISTS beego_vn CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'beego_app'@'127.0.0.1' IDENTIFIED BY 'DOI_MAT_KHAU_MANH';
CREATE USER IF NOT EXISTS 'beego_app'@'localhost' IDENTIFIED BY 'DOI_MAT_KHAU_MANH';
GRANT ALL PRIVILEGES ON beego_vn.* TO 'beego_app'@'127.0.0.1';
GRANT ALL PRIVILEGES ON beego_vn.* TO 'beego_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Chỉ listen localhost (khuyến nghị): trong `/etc/mysql/mysql.conf.d/mysqld.cnf`:

```ini
bind-address = 127.0.0.1
```

```bash
systemctl restart mysql
```

### 3.4. Redis — chỉ localhost

Trong `/etc/redis/redis.conf`:

```conf
bind 127.0.0.1 -::1
protected-mode yes
# requirepass <mat-khau-redis>   # khuyến nghị nếu cùng máy nhiều dịch vụ
```

```bash
systemctl enable --now redis-server
redis-cli ping   # PONG
```

Nếu dùng URL có password: `REDIS_URL=redis://:MAT_KHAU@127.0.0.1:6379`

---

## 4. Đưa source lên VDS

### Cách A — Clone GitHub (khuyến nghị cho VDS sạch)

```bash
mkdir -p /var/www/beego
cd /var/www/beego
git clone git@github.com:xuanluong778/beego.git beego.vn
# hoặc HTTPS:
# git clone https://github.com/xuanluong778/beego.git beego.vn
cd beego.vn
git checkout main
git rev-parse --short HEAD   # ghi lại để đối chiếu
```

SSH deploy key: thêm public key vào GitHub repo (Deploy keys, read-only là đủ).

### Cách B — Rsync từ VPS cũ (giữ `.next` đã build)

Trên **máy nguồn** (cẩn thận loại `.env` nếu sẽ tạo mới):

```bash
rsync -aH --info=progress2 \
  --exclude node_modules \
  --exclude '.next-prev*' \
  --exclude '.next-isolated' \
  --exclude '.next-dev' \
  /var/www/beego_vn_usr/data/www/beego.vn/ \
  root@IP_VDS_MOI:/var/www/beego/beego.vn/
```

Sau đó trên VDS mới vẫn nên `npm ci` và `npm run build` lại cho chắc.

Đường dẫn mặc định trong tài liệu này: **`/var/www/beego/beego.vn`**. Đổi `APP_DIR` nếu bạn đặt chỗ khác.

```bash
export APP_DIR=/var/www/beego/beego.vn
cd "$APP_DIR"
```

---

## 5. Restore database đầy đủ

Giả sử đã có `beego-db-full-YYYYMMDD-HHMMSS.zip`:

```bash
cd /root
unzip beego-db-full-*.zip
cd db-full-*

# Production (bắt buộc)
mysql -u root < beego_vn.sql

# Tuỳ chọn — preview Learn Call / snapshot verify
# mysql -u root < beego_call_preview.sql
# mysql -u root < beego_vn_verify_*.sql
```

Kiểm tra:

```bash
mysql -u beego_app -p -h 127.0.0.1 beego_vn -e "
SHOW TABLES;
SELECT COUNT(*) AS users FROM users;
SELECT COUNT(*) AS subscriptions FROM subscriptions;
"
```

Nếu dump tạo DB + user khác mật khẩu: giữ user `beego_app` đã tạo ở mục 3, chỉ import data, hoặc `ALTER USER` cho khớp `.env.local`.

Migration schema (khi đã có DB production ổn):

```bash
cd "$APP_DIR"
npm run migrate
# = node --env-file=.env.local lib/db/migrate.js
```

Với dump đầy đủ mới nhất, thường **không cần** migrate thêm; chỉ chạy nếu README/release ghi rõ.

---

## 6. Cấu hình `.env.local`

```bash
cd "$APP_DIR"
nano .env.local
chmod 600 .env.local
```

Mẫu (điền secret thật, **không** commit):

```dotenv
# --- Redis / Voice JWT ---
REDIS_URL=redis://127.0.0.1:6379
VOICE_JWT_SECRET=DOI_BANG_CHUOI_DAI_NGAU_NHIEN_64+_KY_TU

# --- OpenAI (LLM Learn Call + chat) ---
OPENAI_API_KEY=sk-...
OPENAI_CHAT_MODEL=gpt-4o-mini

# --- Azure Speech (STT + TTS) ---
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=eastasia

# --- Google OAuth (web + Android nếu có) ---
GOOGLE_CLIENT_ID=....apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://DOMAIN_CUA_BAN/api/auth/google/callback
GOOGLE_ANDROID_CLIENT_ID=....apps.googleusercontent.com

# --- Admin (Learn Call mặc định chỉ admin nếu không có allowlist) ---
ADMIN_EMAILS=ban@email.com

# --- Database ---
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=beego_app
DB_PASSWORD=DOI_MAT_KHAU_MANH
DB_NAME=beego_vn

# --- App URL ---
NEXT_PUBLIC_APP_URL=https://DOMAIN_CUA_BAN
NODE_ENV=production

# --- Voice stack cũ (nginx /voice → 3031) ---
VOICE_WS_PORT=3031
NEXT_PUBLIC_VOICE_WS_URL=wss://DOMAIN_CUA_BAN/voice

# --- Learn Call (Gọi gia sư AI) ---
LEARN_AI_CALL_ENABLED=1
LEARN_AI_CALL_WS_URL=wss://DOMAIN_CUA_BAN/voice-learn
# LEARN_AI_CALL_ALLOWLIST=email1@...,email2@...
# KHÔNG đặt LEARN_AI_CALL_QUOTA_MODE=test trên production
```

Lưu ý quan trọng:

1. `VOICE_JWT_SECRET` trên VDS mới nên **tạo mới** nếu không cần giữ token cũ.
2. Đổi domain → đổi `NEXT_PUBLIC_*`, `GOOGLE_CALLBACK_URL`, `LEARN_AI_CALL_WS_URL`, `NEXT_PUBLIC_VOICE_WS_URL`.
3. Biến cổng/queue Learn (`VOICE_WS_PORT=3033`, `VOICE_LLM_QUEUE=…`) đặt trong **PM2 env**, không ghi đè `VOICE_WS_PORT=3031` trong `.env.local` của stack cũ.
4. Next.js **không ghi đè** biến môi trường đã có (kể cả chuỗi rỗng). Tránh set `OPENAI_API_KEY=` rỗng trong PM2 env.

Tạo secret JWT nhanh:

```bash
openssl rand -base64 48
```

---

## 7. Cài dependency và build

```bash
cd "$APP_DIR"
npm ci
# nếu không có package-lock phù hợp: npm install

# RAM thấp: tăng swap hoặc
export NODE_OPTIONS='--max-old-space-size=4096'
npm run build

test -f .next/BUILD_ID && echo "BUILD_OK $(cat .next/BUILD_ID)"
```

Build thất bại thường do thiếu RAM — thêm swap 2–4 GB tạm:

```bash
fallocate -l 4G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
```

---

## 8. PM2 — chạy ổn định nhất

### 8.1. File ecosystem (tạo trên VDS)

`ecosystem.beego.production.cjs`:

```js
const path = require("path");
const appDir = __dirname; // đặt file này trong thư mục app

module.exports = {
  apps: [
    {
      name: "beego",
      cwd: appDir,
      script: path.join(appDir, "node_modules/next/dist/bin/next"),
      args: "start -H 127.0.0.1 -p 3025",
      interpreter: "node",
      interpreter_args: "--env-file=.env.local",
      env: { NODE_ENV: "production" },
      max_memory_restart: "800M",
      autorestart: true,
    },
  ],
};
```

`ecosystem.voice.config.cjs` (đã có trong repo — sửa `cwd` cho khớp `APP_DIR`):

- Port gateway cũ: **3031**
- Queues mặc định: `voice-llm`, `voice-tts`, `voice-usage`

`docs/learn-call-ecosystem.example.cjs` (copy thành `ecosystem.voice-learn.cjs`, sửa `cwd`):

- Port gateway Learn: **3033**
- Queues: `voice-llm-learn`, `voice-tts-learn`, `voice-usage-learn`
- `LEARN_AI_CALL_RUNTIME_GATE: "1"`

### 8.2. Khởi động

```bash
cd "$APP_DIR"
# Sửa cwd trong các ecosystem*.cjs cho đúng APP_DIR trước khi start

pm2 start ecosystem.beego.production.cjs
pm2 start ecosystem.voice.config.cjs
pm2 start ecosystem.voice-learn.cjs   # từ bản copy example Learn

pm2 save
pm2 startup
# chạy đúng lệnh systemd mà pm2 in ra

pm2 list
```

Kỳ vọng online:

```
beego
beego-voice-gateway
beego-voice-llm
beego-voice-tts
beego-voice-usage
beego-voice-gateway-learn
beego-voice-llm-learn
beego-voice-tts-learn
```

Mở cổng kiểm tra local:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3025/api/health
ss -lntp | grep -E '3025|3031|3033'
```

### 8.3. Mở gate Learn Call

Gateway Learn chỉ nhận cuộc gọi khi Redis key đúng `"1"`:

```bash
redis-cli SET voice:learn-call-gate 1
redis-cli GET voice:learn-call-gate
```

Đóng khẩn cấp (cắt cuộc gọi đang mở):

```bash
redis-cli SET voice:learn-call-gate 0
```

---

## 9. nginx + HTTPS + WebSocket

### 9.1. Site mẫu

Tạo `/etc/nginx/sites-available/beego.conf` (đổi `DOMAIN` và đường dẫn SSL):

```nginx
upstream beego_next {
    server 127.0.0.1:3025;
    keepalive 16;
}

server {
    listen 80;
    server_name DOMAIN_CUA_BAN www.DOMAIN_CUA_BAN;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name DOMAIN_CUA_BAN www.DOMAIN_CUA_BAN;

    # ssl_certificate     /etc/letsencrypt/live/DOMAIN_CUA_BAN/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/DOMAIN_CUA_BAN/privkey.pem;

    charset utf-8;
    client_max_body_size 25m;

    # App
    location / {
        proxy_pass http://beego_next;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "";
        proxy_read_timeout 120s;
    }

    # Luyện nói cũ
    location /voice {
        proxy_pass http://127.0.0.1:3031;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }

    # Gọi gia sư AI (Learn Call)
    location /voice-learn {
        proxy_pass http://127.0.0.1:3033;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 3600s;
        proxy_send_timeout 3600s;
    }
}
```

Có thể tham khảo thêm: `deploy/nginx-voice.conf`, `deploy/nginx-beego-security-headers.conf`.

```bash
ln -sf /etc/nginx/sites-available/beego.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
```

### 9.2. SSL Let’s Encrypt

```bash
certbot --nginx -d DOMAIN_CUA_BAN -d www.DOMAIN_CUA_BAN
```

Mobile/micro **bắt buộc HTTPS**; `wss://` phải cùng domain.

---

## 10. Google OAuth / DNS / email admin

1. Google Cloud Console → OAuth client Web:
   - Authorized redirect URI: `https://DOMAIN/api/auth/google/callback`
2. Cập nhật `GOOGLE_CALLBACK_URL` và `NEXT_PUBLIC_APP_URL` trong `.env.local`
3. DNS: `A`/`AAAA` domain → IP VDS; đợi propagate
4. `ADMIN_EMAILS` = email bạn dùng đăng nhập để test Learn Call trước
5. (Tuỳ chọn) `LEARN_AI_CALL_ALLOWLIST` khi muốn mở cho học viên cụ thể mà chưa mở rộng quyền gói

Sau đổi `.env.local`:

```bash
pm2 restart beego beego-voice-gateway beego-voice-gateway-learn \
  beego-voice-llm beego-voice-llm-learn \
  beego-voice-tts beego-voice-tts-learn \
  beego-voice-usage --update-env
```

Chỉ dùng `--update-env` khi **cố ý** nạp lại env; stack Learn/web production hiện tại thường start bằng `--env-file=.env.local` nên sửa file rồi `pm2 restart <tên>` là đủ với nhiều setup.

---

## 11. Checklist “chạy tốt” sau deploy

### 11.1. Hệ thống

- [ ] `curl -I https://DOMAIN` → 200
- [ ] `curl -s https://DOMAIN/api/health` → OK
- [ ] `pm2 list` — 8 app `online`, không restart vòng
- [ ] `redis-cli ping` → PONG
- [ ] MySQL: login `beego_app` đọc được `users`
- [ ] `ss -lntp` chỉ thấy 3025/3031/3033 trên `127.0.0.1`

### 11.2. Auth

- [ ] Đăng nhập email/password hoặc Google
- [ ] `/api/auth/me` trả user đúng

### 11.3. Learn Call (quan trọng)

- [ ] `redis-cli GET voice:learn-call-gate` = `1`
- [ ] Admin vào bài Học → **Gọi gia sư AI**
- [ ] Chọn mức Dễ/Vừa/Khó + gia sư → bắt đầu gọi
- [ ] Có lời chào TTS, micro nghe được (HTTPS)
- [ ] Trả lời tên → câu hỏi tiếp theo **không** lặp goodbye máy móc
- [ ] Có gợi ý trả lời (nếu câu hỏi khớp facet)
- [ ] Kết thúc → tổng kết từ server, phát âm = “Chưa đánh giá” (đúng thiết kế hiện tại)

### 11.4. Voice cũ (nếu còn dùng)

- [ ] `wss://DOMAIN/voice` kết nối được từ client cũ

### 11.5. Log khi lỗi

```bash
pm2 logs beego --lines 80
pm2 logs beego-voice-gateway-learn --lines 80
pm2 logs beego-voice-llm-learn --lines 80
tail -n 100 /var/log/nginx/error.log
```

---

## 12. Tối ưu hiệu năng & ổn định

1. **Không** expose MySQL/Redis/Node ra 0.0.0.0.
2. Giữ `max_memory_restart` trên PM2 (web ~800M, worker ~400M).
3. Redis `maxmemory-policy` phù hợp (tránh OOM làm tụt queue) — ví dụ `allkeys-lru` nếu cần giới hạn RAM.
4. Backup định kỳ:

   ```bash
   mysqldump --single-transaction --routines --triggers --events \
     --databases beego_vn | gzip > /root/backups/beego_vn-$(date +%F).sql.gz
   ```

5. Sau `git pull` production:

   ```bash
   cd "$APP_DIR"
   git pull origin main
   npm ci
   npm run build
   # đóng gate Learn nếu đang có user gọi
   redis-cli SET voice:learn-call-gate 0
   pm2 restart beego beego-voice-gateway-learn beego-voice-llm-learn beego-voice-tts-learn
   # stack cũ chỉ restart khi commit đụng chung worker
   redis-cli SET voice:learn-call-gate 1
   ```

6. Monitor: `pm2 install pm2-logrotate` (tuỳ chọn).
7. Timezone: `timedatectl set-timezone Asia/Ho_Chi_Minh`.

---

## 13. Sự cố thường gặp

| Triệu chứng | Nguyên nhân hay gặp | Cách xử |
| --- | --- | --- |
| Trang 502 | `beego` down / sai upstream | `pm2 restart beego`; `nginx -t` |
| Micro không lên trên điện thoại | Không HTTPS / mixed content | Bắt buộc `https` + `wss` |
| Learn Call “chưa mở” / từ chối | Gate Redis ≠ `1` hoặc không phải admin/Pro | `SET voice:learn-call-gate 1`; kiểm tra `ADMIN_EMAILS` / gói |
| Cuộc gọi cắt `worker_outdated` | LLM worker Learn lệch code gateway | Restart cùng commit: gateway-learn + llm-learn |
| Không có TTS | Azure key/region sai; TTS worker down | `pm2 logs beego-voice-tts-learn` |
| LLM trả lời lạc đề / goodbye lặp | Code cũ trước bản topic practice | Pull `main` mới nhất + rebuild + restart Learn stack |
| OpenAI/Azure “thiếu key” dù đã có trong file | PM2 env set chuỗi rỗng ghi đè | Xóa key rỗng khỏi PM2 env; dùng `--env-file=.env.local` |
| Build OOM | RAM thấp | Swap + `NODE_OPTIONS=--max-old-space-size=4096` |
| Google login lỗi redirect | Callback URL chưa cập nhật domain mới | Sửa Google Console + `.env.local` |

---

## 14. Bảo mật

- `.env.local` quyền `600`, owner đúng user chạy app
- Không đặt dump SQL / zip DB trong `public/`
- Đổi mọi mật khẩu DB/Redis/JWT khi chuyển VDS nếu dump từng expose
- Chỉ admin SSH; tắt password login nếu dùng key
- Giữ `LEARN_AI_CALL_QUOTA_MODE` **không** bằng `test` trên production
- Rotate Azure/OpenAI key nếu từng lộ trong chat/log

---

## 15. Thứ tự triển khai nhanh (checklist 1 trang)

1. Cài Node 22, MySQL 8, Redis, nginx, PM2, firewall  
2. Clone `main` → `APP_DIR`  
3. Restore `beego_vn.sql` → user `beego_app`  
4. Tạo `.env.local` (domain + secrets)  
5. `npm ci && npm run build`  
6. PM2: web + voice cũ + voice Learn  
7. nginx `/` + `/voice` + `/voice-learn` + SSL  
8. `redis-cli SET voice:learn-call-gate 1`  
9. Đổi Google OAuth callback  
10. Smoke: health, login admin, 1 cuộc gọi Learn Call end-to-end  

---

## 16. Liên kết trong repo

| File | Nội dung |
| --- | --- |
| `docs/huong-dan-deploy.md` | Tài liệu này (VDS mới end-to-end) |
| `docs/learn-call-deploy.md` | Deploy/rollback Learn Call chi tiết |
| `docs/learn-call-ecosystem.example.cjs` | Mẫu PM2 stack Learn |
| `ecosystem.voice.config.cjs` | Mẫu PM2 stack voice cũ |
| `deploy/nginx-voice.conf` | Đoạn nginx `/voice` |
| `deploy/nginx-beego-security-headers.conf` | Security headers |

---

**Kết thúc.** Nếu domain, OAuth và secret Azure/OpenAI đúng, đúng 8 process PM2 online và gate Redis = `1`, Beego trên VDS mới sẽ chạy tương đương production hiện tại.
