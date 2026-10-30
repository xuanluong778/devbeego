# Phương án nâng cấp tính năng gọi gia sư AI Beego

Ngày đánh giá: 30/10/2026. Nguồn: video `gia-su-ai.wmv` dài 238,9 giây và mã cục bộ tại `C:/Users/xuan Luong/Downloads/devbeego-main/devbeego-main`.

## Kết luận

Giữ nền tảng cuộc gọi hiện có, ưu tiên nâng chất lượng từng lượt hội thoại trước khi tăng thời lượng, đổi nhà cung cấp hoặc làm thêm avatar. Gia sư cần nghe hiểu, phản hồi đúng ý, hỏi tiếp hợp lý, giúp khi học sinh khựng và kết thúc bằng một tiến bộ cụ thể.

Đây là đánh giá mã và diễn biến giao diện/transcript trong video, không phải đo chất lượng giọng nói, độ chính xác nghe của học sinh hay độ trễ hạ tầng production. Chưa truy cập VPS, API có tính phí, Redis thật, dữ liệu tài khoản hoặc thiết bị Android. Chưa sửa mã ứng dụng, chưa deploy.

## 1. Bằng chứng từ video

| Mốc gần đúng | Quan sát | Hàm ý và giới hạn |
|---|---|---|
| 00:00–00:16 | Chào hỏi ngắn, người học hỏi lại gia sư | Có tương tác hai chiều, đáng giữ |
| 00:32–00:40 | Transcript người học có từ vô nghĩa; gia sư trả lời “I'm 25 years old too! Where do you…” | Cần xác minh nhận dạng và bảo đảm câu hỏi trọn ý; robot không nên nhận tuổi thật. Chưa xác định transcript sai do máy hay người nói |
| Khoảng 00:40–01:30 | Nhiều màn hình giữ trạng thái chờ; gợi ý tuổi vẫn hiện sau câu hỏi mới | Người học không được dẫn tiếp rõ ràng; không đủ bằng chứng nói backend bị treo |
| 01:36–02:08 | Trạng thái lắng nghe kéo dài đến gần/vượt lúc đồng hồ về 0 | Cần kiểm tra kết thúc lượt, timeout, và đồng bộ đóng phiên trên thiết bị thật |
| Khoảng 02:16 | Tổng kết phiên đầu báo 120 giây và 2 lượt người học | Cần tối ưu cơ hội nói hữu ích, không chỉ số phút ở màn gọi |
| Khoảng 03:12–03:28 | Gia sư phản hồi “You are 35 years old” mà không có câu hỏi mới | Lượt không kết thúc nhưng thiếu nhiệm vụ tiếp theo dễ làm cuộc nói chuyện ngừng |
| Khoảng 03:44 | Chào kết thúc bằng việc nhắc lại tuổi | Có ghi nhớ trong phiên, nhưng lời kết chưa thể hiện rõ học được gì và cần luyện gì |

## 2. Những gì mã hiện tại đã có — không xây lại

- `LearnLessonCall.jsx`: chọn giáo viên, độ khó, kiểm tra quyền và khởi tạo phiên.
- `LearnCallRoom.jsx`: trạng thái nói/nghe, micro nhấn để nói và gửi, ngắt lời khi gia sư đang nói, nghe lại, phụ đề, tổng kết.
- `learn-call-talk.js`: controller và generation/requestId để loại bỏ tác vụ cũ.
- `learn-call-playback.js`: quản lý phát, cache, xác nhận phát hoàn tất và phân biệt phát bị hủy/ngắt.
- `voice-ws-gateway.mjs`: Azure STT, luồng PCM, Redis và điều phối worker.
- `voice-llm-worker.mjs`, `voice-tts-worker.mjs`: sinh lời và chuyển lời thành tiếng.
- `learn-call-pronunciation.js`: đánh giá PCM bằng Azure thật; không phải chỉ tính độ giống văn bản.
- `learn-call-tutor.js`: đã có quy tắc phản hồi nhẹ nhàng, trợ giúp tiếng Việt, không bịa đời tư, xử lý không hiểu và kết thúc.

