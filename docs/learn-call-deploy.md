# Learn Call (Gọi gia sư AI, tab Học): triển khai, rollback, checklist thiết bị thật

Trạng thái: **chưa triển khai**. Tài liệu này dành cho người vận hành khi đã đủ điều kiện ở mục 1.

## 0. Phạm vi bản phát hành

| Mốc | Tag (cục bộ, chưa push) | Nội dung |
| --- | --- | --- |
| Bản phát hành | `learn-call-r1` (nhánh `release/learn-call-r1`) | Learn Call bước 2–8 |
| Bản đang chạy / rollback | `learn-call-live-20261009` = `0eaa840` | Mã đã build ra `.next` live `_d7CBfa-5KLOgaUHrbr_X` |

Một bản phát hành gồm **bốn tiến trình PM2, cùng một commit**:

| PM2 | Vai trò | Cổng / hàng đợi |
| --- | --- | --- |
| `beego` | Web Next.js (giao diện `LearnCallRoom`, API `/api/learn/ai-call/*`) | 3025 |
| `beego-voice-gateway-learn` | Gateway WebSocket Learn, STT Azure | 3033 (nginx `/voice-learn`) |
| `beego-voice-llm-learn` | Worker LLM Learn | `voice-llm-learn` |
| `beego-voice-tts-learn` | Worker TTS Learn | `voice-tts-learn` |

**Không** restart stack luyện nói cũ: `beego-voice-gateway` (3031), `beego-voice-llm`, `beego-voice-tts`, `beego-voice-usage`.
Không dùng `--update-env`. Không đổi allowlist, admin, Pro/VIP. Không chạy migration.

Danh sách file thay đổi luôn lấy từ git, không chép tay:

```bash
git diff --name-status --no-renames learn-call-live-20261009 learn-call-r1   # 18 M, 15 A, 0 D
```

Luật quyền truy cập (`decideLearnAiCallAccess`, `learnAiCallEmailAllowed`, admin bypass, gói Pro/VIP, route
`access`/`status`, `lib/auth`) **không đổi** giữa hai mốc.

### Vì sao phải cùng phiên bản

| Kết hợp lệch | Hậu quả |
| --- | --- |
| Web mới + gateway cũ | Client gửi `recognition_end`, `playback_ack`, `repeat_last`; gateway cũ không xử lý đúng. Không hỗ trợ. |
| Gateway mới + worker LLM cũ | Worker cũ bỏ qua `learn` và trả lời bằng prompt luyện nói chung. Gateway mới nhận ra (thiếu `learn: 1`), **kết thúc cuộc gọi** với lý do `worker_outdated`, không lưu lượt, không gửi TTS. Đây là chốt an toàn, **không** phải tương thích hành vi. |
| Gateway mới + worker TTS cũ | Worker cũ có thể gửi `tts_end` trước vài chunk audio cuối; lượt có thể không được xác nhận "Đã phát hết". |
| Web cũ + gateway mới | Client cũ không gửi `recognition_end` / `playback_ack` theo luồng mới. Không hỗ trợ. |

`voice-llm-worker.mjs` và `voice-tts-worker.mjs` **dùng chung** với stack cũ. Thay đổi đã được kiểm tra tương thích với
luyện nói cũ (kịch bản `legacy`), nhưng stack cũ chỉ nạp mã mới khi bị restart.

## 1. Điều kiện bắt buộc trước khi triển khai

- [ ] Người có quyền rà soát và duyệt commit `learn-call-r1`; quyết định có push nhánh/tag lên remote hay không.
- [ ] Quyết định allowlist. Hiện `.env.local` **không có** `LEARN_AI_CALL_ALLOWLIST`; chỉ admin (`ADMIN_EMAILS`) vào được.
- [ ] Checklist thiết bị thật (mục 5) đạt. Micro trên điện thoại cần HTTPS, nên chỉ làm được sau triển khai (gate mở, chỉ admin) hoặc trên một môi trường HTTPS riêng nếu được dựng thêm.
- [ ] Người vận hành đọc giá trị hiện tại của `voice:learn-call-gate` trên Redis production và ghi lại.
- [ ] Có khung giờ triển khai: cuộc gọi Learn đang mở sẽ bị cắt khi đóng gate; web `beego` gián đoạn vài giây khi restart (mô phỏng: khoảng 3,5 giây).
- [ ] Ghi nhận rằng `next lint` chưa được cấu hình trong repo (lệnh mở prompt tương tác), nên không có bước lint tự động.

