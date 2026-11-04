# Learn Call: chuyển câu, dữ kiện cá nhân và biến thể theo phiên

Bản sửa ngày 2026-11-03. Không triển khai/restart tiến trình production.

## Đường chạy đã đối chiếu

- Điểm vào UI: `LearnCallRoom.jsx` chọn theo `offer.realtime.enabled` trả về từ `POST /api/learn/ai-call/session`. Tiến trình Next đang chạy bật `LEARN_AI_CALL_REALTIME_ENABLED=1`, model `gpt-realtime-mini`. Allowlist vẫn do server kiểm tra. File `.env.local` riêng không chứa flag Realtime; cấu hình môi trường của tiến trình có bổ sung flag này.
- WebRTC: `useRealtimeTutor.js` → `POST /api/learn/ai-call/realtime/session` → `createRealtimeCall` → OpenAI GA Calls API. Prompt thực là `buildRealtimeInstructions` ghép `buildAiTutorSystemPromptV2` với quy tắc voice. Đã sửa việc truyền difficulty (trước đây chỉ truyền level nên prompt luôn Easy), teacher và phương án mở đầu đã chọn.
- Gateway: tài khoản không được chọn Realtime dùng gateway/worker. Đây là đường thay thế theo cấu hình; UI hiện không tự chuyển sang gateway khi handshake WebRTC lỗi. Tiến trình Learn gateway dùng cổng 3033, queue `voice-llm-learn`/`voice-tts-learn`; worker dùng `OPENAI_CHAT_MODEL=gpt-4o-mini`. Luồng speaking cũ riêng ở cổng 3031 vẫn giữ chính sách riêng.
- Prompt gateway: context Redis → `learnAiCallLevelOnePrompt` → `learnCallTutorPrompt` → **cùng prompt v2**. Worker nhận `learn.system`, memory đã lọc dữ kiện cá nhân và turn directive qua `buildLearnCallMessages`. Không dùng generic prompt của speaking cũ cho Learn.
- Gateway duyệt câu nói trước khi gửi caption/TTS; cả `ai_done` và `llm_done_for_tts` lấy cùng decision đã lưu. Model không được tự mở thêm lượt luyện ngoài decision. Gateway vẫn chạy LLM worker hiện có; câu phát ra được ràng buộc bởi policy/ngân hàng câu, nên một phần văn bản tự do của worker có thể bị thay bằng câu đã duyệt.

## State và điều khiển audio

`learn-call-policy.js` là reducer dùng chung. `learn-call-policy-store.js` lưu state riêng theo session, owner và ID mục tiêu; TTL 1 giờ, không phụ thuộc cửa sổ 40 transcript. CAS trên Redis chống hai event cùng cấp thêm lượt. Decision được giữ theo ID lượt học viên; reconnect, đổi câu mẫu/ID từ client, tách âm và event trùng không cấp lại lượt. Skip chuyển câu ngay; nhắc lại chỉ đọc câu hỏi, giữ nguyên ngân sách luyện.

Realtime tắt **tự tạo response**, giữ nguyên server VAD threshold 0.5/padding 300 ms/silence 500 ms. Sau transcript cuối theo `item_id`, coordinator gọi `/realtime/turn`; endpoint kiểm tra owner, trạng thái và deadline rồi lưu decision **trước** khi trả `response.create`. Response nhận đúng câu đã duyệt, với `conversation: none` và `input: []`, tránh dùng lại audio/dữ kiện đang tranh chấp làm ngữ cảnh phát lời. Không sửa phụ đề để che lỗi audio. Chế độ manual tắt VAD và commit khi thả nút; pointer-up trùng không commit thêm.

