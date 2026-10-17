Đánh giá mã nguồn Beego và phương án Gọi gia sư AI
Ngày đánh giá: 14/10/2026. Nguồn: beego-main-9-10-2026.zip, schema SQL backup, docker-compose.yml và huong-dan-deploy.md trong thư mục chủ sản phẩm cung cấp. Đây là đánh giá bản backup, chưa xác minh mã/cấu hình đang chạy trên VPS. Các lệnh trong tài liệu deploy được đọc làm dữ liệu tham khảo, không được thực thi.
Kết luận
Giữ Next.js/React, API phiên, Redis, Azure STT và gateway/worker hiện có. Ưu tiên sửa vòng nghe/nói và phiên, sau đó thay giao diện trong LearnCallRoom, mở pilot mức 1 có allowlist. Chưa cần chuyển toàn bộ sang một nhà cung cấp realtime mới hoặc xây lại backend. Chưa mở mức 2 và chưa áp phút thương mại.
Video đã xem tới đâu
Đọc được video WMV dài 401,4 giây (6 phút 41 giây), 1920×1080. Đã xem khung hình mỗi 10 giây xuyên suốt video, khung lớn ở giây 355 và 390, cùng ảnh đính kèm. Thấy nhân vật lớn, biểu cảm nói/nghe, thanh thời gian, nút nói, CC, phụ đề và hội thoại sau gọi. Chưa nghe toàn bộ âm thanh và chưa xem liên tục từng giây; không kết luận chính xác về độ trễ hoặc chất lượng nhận dạng chỉ từ hình ảnh này.
Phần đã có trong backup
components/beego/learn/GateCallButton.jsx: chọn đích gọi theo cửa và trạng thái mở.
components/beego/learn/LearnPage.jsx: lớp dialog bản đồ, gọi LearnLessonCall với nhãn Quay lại bản đồ.
components/beego/lesson-player/LearnLessonCall.jsx: kiểm tra quyền, chuẩn bị gọi, POST phiên, truyền token/sessionId/wsUrl cho phòng gọi và DELETE khi đóng.
components/beego/lesson-player/LearnCallRoom.jsx: Azure STT, PCM microphone, nhận text/âm thanh, ngắt lời, nghe lại, tổng kết. Giao diện hiện chủ yếu là các đoạn chữ và nút; chưa có sân khấu nhân vật hoặc CC.
app/api/learn/ai-call/{status,access,session}/route.js: feature gate, allowlist, gói học, bài/cửa và token.
lib/beego/learn/ai-call-access.js: mức 1 tối đa 2 phút, targetTurns 3–4, prompt ngắn, đồng hồ Redis, tổng kết không điểm/phát âm, quota test.
scripts/voice-ws-gateway.mjs và voice-llm-worker.mjs, voice-tts-worker.mjs, voice-usage-worker.mjs: pipeline thực tế. Có VOICE_LLM_QUEUE, VOICE_TTS_QUEUE, VOICE_USAGE_QUEUE để cấu hình tiến trình riêng.
Android dùng Capacitor; cần thêm kiểm tra Android WebView bên cạnh trình duyệt.
SQL có bảng cho học/chat/usage, nhưng danh sách CREATE TABLE không thấy bảng tên learn_call_sessions/learn_call_turns. Không nên nhầm chat bài học đã lưu DB với lịch sử voice đã lưu bền vững. Voice đang dùng Redis; muốn xem lại sau nhiều ngày cần thiết kế lưu riêng.
Những điểm phải xử lý trước khi mở học viên
1. tts_end đang bị hiểu thành phát hết trên máy học viên
LearnCallRoom.jsx:175–179 gọi beginListen ngay khi gateway gửi tts_end. beginListen gọi player.interrupt(), nên có thể cắt phần âm thanh vẫn đang nằm trong hàng đợi client. useStreamingTtsPlayer.js:109 hiện chỉ xóa source trong onended; chưa có callback toàn lượt đã phát xong. Gateway:907–909 cũng đánh dấu assistant 'complete' ở tts_end, tức dựa trên worker hoàn tất gửi audio, chưa dựa trên client hoàn tất phát.
Sửa: tách generation_done và playback_done. Sau chunk cuối, flush buffer, chờ tất cả source của lượt phát xong mới chuyển sang chờ nói/auto-listen. Thêm playback_ack với requestId, trạng thái complete/interrupted và generation riêng khi nghe lại. Ack là tín hiệu client, không phải chứng nhận học viên nghe được hoặc hiểu; không dùng nó để chấm điểm. Sự kiện ended của Web Audio cũng xảy ra khi source bị stop, nên phải phân biệt chủ động ngắt với kết thúc tự nhiên. Tham khảo: https://developer.mozilla.org/en-US/docs/Web/API/AudioScheduledSourceNode/ended_event
2. Chế độ micro chưa khớp yêu cầu Nhấn để nói
Sau hello, requestMic gọi ensureStream/startPcmCapture. Capture có thể chạy suốt; listeningRef quyết định khi nào gửi PCM. Khi TTS đang phát, RMS > 0.045 có thể tự ngắt lời. Đây không đồng nghĩa micro phần cứng tắt trong lúc gia sư nói. Báo cáo nên phân biệt quyền mic, capture và dữ liệu gửi Azure.
Đề xuất mặc định mức 1: nhấn một lần bắt đầu nghe, nhấn lần nữa gửi hoặc kết thúc theo khoảng im lặng đã cấu hình. Khi gia sư nói, nút chuyển thành Ngắt lời. Bấm nút hủy âm thanh/lượt cũ rồi mới bật nghe. Không dùng RMS làm cơ chế ngắt mặc định lúc đầu vì cần kiểm chứng tiếng loa/vọng trên điện thoại. Chế độ rảnh tay chỉ mở sau pilot.
AudioContext phát nên được mở/resume trong thao tác Bắt đầu của người dùng; kiểm tra context thực sự running. Nếu chờ tới callback socket mới mở audio có thể gặp chặn phát trên thiết bị. Sau khi người dùng cấp micro muộn, phải kiểm tra session còn hoạt động trước khi bắt đầu capture; hiện requestMic chưa kiểm tra lại closedRef sau await.
3. Một người một phiên chưa được khóa nguyên tử
session/route.js:146–161 GET openKey rồi SET EX 150 không có NX. Hai POST đồng thời có thể cùng qua GET và đều tạo phiên. DELETE hiện chỉ bỏ open marker, chưa thu hồi binding/context/token phiên. Marker hết 150 giây trong khi token 10 phút cũng cần được đánh giá cùng lifecycle kết nối.
Sửa: tạo lock bằng SET NX hoặc Lua, chỉ chủ lock được giải phóng bằng compare-and-delete nguyên tử. Đóng phiên phải đánh dấu kết thúc, thu hồi quyền nối lại và hủy job/socket liên quan. Kiểm thử hai POST song song, hai tab dùng cùng token và nối lại sau khi kết thúc. Giữ deadline cũ khi reconnect hợp lệ.
4. Socket đóng thông thường có thể chưa dừng micro
LearnCallRoom chỉ gọi finish khi readyState === error. Hook còn trả closed từ onclose. Nếu server đóng không phát error/call_ended thì phòng gọi có thể chưa giải phóng media ngay. Hook cũng đưa URL kết nối đầy đủ vào lastError, trong đó có query token.
Sửa: xử lý cả closed ngoài chủ đích, dừng media ngay, sau đó mới quyết định cho reconnect. Che token ở thông báo/log; bỏ URL đầy đủ khỏi lỗi. Callback của socket cũ phải kiểm tra nó còn là socket hiện tại trước khi thay state.
5. CC cần lịch sử lượt, không chỉ caption/heard
Hiện phòng gọi có hai chuỗi caption và heard, chưa có danh sách hội thoại. ai_stream nối vào caption hiện tại; không thấy reset caption khi bắt đầu lượt mới. Worker còn phát ai_stream có speculative=true, client chưa lọc. Văn bản phỏng đoán và final có thể trộn vào nhau trước ai_done.
Sửa: lưu transcript theo turnId/requestId với speaker, interim/final, text và playbackStatus. Không hiển thị speculative dưới dạng câu tutor đã nói. Partial STT là tạm; chỉ final được lưu. Caption từng lượt được reset đúng lúc. CC mở bảng dưới màn, có nút đóng, không tạm dừng đồng hồ. Khi đọc câu cũ không tự kéo xuống cuối. Transcript render như text, không như HTML.
6. Prompt mức 1 đang dùng ít ngữ cảnh bài
Gateway thực sự gọi learnAiCallLevelOnePrompt trong ai-call-access.js. Prompt phong phú hơn ở lib/ai/prompts/learn-lesson-tutor.js không phải prompt đang dùng bởi đường gateway này. Context phiên mới lưu title/objective/level/maxMinutes, chưa lưu danh sách vocabulary/grammar của bài. targetTurns là giá trị giới thiệu; prompt hiện chưa buộc dừng sau 3–4 lượt.
Sửa: dựng context bài thường được server xác thực gồm từ/cấu trúc mục tiêu, một câu mở đầu và một số nhánh hỗ trợ. Đếm lượt final của học viên ở server; gần deadline thì chào kết thúc, không hỏi câu mới. Nếu chưa hiểu, hỏi lại ngắn, sau đó đưa hai lựa chọn. Không coi câu nhận dạng không rõ là ý chắc chắn của học viên. Chỉ nhớ chi tiết trong phiên ở bản đầu.
7. Cấu hình backup chưa tái tạo production trong báo cáo
docker-compose.yml trỏ Learn WS vào 3031; ecosystem.voice.config.cjs chỉ có nhóm voice 3031. Compose có mysql/redis/web, chưa có service gateway hoặc ba worker riêng, không có cấu hình /voice-learn → 3033. Source có khả năng dùng queue khác qua env nhưng cấu hình kèm theo chưa thể hiện bộ Learn độc lập.
Sửa: đối chiếu commit/source thực tế và cấu hình PM2/nginx/env trên VPS (che secret), rồi tạo cấu hình staging riêng. Giữ voice-learn 3033 và queue riêng cho Học. Không lấy compose local ghi đè production. Cấu hình MySQL mật khẩu trống và publish DB/Redis ra host là cấu hình local cần giới hạn localhost, không dùng nguyên trạng trên VPS. Tài liệu deploy chứa giá trị API key/JWT secret; nếu còn hiệu lực cần thay khóa và dùng placeholder trong tài liệu. Báo cáo này không sao chép các giá trị đó.
Thiết kế màn gọi đề xuất
Giữ lớp phủ trên bản đồ. Trên mobile dùng chiều cao viewport và safe area, desktop dùng khung dọc có khoảng trống hai bên. Nhân vật Beego lớn, nền phòng nhẹ, X thoát, thanh đếm thời gian lấy từ hello.callClock.deadlineAt (server thực thi), một cụm điều khiển dưới cùng.
Nút chính: Nhấn để nói → Đang nghe/Gửi → Đang xử lý → Ngắt lời khi gia sư phát âm.
Nút trái: nghe lại câu gần nhất; không gọi LLM lần nữa. Hiện gateway nghe lại bằng sinh TTS lại; có thể cache audio ngắn cho từng lượt để giảm chi phí.
Nút phải CC: bật/tắt bảng đoạn hội thoại. Phụ đề hiện tại trên nhân vật vẫn được giữ, theo yêu cầu đã nêu.
Nhân vật: idle, listening, thinking, speaking, encouraging, goodbye. Bản đầu dùng SVG/sprite Beego; sau đó nâng animation từ tài sản thương hiệu. Miệng dựa vào audio đang phát, không dựa vào token text.
Tổng kết: thời lượng, câu học viên, câu tutor đã phát/bị ngắt, phát âm Chưa đánh giá, Quay lại bản đồ/bài đúng cửa vào. Không cộng XP/Honey hoặc đổi bài.
Thứ tự làm và điều kiện hoàn thành
Đối chiếu backup với production, tạo môi trường kiểm thử tách biệt. Điều kiện: endpoint và queue Learn riêng, không sử dụng dữ liệu học viên thật trong test.
Sửa playback, lifecycle mic/socket và khóa phiên. Điều kiện: không nghe chồng, không tự cắt câu cuối, không mic tồn tại sau kết thúc, không hai phiên đồng thời.
Tích hợp giao diện theo ảnh và CC vào component thật. Điều kiện: giao diện dùng event WS thật, transcript đúng lượt, deadline không reset khi reconnect, hoạt động với bàn phím và màn nhỏ.
Hoàn thiện context/prompt và chào kết thúc. Điều kiện: 3–4 lượt ngắn trong bài, hỏi lại khi không hiểu, không mở mức 2 vô tình.
Kiểm thử cuộc gọi thật trên iPhone Safari, Android Chrome, Android Capacitor WebView và desktop. Bao gồm loa ngoài/tai nghe, từ chối mic, chuyển nền, mạng yếu, hết giờ và gate tắt.
Pilot đề xuất 10–20 tài khoản Pro/VIP còn hạn trong allowlist. Đo tỷ lệ hoàn tất, độ trễ từ learner final đến audio đầu tiên, lỗi mic/STT/WS, ngắt lời, chi phí/phút và phản hồi học viên. Chốt ngưỡng chấp nhận bằng baseline; chưa cam kết độ trễ từ đọc mã.
Khi pilot ổn mới mở rộng học viên, thiết kế mức 2 và gói phút thật. Hạn mức 8/12 phút thử vẫn tách khỏi quyền thương mại.
Kiểm chứng đã thực hiện
Đã đọc các tuyến API, UI/hook audio, gateway, worker, prompt, cấu hình và tên bảng SQL liên quan. Không import database, không chạy migration, không gọi dịch vụ có tính phí, không sửa VPS. Chạy kiểm tra hàm thuần trên mã backup: allowlist trống chặn; Pro/VIP trong danh sách qua; trial/expired chặn; admin thành VIP trong call; reconnect giữ deadline; summary phân loại complete/interrupted và phát âm Chưa đánh giá. Các kiểm tra đều qua. Test tích hợp đi kèm repo phụ thuộc .env.local, Redis/gateway và một số công cụ Linux/preview cũ, nên chưa chạy. Chưa build toàn bộ ứng dụng hoặc kiểm chứng micro thật.
Không sửa mã ứng dụng trong lượt đánh giá này. Bản source được giải nén vào work để đọc; file backup gốc được giữ nguyên.