## 2. Phiên bản đang chạy (đã xác minh đến đâu)

Ảnh chụp rollback: `/var/www/beego_vn_usr/data/releases/rollback-live-20261009/` (quyền 750, ngoài thư mục web).

| Thành phần | Bằng chứng | Mức chắc chắn |
| --- | --- | --- |
| Web `.next` live `_d7CBfa-5KLOgaUHrbr_X` | Build lại `0eaa840` tại đúng đường dẫn production: 105 file static giống hệt; manifest giống sau khi sắp xếp; khác biệt còn lại là tên chunk, thứ tự chunk-map, 2 cờ build tạm và trang prerender theo ngày | Cao. Bản sao: `next-live/` |
| Script gateway/LLM/TTS Learn | Theo nhật ký phiên làm việc, không sửa sau lúc khởi động (09/10 13:08) đến commit | Trung bình (chỉ thấy sửa qua agent) |
| `ai-call-access.js` gateway Learn đã nạp | Bản trước lần sửa 14:14; dựng lại: `ai-call-access.live-gateway.js`. 12 hàm gateway dùng giống hệt bản `0eaa840` | Trung bình |
| `.env.local` | Không đổi từ 09/10 13:08:42; sha256 lưu ở `runtime-fingerprint.txt` | Cao |
| Env PM2 | `pm2-live.json` (giá trị không bí mật + tên khóa) | Cao |
| nginx | Bản sao `nginx-beego.vn.conf` | Cao |

Không xác minh được: chỉnh sửa thủ công ngoài phiên làm việc; mã thực sự trong bộ nhớ của tiến trình; toàn vẹn
`node_modules` ngoài mtime và `package-lock.json`.

Lưu ý env của `beego`: env PM2 của web có `OPENAI_API_KEY`, `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` là **chuỗi rỗng**.
Next.js không ghi đè biến đã có (kể cả rỗng) bằng `.env.local`, nên web đang chạy không có ba khóa này. Learn Call không
dùng chúng ở web. `pm2 restart` không có `--update-env` giữ nguyên tình trạng này; sửa là quyết định riêng.

## 3. Các bước triển khai

Chạy trong `/var/www/beego_vn_usr/data/www/beego.vn`. Lấy Redis production từ `.env.local` mà không in ra:

```bash
cd /var/www/beego_vn_usr/data/www/beego.vn
PROD_REDIS="$(grep '^REDIS_URL=' .env.local | cut -d= -f2- | tr -d '"')"
rc() { redis-cli -u "$PROD_REDIS" "$@"; }
FROM=learn-call-live-20261009; TO=learn-call-r1
```

1. **Ghi lại trạng thái trước**

   ```bash
   git rev-parse HEAD; git status --short | wc -l
   cat .next/BUILD_ID                      # mong đợi: _d7CBfa-5KLOgaUHrbr_X
   pm2 jlist | python3 -c 'import json,sys;[print(p["name"],p["pid"],p["pm2_env"]["status"]) for p in json.load(sys.stdin) if p["name"].startswith("beego")]'
   GATE_BEFORE="$(rc GET voice:learn-call-gate)"; echo "gate=$GATE_BEFORE"   # ghi lại để rollback
   ```

2. **Đồng bộ mã nguồn từ tag** (chỉ ghi file làm việc, không đổi index hay HEAD):

   ```bash
   git diff --name-only --no-renames --diff-filter=AM $FROM $TO > /root/learn-call-r1-files.txt
   git restore --source=$TO --worktree -- $(cat /root/learn-call-r1-files.txt)
   while read f; do [ "$(git hash-object -- "$f")" = "$(git rev-parse "$TO:$f")" ] || echo "DIFF $f"; done < /root/learn-call-r1-files.txt   # mong đợi: không in gì
   ```

   `git diff $TO -- <file>` không dùng để kiểm tra được vì file mới chưa có trong index.