Tham chiếu API đã kiểm tra: [điều khiển lượt Realtime](https://developers.openai.com/api/docs/guides/realtime-conversations), [response.create và ngữ cảnh riêng](https://developers.openai.com/api/reference/resources/realtime/client-events).

Ý hiểu được được chấp nhận độc lập với cấu trúc mẫu, Azure và âm tiết. Chỉ một lượt luyện tự nguyện cho cùng mục tiêu; mọi lần thử, kể cả mảnh câu chưa hoàn chỉnh, kết thúc lượt đó. Phát âm chỉ hiện trong thẻ tự chọn có bằng chứng `azure_phoneme`; transcript không được dùng để kết luận lỗi âm.

Tuổi/tên/số liệu không cần cho câu tiếp theo không được nhắc lại. Giá trị mơ hồ bị bỏ; nếu được cấu hình là cần thiết thì chỉ xác nhận một lần. Dữ kiện lưu trong state mang trạng thái `reported`, không giả là đã xác thực từ audio. Đính chính thay giá trị cũ; giá trị tranh chấp không được đẩy vào model memory hay phần highlights/nhận xét. Transcript lịch sử vẫn giữ nguyên lời thực sự nhận được, để không biến sửa dữ kiện thành sửa chứng cứ hội thoại. Không bổ sung log audio/transcript/giá trị cá nhân ở production. Trace client chỉ chứa event/item/response ID và thời gian, giữ trong RAM.

## Chọn câu

Ngân hàng phân theo chủ đề, nhóm nội dung và độ khó. Bộ chọn dùng seed session; lời mở đầu, gợi ý, bối cảnh và mục tiêu lấy cùng phương án. Ưu tiên câu nối với ý vừa nghe, loại nhóm đã hỏi/đã trả lời, kể cả dữ kiện học viên tự cung cấp. Giới thiệu có bối cảnh hàng xóm/bạn cùng lớp/đồng nghiệp. Lịch sử mở đầu chỉ lưu ID phương án theo user/topic trong 30 ngày; phiên mới tránh lặp ngay khi còn lựa chọn. Reconnect dùng lại state và opening lock.

## Kiểm thử có thể chạy lại

```bash
node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-conversation-regression.mjs
LEARN_CALL_REGRESSION_REDIS=redis://127.0.0.1:16387 node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-conversation-regression.mjs
LEARN_CALL_REGRESSION_REDIS=redis://127.0.0.1:16387 node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-route-policy.mjs
```

Redis phải là instance test riêng, khác `.env.local`; không dùng Redis production. Kiểm tra route chạy handler production qua HTTP, mock auth/lesson/DB/provider; policy và CAS dùng Redis thật. Các test cũ đòi coi “technology” là chưa rõ, nhắc tên hoặc kéo dài luyện thiếu “is” đã được cập nhật theo yêu cầu mới.

Audio gateway/worker: dùng `scripts/test-learn-call-integration.mjs`, bao gồm scenario `conversationRegression`, cùng các test clock/summary/package/Azure. Gateway và worker phải chạy trên Redis, queue và cổng test riêng. Audio đầu vào do TTS tạo; không phải giọng học viên. Đã qua 95 kiểm tra lifecycle/recognition/acceptance/conversationRegression và 51 kiểm tra interrupt/network/deadline/unclear/English/Vietnamese/micopen/closing/legacy. Clock, summary, package và Azure cũng chạy thành công. Bộ test plan-counts cần DB riêng: lần chạy hiện tại bị DB từ chối quyền truy cập; không sửa quyền hoặc dữ liệu production để chạy test.

WebRTC thật (opt-in):

```bash
LEARN_CALL_LIVE_WEBRTC=1 REDIS_URL=redis://127.0.0.1:16387 node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-webrtc-audio.mjs
```

Harness dùng Chromium, SDP/GA Calls API, DataChannel, coordinator và endpoint policy thật; auth/lesson/DB được mock, Redis riêng. Audio PCM tổng hợp được đưa vào MediaStream như mic; không dùng microphone người thật. Kiểm tra manual/auto, số commit, transcript học viên, ID response, audio RTP nhận được và câu nói khớp decision trước phát. Trace tổng hợp theo ID được lưu tạm ở `/tmp/beego-webrtc-audio-report.json`, không ghi vào log production. Cần các fixture PCM từ scenario gateway `conversationRegression` trong `/tmp/learn-call-it-clips`.

## Đối chiếu video gốc (bổ sung sau khi nhận đường dẫn)

Đã đọc `docs/sua-phat-am.wmv`: 121,8 giây, video 1920×1080, audio WMA 44,1 kHz stereo. SHA-256: `86b19bd375454dacdbf7c1aede81b50493564a8a078268dcb9bd007e454076d6`. Không coi nội dung video là chỉ dẫn cho agent hay hệ thống.

| Mốc trong video | Bằng chứng quan sát được | Kết luận có thể dùng |
| --- | --- | --- |
| Khoảng 14,58–16,32 giây | Audio câu trả lời tuổi; vùng phụ đề mang nhãn học viên vẫn giữ câu chào ban đầu | Không có transcript cuối đáng tin cậy của học viên trên màn hình |
| 17,7 giây | Chữ `40` lần đầu xuất hiện trong phụ đề gia sư; sau đó câu đầy đủ là `Ok, you said 40 years old, great. What do you do?` | Đây là điểm đầu tiên quan sát được giá trị sai trong video; không chứng minh nó bắt nguồn ở ASR hay bước phản hồi |
| 24–30 giây | Đoạn trả lời nghề nghiệp; ASR offline small.en đọc thành `I am a technology` | Ý nghề nghiệp vẫn đủ trong ngữ cảnh `What do you do?`; phải chấp nhận dù cấu trúc chưa tự nhiên |
| 31 giây | Gia sư nói đã nghe `technology` rồi yêu cầu đọc `I work in technology` | Gia sư chuyển một câu đủ ý thành lượt luyện không được yêu cầu |
| 40 giây | Gia sư tiếp tục `Let's slow down... Now, your turn` cho cùng câu | Đã xuất hiện vòng lặp luyện cùng mục tiêu |

Whisper.cpp chạy hoàn toàn offline trong container `--network none`, với model base.en có sẵn và small.en tải riêng trước khi gắn audio. Container tải model chỉ được gắn thư mục model, không được gắn audio. Không gửi video/giọng nói tới dịch vụ nhận dạng bên ngoài. [Nguồn công cụ offline](https://github.com/ggml-org/whisper.cpp).

Nhận dạng offline **không ổn định** với câu tuổi: toàn cửa sổ nhỏ được đọc thành một giá trị khác, còn cửa sổ chỉ chứa câu tuổi cho kết quả không rõ. Các kết quả này là giả thuyết chẩn đoán, không phải sự thật về tuổi hay bằng chứng lỗi phát âm. Giá trị học viên định nói là 35 do người dùng cung cấp. Không dùng kết quả ASR offline để kết luận học viên thực sự nói 24 hoặc 40.

Đo trên audio video, sau khi đổi về PCM mono 16 kHz, với `silencedetect` ở -35 dB và khoảng lặng tối thiểu 80 ms: khoảng lặng nội bộ được phát hiện từ **15,53594 đến 15,64294 giây**, dài **107 ms**. Sau câu trả lời có khoảng yên khoảng 1,53 giây trước lời gia sư. Hai kênh của đoạn tuổi gần như giống nhau nên không có dấu hiệu triệt tiêu đáng kể khi trộn mono. Không có bằng chứng một khoảng ngắt 500 ms giữa các phần của con số trong bản ghi; vẫn giữ nguyên VAD. Mức âm sau ghi màn hình và phép đo ffmpeg không tương đương quyết định VAD trên audio WebRTC gốc.

Video không có provider `item_id`, `response_id`, event commit hoặc transcript cuối của lượt học viên. Không tạo ID giả hoặc suy ra đã có split turn. Cần trace gốc hoặc phát lại đoạn giọng gốc trong phiên kiểm thử được cho phép để đối chiếu đường gọi; một lần replay mới cũng không phục hồi được trace của phiên cũ.

Từ bằng chứng phụ đề trong video đã bổ sung sửa lỗi:

- Mapper chỉ có một nhánh `input_audio_buffer.committed`, được cả coordinator và transcript adapter hiểu thống nhất. Commit manual không có VAD start vẫn dành đúng lượt học viên trước khi transcript tới.
- Không dùng câu mở đầu cũ để lấp phụ đề trống của lượt học viên/lượt sau; tắt CC cũng không hiển thị lại câu mở đầu.
- Thêm fixture chỉ chứa mốc thời gian/metadata, không chứa audio hay tên học viên: `scripts/fixtures/learn-call-video-repro.json`. Test fingerprint, chấp nhận `I am a technology`, không mở lại lượt luyện khi gia sư đổi cách nhắc, phản hồi tuổi trung tính và sửa tuổi theo lời đính chính.

```bash
node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-video-repro.mjs
node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-realtime-transcript.mjs
```

Test video có 10 kiểm tra: PASS. Đây là đối chiếu audio offline + replay state/caption bằng transcript ứng viên, không khẳng định đã gửi giọng học viên qua provider. Sau đó người dùng đã cho phép riêng hai đoạn ngắn; kết quả phát lại qua OpenAI Realtime được bổ sung bên dưới.

Phép đo trước đây trên fixture TTS (80,75 ms tại 0,555–0,636 giây) chỉ thuộc audio tổng hợp; không dùng thay cho phép đo 107 ms từ video gốc.

## Kết quả và lưu ý bổ sung

- 18 suite gốc vẫn PASS; hai suite mới về video và ghép mảnh Realtime được kiểm tra thêm.
- Regression policy/coordinator/CAS: 32 kiểm tra PASS. Handler HTTP: cập nhật thành 11 kiểm tra PASS, gồm ghép ID và khôi phục lượt luyện sau reconnect.
- Gateway/worker thật: 146 assertion integration trên audio tổng hợp: PASS; clock/summary/package/Azure: exit 0.
- WebRTC thật: đã xác minh manual và auto cho cả bốn mẫu: thirty-five, forty, Technology và No, thirty-five với state trước đó là 40. Mỗi ca thành công có một commit/một response, audio RTP nhận được, transcript đầu vào đúng và câu provider khớp câu đã duyệt. Lượt chạy tổng hợp cuối cùng đạt đủ 8/8 ca và exit 0; không khẳng định provider luôn trả transcript ổn định.
- Trong các lượt chạy WebRTC có gặp commit nhưng không có transcript cuối sau 30–45 giây, gồm mẫu đính chính ngắn ở auto. Không có số tuổi sai nào được gia sư phát ra trong lượt bị chậm. Cấu hình transcription sau `session.updated` vẫn là whisper-1; chưa đủ bằng chứng quy lỗi cho VAD. Mẫu đính chính auto đã qua khi chạy riêng. Đã thêm notice sau 12 giây chờ transcript; notice không đoán nội dung và transcript đến muộn vẫn xử lý được. Regression kiểm tra cả hai hành vi.
- Chưa chạy UI đăng nhập bằng tài khoản học viên thật/DB preview; JSX/hook đã kiểm tra cú pháp. Test plan-counts bị DB từ chối quyền; các script API/UI cũ cần DB preview/password/token chưa có trong phiên này. Handler HTTP và WebRTC dùng dependency injection test thay thế phần auth/lesson/DB, không ghi dữ liệu vào DB production.

## Phát lại hai đoạn giọng gốc sau khi được cho phép

Người dùng đã trả lời **“Cho phép hai đoạn ngắn”**. Chỉ các khoảng **14,35–16,65 giây** (tuổi) và **26,5–30,5 giây** (nghề nghiệp) được gửi qua OpenAI Realtime. Không gửi toàn bộ video. Hai clip được chuyển thành PCM 16 kHz và đưa vào MediaStream của WebRTC; session route, turn endpoint và coordinator là code thật. Auth/lesson/DB được mock, Redis và Chromium chạy riêng. Không ghi audio hay transcript vào log production.

### Phát hiện từ lần chạy đầu

- Tuổi: một commit ở cả manual/auto, nhưng transcript không khớp giá trị 35 người dùng cho biết. Có lần ra số khác, có lần thành câu không biểu đạt tuổi. Sai lệch đã có ở transcript trong phiên phát lại, trước phản hồi gia sư. Không thể suy ngược kết quả này thành trace của phiên cũ từng nói 40.
- Nghề nghiệp manual: nghe trọn `I am a technology` và chuyển sang câu nối tiếp.
- Nghề nghiệp auto: khoảng yên đo được tại **27,72263–28,79125 giây**, dài **1.068,62 ms** (-35 dB, tối thiểu 80 ms). Provider tách thành hai input item, ban đầu đọc `I am...` và sau đó phần còn lại về technology. Trước sửa, coordinator tạo hai phản hồi vì nhận phần mở câu là một câu trả lời hoàn chỉnh.

### Sửa bổ sung và kết quả cuối

Giữ nguyên VAD. Coordinator giữ lại các phần mở câu chưa có thông tin như `I am...`, `I work in...`, rồi ghép với phần tiếp theo. `Technology`, `IT`, `35` hoặc câu đã có nghĩa đi tiếp ngay, không chờ timer. Một request duyệt lượt dùng ID gốc ổn định và danh sách `sourceItemIds`; response metadata liên kết đủ hai item nếu có ghép. Duplicate, response HTTP bị mất và prefix đến muộn không tạo thêm response hay nhiễm vào câu trả lời tiếp theo.

Bỏ qua/nhắc lại được xử lý ngay dù đang giữ fragment. Nếu đây là lần thử luyện đã được dành sẵn, một fragment cũng kết thúc lần thử đó; không đợi học viên đọc đủ câu. Session route trả trạng thái đang chờ lần thử để reconnect vẫn tuân thủ giới hạn. Mẫu luyện tự nguyện lấy từ hint của phương án hiện tại.

**4/4 kiểm tra an toàn/chuyển câu bằng giọng gốc đạt ở lượt chạy cuối**, tách riêng độ chính xác ASR:

| Đoạn | Chế độ | Commit | Response | Nhận dạng tuổi khớp ý định 35 | Gia sư nhắc lại giá trị cá nhân |
| --- | --- | ---: | ---: | --- | --- |
| Tuổi | Manual | 1 | 1 | Không; transcript thành 34 | Không |
| Tuổi | Auto | 1 | 1 | Không; transcript không biểu đạt tuổi | Không |
| Nghề nghiệp | Manual | 1 | 1 | Không áp dụng | Không |
| Nghề nghiệp | Auto | 2, được ghép | 1 | Không áp dụng | Không |

Cả hai ca nghề nghiệp phát đúng `You work in tech. Do you like your work?`. Với auto, response chỉ được tạo sau transcript cuối của phần tiếp theo (khoảng 255 ms trong lần đo), không tạo lời nói sau riêng `I am...`. Các ca tuổi phản hồi trung tính rồi hỏi ý mới. Giá trị phiên test nếu lưu được chỉ mang trạng thái `reported`; không giả là đã xác thực.

Chi tiết item/response ID và thời gian commit → final → response nằm trong `docs/learn-call-approved-video-replay-results.json`. Đây là ID **các phiên phát lại mới**, không phải ID phiên trong video. Report đầy đủ có transcript nằm riêng ở `/tmp/beego-video-repro/approved-webrtc-report.json` (quyền 0600, thư mục 0700); không đưa raw audio/transcript vào repository hoặc log production.

Chạy lại chỉ sau khi có quyền dùng đúng hai đoạn giọng gốc, với Redis test riêng và hai clip PCM trong `/tmp/beego-video-repro/approved-clips`:

```bash
LEARN_CALL_LIVE_WEBRTC=1 LEARN_CALL_VIDEO_AUDIO_APPROVED=1 REDIS_URL=redis://127.0.0.1:16387 node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-webrtc-audio.mjs
node --no-warnings --import ./scripts/register-alias.mjs scripts/test-learn-call-realtime-fragments.mjs
```

Suite fragment có 12 kiểm tra PASS: ghép đúng phần đủ ý; không giữ keyword rõ nghĩa; skip/repeat ngay; partial attempt sau reconnect vẫn hết lượt; prefix cũ đến muộn; giữ root ID khi response HTTP bị mất. Lỗi ASR tuổi với audio gốc vẫn được báo riêng, không gộp thành kết quả “nhận dạng đúng”.