Các quy tắc tốt đã tồn tại nhưng video vẫn có hành vi chưa đạt. Cần kiểm tra chất lượng đầu ra và phiên bản chạy thật, không chỉ bổ sung thêm prompt.

## 3. Các lỗi đã tái hiện offline

### 3.1 Gợi ý trả lời lệch câu hỏi

Trong `learn-call-topics.js`, `learnCallReplyHints()` dò cả lượt, duyệt facet theo thứ tự. Với:

`I'm 25 years old too! Where do you live?`

Hàm trả gợi ý tuổi: “I'm 20”, “I'm 25 years old”, thay vì nơi ở. Do phần xác nhận trước câu hỏi chứa “old”.

**Sửa:** Gợi ý dựa trên `questionIntent` hoặc câu hỏi cuối đã được kiểm tra, không dò toàn bộ câu phản hồi. Không tái sử dụng gợi ý cũ khi câu hỏi không xác định được.

### 3.2 Nhận nhầm đã trả lời tên

`learnCallCoveredFacets()` tính “I'm good. How are you?” là đã trả lời cả `greeting` lẫn `name`. Regex nhận tên quá rộng, có cờ không phân biệt hoa/thường.

**Sửa:** Theo dõi slot gắn với câu hỏi đang chờ, chỉ xác nhận tên từ mẫu đủ rõ hoặc sau hỏi lại. Không lấy tính từ, nghề nghiệp hay tuổi làm tên. Các trạng thái nên là chưa hỏi / đang chờ / đã xác nhận / cần giúp.

### 3.3 Câu cụt và thiếu câu hỏi vẫn đi tiếp

`learnCallShapeReply()` trả nguyên “You are 35 years old.” ở lượt tiếp diễn. Câu dài bị `.slice(0,maxChars)` có thể bị cắt giữa từ. Bộ đọc stream LLM hiện chưa dùng finish reason để xử lý câu bị hết token.

**Sửa:** Mỗi lượt tiếp diễn phải có nhiệm vụ giao tiếp rõ ràng. Kiểm tra câu kết thúc trọn vẹn, không cắt giữa từ, không thiếu câu hỏi đang yêu cầu. Nếu lỗi: sửa một lần có giới hạn; sau đó dùng câu dự phòng theo intent, không retry vô hạn. Lượt kết thúc hoặc giải thích ngắn có ngoại lệ hợp lệ.

## 4. Thiết kế hội thoại mới

### Một lượt tốt

1. Tiếp nhận đúng điều người học vừa nói.
2. Xác nhận/phản hồi ngắn; chỉ sửa một lỗi đáng ưu tiên nếu cần.
3. Hỏi một câu hoặc giao một nhiệm vụ dễ hiểu, có liên quan.

Ví dụ: “I am 35 year old.” → “Thirty-five years old. Nice! Where do you live?” Phần sửa là nhắc lại tự nhiên, không biến mọi lượt thành đọc nhại.

Nếu câu nhận dạng vô nghĩa: hỏi xác nhận hoặc cho nói lại. Không sửa ngữ pháp dựa vào lời mà học sinh có thể chưa nói.

Nếu hỏi tuổi robot: “I'm an AI tutor, so I don't have an age. How old are you?” Với nhân vật đóng vai, khai báo rõ đang đóng vai rồi giữ nhất quán trong vai.

### Các hình thức buổi học

Chỉ nên ra mắt 3 hình thức rõ trước:

- **Làm quen nhanh:** mục tiêu nhỏ, hỗ trợ nhiều, câu ngắn.
- **Đóng vai tình huống:** mua đồ, gọi nước, hỏi đường; có kết quả cần đạt.
- **Nói chuyện về bạn:** sở thích, kế hoạch; hỏi tiếp theo thông tin thật đã được người học xác nhận.