3. **Build web vào thư mục riêng** (không build vào `.next` đang chạy):

   ```bash
   rm -rf .next-call-deploy && NEXT_DIST_DIR=.next-call-deploy npm run build
   test -f .next-call-deploy/BUILD_ID && ls .next-call-deploy/server/app/api/learn/ai-call
   git checkout -- tsconfig.json             # next build tự thêm .next-call-deploy/types vào include
   git status --short tsconfig.json          # mong đợi rỗng
   ```

4. **Đóng gate**. Gateway Learn kết thúc mọi cuộc gọi đang mở trong khoảng 2 giây (`feature_disabled`); API và gateway từ chối phiên mới.

   ```bash
   rc SET voice:learn-call-gate 0
   sleep 5
   ss -tn state established '( sport = :3033 )' | tail -n +2 | wc -l   # mong đợi 0
   ```

5. **Chờ hàng đợi Learn rỗng**

   ```bash
   for q in voice-llm-learn voice-tts-learn; do echo "$q wait=$(rc LLEN bull:$q:wait) active=$(rc LLEN bull:$q:active)"; done
   ```

6. **Đổi bản web** (giữ bản cũ để rollback):

   ```bash
   OLD_ID="$(cat .next/BUILD_ID)"
   mv .next ".next-prev-$OLD_ID" && mv .next-call-deploy .next
   ```

7. **Restart đúng bốn tiến trình** (không `--update-env`):

   ```bash
   pm2 restart beego beego-voice-gateway-learn beego-voice-llm-learn beego-voice-tts-learn
   ```

8. **Kiểm tra sau restart**

   ```bash
   pm2 status | grep -E 'beego'                       # 4 tiến trình online, số restart không tăng tiếp
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3025/
   pm2 logs beego-voice-gateway-learn --lines 5 --nostream   # "ws://...:3033 | azure=on | redis=on | jwt=on"
   pm2 logs beego-voice-llm-learn --lines 3 --nostream       # "[voice-llm-worker] started"
   pm2 logs beego-voice-tts-learn --lines 3 --nostream       # "[voice-tts-worker] started"
   ```

   Stack cũ (3031) và `beego-voice-usage` phải giữ nguyên pid.

9. **Mở gate** (khi allowlist rỗng, chỉ admin dùng được), rồi chạy checklist mục 5 bằng tài khoản admin:

   ```bash
   rc SET voice:learn-call-gate 1
   ```

   Nếu gặp `worker_outdated` trong `pm2 logs beego-voice-gateway-learn`, worker LLM Learn chưa chạy mã mới; đóng gate và kiểm tra lại bước 7.

## 4. Rollback đồng bộ

Rollback khi: cuộc gọi lỗi hàng loạt, có log `worker_outdated`, web 5xx, hoặc thiết bị thật không đạt.

1. Đóng gate: `rc SET voice:learn-call-gate 0`, chờ 5 giây, kiểm tra hàng đợi như bước 5.
2. Đưa mã về mốc cũ:

   ```bash
   git restore --source=$FROM --worktree -- $(git diff --name-only --no-renames --diff-filter=M $FROM $TO)
   git diff --name-only --no-renames --diff-filter=A $FROM $TO | xargs -r rm -f --   # file mới; vẫn còn trong tag learn-call-r1
   git status --short | grep -v '^??'                                                # mong đợi rỗng (so với HEAD 0eaa840)
   ```

3. Đổi lại bản web: `mv .next ".next-failed-$(cat .next/BUILD_ID)" && mv ".next-prev-$OLD_ID" .next`
   (`OLD_ID` = `_d7CBfa-5KLOgaUHrbr_X`). Nếu `.next-prev-*` đã mất: `cp -a /var/www/beego_vn_usr/data/releases/rollback-live-20261009/next-live .next`.
4. Restart đúng bốn tiến trình như bước 7.
5. Đặt gate về `GATE_BEFORE`.
6. Gọi thử bằng tài khoản admin.

Lưu ý khi rollback:

- Gateway Learn đang chạy hiện nay đã nạp `ai-call-access.js` bản trước 14:14 (xem mục 2). Rollback dùng bản `0eaa840`;
  12 hàm gateway dùng giống hệt, và tổ hợp này đã chạy đạt trong mô phỏng (mục 6). Bản dựng lại nằm ở
  `rollback-live-20261009/ai-call-access.live-gateway.js` nếu cần đối chiếu.
- Khóa Redis mà bản mới tạo ra (`voice:learn-call-reply:*`, `voice:learn-call-heard:*`) tự hết hạn sau 1 giờ.
- Không restart stack 3031 trong rollback.

## 5. Checklist thiết bị thật (admin)

Chưa thực hiện: môi trường kiểm thử không có micro hoặc loa thật. Mỗi mục ghi thiết bị, trình duyệt, kết quả và thời gian.

| Thiết bị | Trình duyệt | Âm thanh | Người thử | Kết quả |
| --- | --- | --- | --- | --- |
| Máy tính (Windows hoặc macOS) | Chrome hoặc Edge | Loa ngoài + tai nghe | | |
| iPhone (iOS hiện hành) | Safari | Loa ngoài + tai nghe (có thể thêm Bluetooth) | | |
| Android | Chrome | Loa ngoài + tai nghe (có thể thêm Bluetooth) | | |

Trên từng thiết bị:

- [ ] Bấm "Bắt đầu" mới hỏi quyền micro. Nếu từ chối thì thấy thông báo rõ, và "Cho phép micro" thử lại được.
- [ ] Nghe rõ câu chào trong khoảng 4 giây. Trong lúc phát, nút là "NGẮT LỜI"; nút chỉ về "NHẤN ĐỂ NÓI" khi tiếng đã dừng hẳn.
- [ ] Nói một câu tiếng Anh với giọng Việt, bấm "GỬI CÂU TRẢ LỜI": phụ đề đúng câu đã nói, gia sư trả lời trong khoảng 2–4 giây.
- [ ] Bật loa ngoài: tiếng gia sư không bị nhận thành lời người học (micro chỉ mở khi bấm nói).
- [ ] Bấm "NGẮT LỜI" giữa câu trả lời: tiếng dừng ngay; CC ghi "Bị ngắt khi đang phát"; nói tiếp được.
- [ ] Nút nghe lại (↺) phát lại đúng câu và không đổi trạng thái của lượt.
- [ ] CC: lượt nghe hết ghi "Đã phát hết"; lượt chưa nghe hết không bị ghi là "Đã phát hết".
- [ ] iPhone: thử khi bật công tắc im lặng; chuyển app hoặc khóa màn hình giữa cuộc gọi thì micro và tiếng dừng, có thông báo, không kẹt.
- [ ] Mất mạng giữa cuộc gọi (bật chế độ máy bay): dừng media, thông báo rõ; mở lại không nối được vào phiên đã đóng.
- [ ] Đủ 2 phút: gia sư chào kết thúc, có tổng kết từ server, "Phát âm: Chưa đánh giá".
- [ ] Sau cuộc gọi: XP, Honey và kết quả bài không đổi; mức 2 không mở; không trừ phút thương mại.
- [ ] Hai tab hoặc hai thiết bị cùng tài khoản: tab thứ hai nhận "Một cuộc gọi đang mở".
- [ ] Đổi đường âm thanh giữa chừng (cắm hoặc rút tai nghe, kết nối Bluetooth): không kẹt trạng thái.

Quyền học viên (một lần, bằng tài khoản học viên Pro không phải admin, không nằm trong allowlist):

- [ ] Không mở được cuộc gọi: API trả `FEATURE_DISABLED`, giao diện không cho bắt đầu gọi.
- [ ] Bài học, XP, Honey và luyện nói cũ (tab Luyện nói, cổng 3031) vẫn hoạt động như trước.

## 6. Bằng chứng kiểm thử

### Mô phỏng chuyển phiên bản và rollback (14/10/2026)

Môi trường tách biệt: worktree `0eaa840` với bản sao `.next` live, PM2 riêng (`PM2_HOME=/root/.pm2-lcsim`, 4 app
`lcsim-*` cùng script, node args và dạng env như production), Redis Docker riêng `127.0.0.1:6397`, web `127.0.0.1:3099`,
gateway `127.0.0.1:3134`, hàng đợi `lcsim-learn-*`, cơ sở dữ liệu `beego_call_preview`. Admin chỉ qua `ADMIN_EMAILS`
của mô phỏng; không đặt allowlist. Web mô phỏng cũng có ba khóa rỗng như production. Azure STT, OpenAI là dịch vụ thật.

