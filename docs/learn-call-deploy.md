# Learn Call (Gọi gia sư AI, tab Học): triển khai, rollback, checklist thiết bị thật

Trạng thái: **chưa triển khai**. Tài liệu này dành cho người vận hành khi đã đủ điều kiện ở mục 1.

## 0. Phạm vi bản phát hành

Một bản phát hành gồm **bốn tiến trình PM2, cùng một commit**:

| PM2 | Vai trò | Cổng / hàng đợi |
| --- | --- | --- |
| `beego` | Web Next.js (giao diện `LearnCallRoom`, API `/api/learn/ai-call/*`) | 3025 |
| `beego-voice-gateway-learn` | Gateway WebSocket Learn, STT Azure | 3033 (nginx `/voice-learn`) |
| `beego-voice-llm-learn` | Worker LLM Learn | `voice-llm-learn` |
| `beego-voice-tts-learn` | Worker TTS Learn | `voice-tts-learn` |

**Không** restart stack luyện nói cũ: `beego-voice-gateway` (3031), `beego-voice-llm`, `beego-voice-tts`, `beego-voice-usage`.
Không dùng `--update-env`. Không đổi allowlist, admin, Pro/VIP. Không chạy migration.

Mã nguồn thay đổi (so với HEAD `0eaa840`): `components/beego/lesson-player/LearnCallRoom.jsx`, `LearnLessonCall.jsx`,
`LearnCallCharacter.jsx` (mới), `hooks/useStreamingTtsPlayer.js`, `useVoiceRecorder.js`, `useVoiceWebSocket.js`,
`lib/beego/learn/ai-call-access.js`, `learn-call-{playback,talk,transcript,tutor}.js` (mới),
`app/api/learn/ai-call/session/route.js`, CSS `beego-learn.css`, `beego-lesson-player.css`,
`scripts/voice-ws-gateway.mjs`, `voice-llm-worker.mjs`, `voice-tts-worker.mjs`, và các script kiểm thử.

### Vì sao phải cùng phiên bản

| Kết hợp lệch | Hậu quả |
| --- | --- |
| Web mới + gateway cũ | Client gửi `recognition_end`, `playback_ack`, `repeat_last`; gateway cũ không xử lý đúng. Không hỗ trợ. |
| Gateway mới + worker LLM cũ | Worker cũ bỏ qua `learn` và trả lời bằng prompt luyện nói chung. Gateway mới nhận ra (thiếu `learn: 1`), **kết thúc cuộc gọi** với lý do `worker_outdated`, không lưu lượt, không gửi TTS. Đây là chốt an toàn, **không** phải tương thích hành vi. |
| Gateway mới + worker TTS cũ | Worker cũ có thể gửi `tts_end` trước vài chunk audio cuối; lượt có thể không được xác nhận "Đã phát hết". Client mới có phòng vệ, nhưng vẫn phải triển khai worker mới. |
| Web cũ + gateway mới | Client cũ không gửi `recognition_end` / `playback_ack` theo luồng mới. Không hỗ trợ. |

`voice-llm-worker.mjs` và `voice-tts-worker.mjs` **dùng chung** với stack cũ. Thay đổi đã được kiểm tra tương thích với
luyện nói cũ (kịch bản `legacy`), nhưng stack cũ chỉ nạp mã mới khi bị restart. Thư mục làm việc hiện tại chính là thư
mục production, nên một lần restart ngoài kế hoạch (crash, `max_memory_restart`) sẽ nạp mã mới.

## 1. Điều kiện bắt buộc trước khi triển khai

- [ ] Commit và tag bản phát hành, ví dụ tag `learn-call-step8`; tag mốc cũ `learn-call-pre-step8` = `0eaa840`. Cần người có quyền duyệt.
- [ ] Quyết định allowlist. Hiện `.env.local` **không có** `LEARN_AI_CALL_ALLOWLIST`; chỉ admin vào được qua admin bypass.
- [ ] Checklist thiết bị thật (mục 5) đạt trên môi trường thử nghiệm hoặc bằng tài khoản admin sau triển khai, khi gate chỉ mở cho admin.
- [ ] Người vận hành đọc giá trị hiện tại của `voice:learn-call-gate` trên Redis production và ghi lại (việc kiểm thử không đọc Redis production).
- [ ] Ghi nhận rằng `next lint` chưa được cấu hình trong repo (lệnh mở prompt tương tác), nên không có bước lint tự động.