Sau đó thêm luyện lại lỗi của phiên trước và nhiệm vụ thử thách. Đổi tình huống và mục đích giao tiếp, không chỉ đổi câu chào hoặc giọng đọc.

### Trợ giúp theo mức

- Gợi ý từ khóa.
- Nếu vẫn khó: khung câu ngắn.
- Theo yêu cầu: ví dụ và giải thích tiếng Việt.
- Cho học sinh dùng một từ, bỏ qua câu hỏi hoặc chọn tình huống khác; không ép cung cấp tuổi/nơi ở thật.

Khoảng chờ gợi ý 5–8 giây và lời mời trợ giúp 10–15 giây chỉ là giá trị thử nghiệm. Đừng ngắt lúc học sinh đang nói. Không tự tạo câu trả lời thay học sinh. Tránh nhắc lặp gây áp lực.

## 5. Luồng nói/nghe và tốc độ

### P0: làm rõ thao tác hiện có

Nút micro cần hiện nhãn ngay trên/dưới nút: “Bấm để nói”, “Bấm để gửi”, “Bấm để ngắt lời”. Khi chưa nhận tiếng, giải thích ngắn thao tác tiếp theo thay vì chỉ có icon và màu.

### P1: chế độ tự kết thúc lượt có tùy chọn

Thêm phát hiện kết thúc câu bằng VAD/endpointing, vẫn giữ nút gửi và chế độ nhấn để nói dự phòng. Thử khoảng nghỉ 1,2–1,8 giây với A0, điều chỉnh bằng dữ liệu thực; không cắt khi học sinh ngập ngừng. Kiểm tra tiếng quạt, loa ngoài, Bluetooth, tốc độ nói chậm và tiếng vọng.

Ngắt lời bằng nút đã có. Ngắt lời tự động là bước sau, cần xử lý echo/cancel để không nhận giọng gia sư thành giọng học sinh.

### Đo trước khi đổi kiến trúc

Gắn các mốc: kết thúc lời người học → transcript cuối → vào hàng đợi → bắt đầu LLM → câu hoàn chỉnh đầu tiên → byte TTS đầu tiên → âm thanh thực sự phát ở client.

Mục tiêu thử nghiệm: thời gian từ kết thúc câu đến âm thanh phản hồi p50 ≤2 giây, p95 ≤4 giây trên điều kiện mạng định nghĩa rõ. Đây là mục tiêu, chưa phải số đo hiện tại.

Mã hiện tại nhận stream LLM nhưng nhánh Learn chờ nội dung hoàn tất rồi mới enqueue TTS. Có thể giảm chờ bằng phát câu đã kiểm tra trước khi toàn bộ lượt hoàn tất, nhưng phải giữ thứ tự segment, requestId, hủy tác vụ cũ và playback_ack. Chỉ triển khai sau khi đo được phần chậm nhất. Không phát sớm một lời khen khi chưa hiểu học sinh.

### Hỗ trợ tiếng Việt

STT hiện cấu hình en-US, trong khi prompt chấp nhận trợ giúp tiếng Việt. Cần thiết kế nút “Giải thích tiếng Việt” hoặc chế độ hỗ trợ rõ ràng. Không giả định STT tiếng Anh hiểu tốt câu Việt. Nếu thử nhận dạng đa ngôn ngữ, đo thêm độ trễ và chất lượng, đặc biệt câu trộn ngôn ngữ.

## 6. Mục tiêu và ghi nhớ

Giới hạn hiện tại hướng tới 3–4 lượt; đến 4 lượt là đóng. Điều này phù hợp micro-practice nhưng hạn chế trò chuyện mở. Không chỉ tăng con số:

- Đặt 2–3 mục tiêu giao tiếp mỗi phiên.
- Chỉ tính lượt có nội dung, tách lượt xin lặp lại, không nghe rõ và sửa nhận dạng.
- Tăng thử nghiệm 4–6 lượt cho phiên ngắn nếu độ trễ/cơ hội nói cho phép; thời lượng dài hơn phải theo gói và chính sách riêng.
- Đo thời gian học sinh thực sự nói, số ý mới và nhiệm vụ hoàn thành. Không chấm tiến bộ chỉ bằng thời gian kết nối.

Hiện ghi nhớ hội thoại ở Redis tối đa 40 mục và TTL một giờ; prompt nói rõ không nhớ các cuộc gọi trước. Có thể thêm hồ sơ học tập tối thiểu: mục tiêu đã hoàn thành, một lỗi cần ôn, gợi ý buổi sau. Chỉ lưu khi có chính sách và cơ chế xóa phù hợp; không mặc định lưu raw audio hoặc transcript đầy đủ lâu dài. Không tự thay đổi schema hay retention trong bước sửa lỗi đầu.

## 7. Tổng kết tạo động lực nhưng có bằng chứng

Hiện summary có điểm phát âm thật, trích câu đã nói và số lượt, nhưng `corrections: []`, `correctionNote: "Chưa đánh giá"`, gợi ý buổi sau còn chung. Không thể coi là đã có chữa lỗi cá nhân hóa đầy đủ.

Màn cuối nên gồm:

- Điều đã làm được: “Bạn đã tự giới thiệu tên và hỏi lại một câu.”
- Một chỗ cần luyện: chỉ có khi có bằng chứng đủ rõ.
- Một câu sửa có nút nghe và luyện lại theo lựa chọn.
- Nhiệm vụ buổi sau nối tiếp điều đang học.

Điểm phát âm không phải điểm đúng ngữ pháp, hiểu câu hỏi hay năng lực giao tiếp tổng thể. Với ít mẫu âm thanh, nêu độ hạn chế thay vì kết luận chắc chắn. Cần cải thiện dù không có huy hiệu. Khen cụ thể nỗ lực và kỹ năng, không khen mọi câu là hoàn hảo.

## 8. Cấu trúc đầu ra và triển khai

Khuyến nghị một hợp đồng đầu ra nhỏ:

```json
{
  "replyText": "Nice to meet you, Lu! Where do you live?",
  "questionIntent": "home",
  "expectedAnswerType": "place",
  "needsClarification": false,
  "correction": null,
  "closing": false
}
```

Đây là đề xuất, chưa phải giao thức đang có. Server kiểm tra schema, độ dài, tính trọn câu, intent hợp lệ và closing; không tin JSON của model vô điều kiện. Không đưa reasoning hay chỉ dẫn kỹ thuật ra UI/TTS.

| Đợt | Phạm vi | Điều kiện đi tiếp |
|---|---|---|
| P0 | Xác minh web/gateway/worker cùng commit; sửa hints, slot tên, câu cụt, câu tiếp nối; nhãn micro; đo latency | Kịch bản tái hiện không còn lỗi, không hồi quy quyền/gói/ngắt lời |
| P1 | Trợ giúp ba mức, hội thoại theo mục tiêu, tổng kết có bằng chứng, thí điểm tự kết thúc lượt | Người mới tự hoàn thành một nhiệm vụ, không bị mắc chờ; thử thiết bị thật |
| P2 | Hồ sơ học tập tối thiểu, nội dung role-play theo cửa/trình độ, A/B tính cá nhân hóa | Kết quả học và tỷ lệ quay lại tốt hơn baseline, chi phí nằm trong ngân sách |
| P3 | Thí điểm pipeline giọng nói khác hoặc full-duplex nếu dữ liệu chỉ ra cần | Benchmark trên cùng bài test, ngân sách và yêu cầu riêng tư; không đổi chỉ vì mới |