Thứ tự đã chạy đúng như mục 3 và 4:

| Giai đoạn | Kết quả |
| --- | --- |
| Bản cũ (`0eaa840` + `.next` live) | Smoke 7/7 (trang bài học từ đúng `.next`, học viên Pro bị từ chối `FEATURE_DISABLED`, admin mở phiên, chào có audio + `tts_end`, `end_call` có tổng kết). Đóng gate 9/9: cuộc gọi đang mở kết thúc `feature_disabled` sau 1,7 giây, phiên mới bị từ chối, hàng đợi rỗng. |
| Chuyển sang `learn-call-r1` | 33 file khớp blob của tag; build 3 phút 17 giây; `tsconfig.json` bị build sửa và đã khôi phục; web trả 200 sau 3,5 giây; 4 app online. |
| Bản mới | Smoke 7/7, đóng gate 9/9, tích hợp 75/75, API 16/16, E2E Chromium (micro giả) 17/17. |
| Rollback | File tracked trở về `0eaa840`, file mới đã xóa, `.next` = `_d7CBfa-5KLOgaUHrbr_X`; web 200 sau 2,7 giây; smoke 7/7, đóng gate 9/9. |

Tám tiến trình PM2 production giữ nguyên pid trong suốt quá trình.

### Bước 8 (môi trường tách biệt)

- `scripts/test-learn-call-integration.mjs`: 75/75 gồm lifecycle, recognition, interrupt, network, deadline, closing, legacy; riêng kịch bản `outdated` (chạy với worker LLM của HEAD) đạt 3/3.
- `scripts/test-learn-call-api.mjs`: 16/16 qua API thật.
- Các test cũ: `gateway`, `summary`, `clock`, `azure`, `isolate`, `package` đều đạt. Test thuần: `playback`, `talk`, `lifecycle`, `transcript`, `tutor`, `ai-call-access`, `ai-call-plan-counts` đều đạt.
- E2E giao diện thật trên Chromium headless (micro giả): 17/17. Đây không phải kiểm tra trên thiết bị thật.

Chạy lại: xem đầu mỗi file test; mọi test yêu cầu `REDIS_URL` khác Redis trong `.env.local` (`scripts/learn-call-test-env.mjs` từ chối chạy nếu trùng).

## 7. Cấu hình mẫu (không có secret)

- PM2 cho stack Learn: `docs/learn-call-ecosystem.example.cjs`. Khi đã có các app thì vẫn dùng `pm2 restart <tên>`.
- Các khóa `.env.local` cần có (giá trị lấy từ kho secret, không ghi vào repo):

```dotenv
REDIS_URL=redis://<host>:<port>
VOICE_JWT_SECRET=<secret>
OPENAI_API_KEY=<secret>
OPENAI_CHAT_MODEL=gpt-4o-mini
AZURE_SPEECH_KEY=<secret>
AZURE_SPEECH_REGION=<region>
LEARN_AI_CALL_ENABLED=1
LEARN_AI_CALL_WS_URL=wss://beego.vn/voice-learn
# LEARN_AI_CALL_ALLOWLIST=<email1,email2>   # chưa đặt: chỉ admin (ADMIN_EMAILS) dùng được
# Không đặt LEARN_AI_CALL_QUOTA_MODE=test trên production.
```

- Biến riêng của stack Learn đặt trong PM2 env, không đặt trong `.env.local`: `VOICE_WS_PORT=3033`, `VOICE_LLM_QUEUE=voice-llm-learn`,
  `VOICE_TTS_QUEUE=voice-tts-learn`, `VOICE_USAGE_QUEUE=voice-usage-learn`, `LEARN_AI_CALL_RUNTIME_GATE=1`.
- Công tắc khẩn cấp: Redis key `voice:learn-call-gate` (`1` = mở; giá trị khác = đóng và cắt cuộc gọi đang mở).