## 2. Các bước triển khai

Chạy trong `/var/www/beego_vn_usr/data/www/beego.vn`. Lấy Redis production từ `.env.local` mà không in ra:

```bash
cd /var/www/beego_vn_usr/data/www/beego.vn
PROD_REDIS="$(grep '^REDIS_URL=' .env.local | cut -d= -f2- | tr -d '"')"
rc() { redis-cli -u "$PROD_REDIS" "$@"; }
```

1. **Ghi lại trạng thái trước**

   ```bash
   git rev-parse HEAD; git status --short | wc -l
   cat .next/BUILD_ID                      # hiện tại: _d7CBfa-5KLOgaUHrbr_X
   pm2 jlist | python3 -c 'import json,sys;[print(p["name"],p["pid"],p["pm2_env"]["status"]) for p in json.load(sys.stdin) if p["name"].startswith("beego")]'
   rc GET voice:learn-call-gate            # ghi lại để rollback
   ```

2. **Build web vào thư mục riêng** (không build vào `.next` đang chạy; dùng môi trường production thuần, không có biến của môi trường thử nghiệm):

   ```bash
   rm -rf .next-call-deploy && NEXT_DIST_DIR=.next-call-deploy npm run build
   test -f .next-call-deploy/BUILD_ID && ls .next-call-deploy/server/app/api/learn/ai-call
   ```

3. **Đóng gate**. Gateway Learn kết thúc mọi cuộc gọi đang mở trong vòng khoảng 2 giây (`feature_disabled`); API và gateway từ chối phiên mới.

   ```bash
   rc SET voice:learn-call-gate 0
   sleep 5
   ss -tn state established '( sport = :3033 )' | tail -n +2 | wc -l   # mong đợi 0
   ```

4. **Chờ hàng đợi Learn rỗng**

   ```bash
   for q in voice-llm-learn voice-tts-learn; do echo "$q wait=$(rc LLEN bull:$q:wait) active=$(rc LLEN bull:$q:active)"; done
   ```

5. **Đổi bản web** (giữ bản cũ để rollback):

   ```bash
   OLD_ID="$(cat .next/BUILD_ID)"
   mv .next ".next-prev-$OLD_ID" && mv .next-call-deploy .next
   ```

6. **Restart đúng bốn tiến trình** (không `--update-env`):

   ```bash
   pm2 restart beego beego-voice-gateway-learn beego-voice-llm-learn beego-voice-tts-learn
   ```

7. **Kiểm tra sau restart**

   ```bash
   pm2 status | grep -E 'beego'                       # 4 tiến trình online, số restart không tăng tiếp
   curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:3025/
   pm2 logs beego-voice-gateway-learn --lines 5 --nostream   # "ws://...:3033 | azure=on | redis=on | jwt=on"
   pm2 logs beego-voice-llm-learn --lines 3 --nostream       # "[voice-llm-worker] started"
   pm2 logs beego-voice-tts-learn --lines 3 --nostream       # "[voice-tts-worker] started"
   ```

   Stack cũ (3031) phải giữ nguyên pid.

8. **Mở gate**. Khi allowlist rỗng, chỉ admin dùng được. Gọi thử bằng tài khoản admin trên thiết bị thật (mục 5), sau đó mới quyết định mở rộng allowlist.

   ```bash
   rc SET voice:learn-call-gate 1
   ```

   Nếu gặp `worker_outdated` trong `pm2 logs beego-voice-gateway-learn` ("Learn reply from an LLM worker without Learn support"), worker LLM Learn chưa chạy mã mới; đóng gate và kiểm tra lại bước 6.

## 3. Rollback đồng bộ

Rollback khi: cuộc gọi lỗi hàng loạt, có log `worker_outdated`, web 5xx, hoặc thiết bị thật không đạt.