Hiện topic guide có cấu trúc riêng chủ yếu cho greetings/drinks/family, còn lại dùng mặc định. Với catalog 50 cửa, nên có cấu hình chủ đề và mục tiêu tái sử dụng, cộng biến thể theo trình độ, thay vì viết 800 prompt riêng hoặc dồn mọi nội dung vào một prompt dài.

Không hứa thời hạn hay chi phí khi chưa biết sức tải VPS, lượng người dùng, gói gọi, log production và ngân sách. Giữ giới hạn/cơ chế tính lượt hiện có trong P0; thay chính sách thương mại là quyết định riêng.

## 9. Kiểm thử và đo hiệu quả

### Đã chạy

- `node scripts/test-learn-call-talk.mjs`: PASS.
- `node scripts/test-learn-call-playback.mjs`: PASS.
- `node scripts/test-learn-call-transcript.mjs`: PASS.
- Script audit offline riêng đã tái hiện ba nhóm lỗi ở mục 3.

Các PASS trên xác nhận controller/playback/transcript trong phạm vi test, không chứng minh cả cuộc gọi live hoạt động tốt. Chưa chạy build toàn dự án hoặc gọi dịch vụ thật.

### Bộ tình huống bắt buộc khi sửa

1. “I'm good” không được coi là tên; tên tiếng Việt và tên riêng lạ cần xác nhận hợp lý.
2. Câu có phần xác nhận tuổi rồi hỏi nơi ở phải gợi ý nơi ở.
3. Nhận dạng vô nghĩa không được khen hoặc tự biến thành dữ kiện chắc chắn.
4. Câu trả lời có “and you?” được đáp trung thực; robot không nhận tuổi thật.
5. Không có câu hỏi tiếp nối/câu bị hết token: có repair/fallback hữu hạn.
6. Nhấn liên tục, nói khi gia sư đang nói, mạng rớt, audio đến muộn, replay không tính thành lượt học mới.
7. Đến deadline khi micro mở: ngừng thu, xử lý đoạn cuối theo chính sách rõ, đóng và hiển thị tổng kết đúng.
8. Hỗ trợ tiếng Việt, người nói ngập ngừng, môi trường ồn và Android/iOS/desktop thật.
9. Người học xin dừng hoặc bỏ qua câu hỏi cá nhân: tôn trọng và không phạt.

### Chỉ số nên đo

- Độ trễ end-to-audible p50/p95, tỷ lệ lượt lỗi và transcript rỗng.
- Tỷ lệ repair/fallback, gợi ý lệch câu hỏi, ngắt nhầm, timeout.
- Thời gian người học nói và số lượt có ý nghĩa mỗi phiên.
- Mức tự hoàn thành nhiệm vụ không nhìn mẫu; đo lại sau vài ngày bằng biến thể mới.
- Mức tự tin tự báo cáo, tỷ lệ quay lại và chi phí mỗi phiên hữu ích.

Không tối ưu chỉ số lượt gọi hoặc thời gian màn hình bằng cách kéo dài hội thoại không có giá trị.

## Tài liệu đối chiếu

- British Council, [Correcting speaking at the right time](https://africa.teachingenglish.org.uk/skills/tips/correcting-speaking): điều chỉnh thời điểm sửa theo mục tiêu độ chính xác/độ trôi chảy.
- British Council, [Introduction to teaching speaking](https://www.teachingenglish.org.uk/pathways/introduction-to-teaching-speaking): cơ hội nói, phản hồi và sự tự tin.
- Microsoft Learn, [Language identification](https://learn.microsoft.com/en-us/azure/cognitive-services/speech-service/language-identification): nhận dạng ngôn ngữ có chi phí độ trễ và không giải quyết mọi trường hợp chuyển ngôn ngữ trong câu.

Các mốc thời gian, số lượt mục tiêu và thiết kế trải nghiệm ở đây là khuyến nghị cần thử nghiệm của bản đánh giá; không phải chuẩn bắt buộc từ các tài liệu trên.