1. Đóng gate: `rc SET voice:learn-call-gate 0`, chờ 5 giây.
2. Đưa mã về mốc cũ cho các file đã theo dõi trong git (file mới chưa được theo dõi không được mã HEAD import, có thể để nguyên):

   ```bash
   git stash push -m learn-call-step8-rollback -- \
     app/api/learn/ai-call/session/route.js app/beego-learn.css app/beego-lesson-player.css \
     components/beego/lesson-player/LearnCallRoom.jsx components/beego/lesson-player/LearnLessonCall.jsx \
     hooks/useStreamingTtsPlayer.js hooks/useVoiceRecorder.js hooks/useVoiceWebSocket.js \
     lib/beego/learn/ai-call-access.js scripts/voice-llm-worker.mjs scripts/voice-tts-worker.mjs scripts/voice-ws-gateway.mjs
   git diff --stat 0eaa840 -- scripts/voice-ws-gateway.mjs scripts/voice-llm-worker.mjs scripts/voice-tts-worker.mjs   # mong đợi rỗng
   ```

   Nếu bản phát hành đã được commit, dùng `git checkout learn-call-pre-step8 -- <các file trên>` thay cho `git stash`.
3. Đổi lại bản web: `mv .next ".next-failed-$(cat .next/BUILD_ID)" && mv ".next-prev-$OLD_ID" .next`.
4. Restart đúng bốn tiến trình như bước 6.
5. Đặt gate về giá trị đã ghi ở bước 1.
6. Gọi thử bằng tài khoản admin.

Lưu ý khi rollback:

- Các tiến trình Learn production hiện tại khởi động lúc 13:08 ngày 09/10, **trước** commit `92c4a82` (22:52, có sửa gateway và worker). Vì vậy mã đang chạy trong bộ nhớ không chắc trùng với HEAD. HEAD `0eaa840` và `.next` `_d7CBfa-5KLOgaUHrbr_X` là mốc gần nhất có thể tái tạo. Tổ hợp rollback này **chưa được kiểm thử tích hợp**, nên bắt buộc gọi thử sau rollback.
- Khóa Redis mà bản mới tạo ra (`voice:learn-call-reply:*`, `voice:learn-call-heard:*`) tự hết hạn sau 1 giờ. Phiên đang mở đã bị kết thúc ở bước 1.
- Không restart stack 3031 trong rollback.

## 4. Cấu hình mẫu (không có secret)

- PM2 cho stack Learn: `docs/learn-call-ecosystem.example.cjs`. File mô tả đúng cấu hình đang chạy; khi đã có các app thì vẫn dùng `pm2 restart <tên>`.
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

## 5. Checklist thiết bị thật

Chưa thực hiện trong bước 8: môi trường kiểm thử không có micro hoặc loa thật. Mỗi mục ghi thiết bị, trình duyệt, kết quả và thời gian.

Thiết bị tối thiểu: iPhone (Safari, iOS hiện hành), Android (Chrome), máy tính (Chrome hoặc Edge). Trên mỗi thiết bị thử với loa ngoài và với tai nghe; có thể thêm tai nghe Bluetooth.

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

## 6. Bằng chứng kiểm thử (môi trường tách biệt, 14/10/2026)

Môi trường: Redis Docker riêng `127.0.0.1:6397`, gateway `127.0.0.1:3134`, worker riêng (`it-learn-llm` / `it-learn-tts`), Next riêng `127.0.0.1:3099` (`.next-isolated`), cơ sở dữ liệu `beego_call_preview`. Azure STT, OpenAI chat và TTS là dịch vụ thật; micro là file WAV giọng tổng hợp.

- `scripts/test-learn-call-integration.mjs`: 75/75 gồm lifecycle, recognition, interrupt, network, deadline, closing, legacy; riêng kịch bản `outdated` (chạy với worker LLM của HEAD) đạt 3/3.
- `scripts/test-learn-call-api.mjs`: 16/16 qua API thật (hai POST đồng thời, phiên đã đóng không nối lại được).
- Các test cũ: `gateway`, `summary`, `clock`, `azure`, `isolate`, `package` đều đạt. Test thuần: `playback`, `talk`, `lifecycle`, `transcript`, `tutor`, `ai-call-access`, `ai-call-plan-counts` đều đạt.
- E2E giao diện thật trên Chromium headless (micro giả): 17/17, hai lần liên tiếp. Ba lượt gia sư đều được ack "Đã phát hết". Đây không phải kiểm tra trên thiết bị thật.
- Build `NEXT_DIST_DIR=.next-isolated npm run build` thành công.

Chạy lại: xem đầu mỗi file test; mọi test yêu cầu `REDIS_URL` khác Redis trong `.env.local` (`scripts/learn-call-test-env.mjs` từ chối chạy nếu trùng).
