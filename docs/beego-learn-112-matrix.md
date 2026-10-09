# Ma trận mục tiêu 112 bài thường

> Khảo sát mã ngày 9 tháng 10 năm 2026. Tài liệu này không đổi nội dung đang chạy.
> Phạm vi: 8 phần × 14 bài thường `p{1–8}-g1-n{01–14}` = 112 bài. Bài 15 (Boss Test) và bài 16 (ôn SRS) nằm ngoài ma trận.

## Cách đọc

Mỗi bài thường trên lộ trình mang nhãn loại node (`learning-path-schema.js`: từ vựng, mẫu câu, ngữ pháp, năm tầng nghe, năm tầng nói, đọc). Nội dung thật không cắt theo nhãn đó. `lesson-content-build.js` gọi cùng một bộ 12 hoạt động cho mọi node loại thường, và lấy tình huống theo số thứ tự bài trong `integrated-node-content.js` cùng một chỗ trống và một lượt thoại trong `integrated-node-practice.js`.

Mười hai hoạt động, theo thứ tự trong `integrated-lesson.js`: nghe chọn hình, chọn nghĩa, ghép Anh–Việt, ghép âm với từ, sắp xếp từ, nghe điền từ, nghe nhập lại câu, dịch hai chiều, điền theo tình huống, chọn câu đáp, đọc thành tiếng, đọc đoạn.

Từ và cụm mới trong cột dưới đây là từ nội dung xuất hiện lần đầu trong sáu câu riêng của bài: câu mục tiêu, câu nghe, câu chép, câu nói, câu điền, câu đáp. Từ chức năng ngắn (mạo từ, đại từ, trợ động từ, giới từ thông dụng) không tính. Đây là thước đo để kiểm chứng giả thuyết, không phải danh sách đã được biên soạn thành giáo trình.

Giả thuyết cần kiểm chứng: khoảng 5 từ hoặc cụm mới mỗi bài, chỉnh theo độ khó. Kết quả đo trên mã hiện tại: 112 bài, ít nhất 0, trung vị 3, nhiều nhất 8, trung bình 3.4. Có 41 bài nằm trong khoảng 4–6 từ mới. Hai bài không thêm từ nội dung mới: p5-g1-n09, p8-g1-n12.

Bài còn kéo thêm từ trong ngân hàng chung của cửa (`lesson-topic-banks.js`, xoay theo số thứ tự bài). Những từ đó không được tính là từ mới của riêng bài, vì cùng một ngân hàng phục vụ cả 14 bài.

Ôn trong ma trận là cụm mục tiêu của bài thường ngay trước. Mã chưa có hàng ôn riêng cho từng từ mới, và chưa có bằng chứng đạt theo từng cụm.

Bằng chứng đang chạy, trong `completionRules` của bài thường: `minScorePercent` bằng 0, `allowCompleteOnFinish` bật, `minQuestionsAnswered` bằng 1. Bộ sinh câu yêu cầu ít nhất 10 câu. Hoàn thành bài chưa chứng minh người học dùng được cụm mục tiêu.

Điểm ngữ pháp ghi trong `learning-path-catalog.js` là nhãn của cửa. Mười hai hoạt động không tách một bài chỉ để dạy điểm ngữ pháp đó.

## Phần 1 — Mất gốc / Làm quen tiếng Anh (A0)

Cửa `p1-g1`. Chủ đề: Chào hỏi & Alphabet. Nhãn ngữ pháp: Đại từ nhân xưng I / You / He / She.

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p1-g1-n01` | Từ vựng | Chào một người mới | Bài đầu lộ trình | Hello I am Beego. (Xin chào, tôi là Beego.) | 8: hello, beego, nice, meet, door, says, mai, arrived | Chưa có cụm bài trước | Nhận ra và dùng được «Hello I am Beego.»; 8 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n02` | Mẫu câu | Hỏi tên một người | Xong p1-g1-n01: Chào một người mới | What is your name? (Bạn tên gì?) | 4: name, lan, asks, tells | Hello I am Beego. | Nhận ra và dùng được «What is your name?»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n03` | Ngữ pháp | Nói mình khỏe | Xong p1-g1-n02: Hỏi tên một người | I am fine. (Tôi khỏe.) | 2: fine, feel | What is your name? | Nhận ra và dùng được «I am fine.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n04` | Nghe 1 | Chào buổi sáng | Xong p1-g1-n03: Nói mình khỏe | Good morning. (Chào buổi sáng.) | 4: good, morning, see, breakfast | I am fine. | Nhận ra và dùng được «Good morning.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n05` | Nghe 2 | Chào buổi tối | Xong p1-g1-n04: Chào buổi sáng | Good night. (Chúc ngủ ngon.) | 5: night, friend, bedtime, sleep, well | Good morning. | Nhận ra và dùng được «Good night.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n06` | Nghe 3 | Cảm ơn một người | Xong p1-g1-n05: Chào buổi tối | Thank you. (Cảm ơn bạn.) | 5: thank, much, welcome, help, thanks | Good night. | Nhận ra và dùng được «Thank you.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n07` | Nghe 4 | Xin lỗi để hỏi đường | Xong p1-g1-n06: Cảm ơn một người | Excuse me. (Xin lỗi, cho tôi hỏi.) | 4: excuse, hall, near, question | Thank you. | Nhận ra và dùng được «Excuse me.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n08` | Nghe 5 | Tạm biệt bạn | Xong p1-g1-n07: Xin lỗi để hỏi đường | Goodbye. (Tạm biệt.) | 3: goodbye, later, gate | Excuse me. | Nhận ra và dùng được «Goodbye.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n09` | Nói 1 | Giới thiệu một người bạn | Xong p1-g1-n08: Tạm biệt bạn | This is my friend. (Đây là bạn của tôi.) | 1: introduces | Goodbye. | Nhận ra và dùng được «This is my friend.»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n10` | Nói 2 | Chào mừng người mới | Xong p1-g1-n09: Giới thiệu một người bạn | Welcome. (Chào mừng bạn.) | 4: class, sit, new, student | This is my friend. | Nhận ra và dùng được «Welcome.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n11` | Nói 3 | Hỏi sức khỏe buổi sáng | Xong p1-g1-n10: Chào mừng người mới | How are you this morning? (Sáng nay bạn khỏe không?) | 1: calls | Welcome. | Nhận ra và dùng được «How are you this morning?»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n12` | Nói 4 | Hẹn gặp lại | Xong p1-g1-n11: Hỏi sức khỏe buổi sáng | See you later. (Hẹn gặp lại.) | 3: noon, let, us | How are you this morning? | Nhận ra và dùng được «See you later.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n13` | Nói 5 | Chào đồng nghiệp | Xong p1-g1-n12: Hẹn gặp lại | Hi, good to see you. (Chào, vui được gặp bạn.) | 2: hi, hallway | See you later. | Nhận ra và dùng được «Hi, good to see you.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p1-g1-n14` | Đọc | Kết thúc cuộc nói chuyện | Xong p1-g1-n13: Chào đồng nghiệp | I have to go now. (Tôi phải đi bây giờ.) | 7: go, bye, take, care, must, next, starting | Hi, good to see you. | Nhận ra và dùng được «I have to go now.»; 7 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 2 — Sinh hoạt hằng ngày (A0)

Cửa `p2-g1`. Chủ đề: Thói quen buổi sáng. Nhãn ngữ pháp: Thì hiện tại đơn (Present Simple).

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p2-g1-n01` | Từ vựng | Thức dậy đúng giờ | Xong p1-g1-n14: Kết thúc cuộc nói chuyện | I wake up at six. (Tôi thức dậy lúc sáu giờ.) | 7: wake, up, six, clock, wakes, alarm, rings | I have to go now. | Nhận ra và dùng được «I wake up at six.»; 7 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n02` | Mẫu câu | Đánh răng buổi sáng | Xong p2-g1-n01: Thức dậy đúng giờ | I brush my teeth. (Tôi đánh răng.) | 8: brush, teeth, every, wash, face, brushes, clean, first | I wake up at six. | Nhận ra và dùng được «I brush my teeth.»; 8 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n03` | Ngữ pháp | Rửa mặt | Xong p2-g1-n02: Đánh răng buổi sáng | I wash my face. (Tôi rửa mặt.) | 4: water, cold, washes, use | I brush my teeth. | Nhận ra và dùng được «I wash my face.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n04` | Nghe 1 | Ăn sáng ở nhà | Xong p2-g1-n03: Rửa mặt | I eat breakfast at home. (Tôi ăn sáng ở nhà.) | 4: eat, home, ready, eats | I wash my face. | Nhận ra và dùng được «I eat breakfast at home.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n05` | Nghe 2 | Uống nước buổi sáng | Xong p2-g1-n04: Ăn sáng ở nhà | I drink water. (Tôi uống nước.) | 3: drink, glass, drinks | I eat breakfast at home. | Nhận ra và dùng được «I drink water.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n06` | Nghe 3 | Mặc quần áo | Xong p2-g1-n05: Uống nước buổi sáng | I get dressed. (Tôi mặc quần áo.) | 8: get, dressed, school, shirt, blue, gets, picks, pick | I drink water. | Nhận ra và dùng được «I get dressed.»; 8 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n07` | Nghe 4 | Chuẩn bị cặp sách | Xong p2-g1-n06: Mặc quần áo | I pack my bag. (Tôi xếp cặp.) | 5: pack, bag, book, packs, one | I get dressed. | Nhận ra và dùng được «I pack my bag.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n08` | Nghe 5 | Đi học | Xong p2-g1-n07: Chuẩn bị cặp sách | I go to school. (Tôi đi học.) | 3: seven, starts, goes | I pack my bag. | Nhận ra và dùng được «I go to school.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n09` | Nói 1 | Ăn sáng với gia đình | Xong p2-g1-n08: Đi học | We eat together. (Chúng tôi ăn cùng nhau.) | 3: together, family, table | I go to school. | Nhận ra và dùng được «We eat together.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n10` | Nói 2 | Nghe đồng hồ báo thức | Xong p2-g1-n09: Ăn sáng với gia đình | The alarm rings. (Chuông báo thức kêu.) | 5: turn, off, turns, stop, ringing | We eat together. | Nhận ra và dùng được «The alarm rings.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n11` | Nói 3 | Chuẩn bị bữa trưa | Xong p2-g1-n10: Nghe đồng hồ báo thức | I pack my lunch. (Tôi chuẩn bị bữa trưa.) | 4: lunch, box, rice, egg | The alarm rings. | Nhận ra và dùng được «I pack my lunch.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n12` | Nói 4 | Chào bố mẹ trước khi đi | Xong p2-g1-n11: Chuẩn bị bữa trưa | Bye, I am leaving. (Con đi đây.) | 3: leaving, day, leaves | I pack my lunch. | Nhận ra và dùng được «Bye, I am leaving.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n13` | Nói 5 | Đến lớp sớm | Xong p2-g1-n12: Chào bố mẹ trước khi đi | I arrive early. (Tôi đến sớm.) | 7: arrive, early, classroom, quiet, arrives, room, still | Bye, I am leaving. | Nhận ra và dùng được «I arrive early.»; 7 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p2-g1-n14` | Đọc | Bắt đầu ngày mới | Xong p2-g1-n13: Đến lớp sớm | My day starts now. (Ngày mới của tôi bắt đầu.) | 5: routine, done, start, ends, begin | I arrive early. | Nhận ra và dùng được «My day starts now.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 3 — Giao tiếp cơ bản ngoài đời (A1)

Cửa `p3-g1`. Chủ đề: Mua sắm & hỏi giá. Nhãn ngữ pháp: How much / How many.

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p3-g1-n01` | Từ vựng | Hỏi giá một món | Xong p2-g1-n14: Bắt đầu ngày mới | How much is this? (Cái này bao nhiêu tiền?) | 3: ten, dollars, price | My day starts now. | Nhận ra và dùng được «How much is this?»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n02` | Mẫu câu | Mua táo | Xong p3-g1-n01: Hỏi giá một món | I would like apples. (Tôi muốn mua táo.) | 5: like, apples, four, fresh, buys | How much is this? | Nhận ra và dùng được «I would like apples.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n03` | Ngữ pháp | Trả tiền mặt | Xong p3-g1-n02: Mua táo | I will pay cash. (Tôi trả tiền mặt.) | 5: pay, cash, money, pays, card | I would like apples. | Nhận ra và dùng được «I will pay cash.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n04` | Nghe 1 | Xin túi | Xong p3-g1-n03: Trả tiền mặt | A bag, please. (Cho tôi một túi.) | 2: paper, needs | I will pay cash. | Nhận ra và dùng được «A bag, please.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n05` | Nghe 2 | Hỏi cỡ áo | Xong p3-g1-n04: Xin túi | Do you have a larger size? (Bạn có cỡ lớn hơn không?) | 4: larger, size, small, wants | A bag, please. | Nhận ra và dùng được «Do you have a larger size?»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n06` | Nghe 3 | Đổi một món hàng | Xong p3-g1-n05: Hỏi cỡ áo | I want to return this. (Tôi muốn trả món này.) | 5: want, return, cup, receipt, returns | Do you have a larger size? | Nhận ra và dùng được «I want to return this.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n07` | Nghe 4 | So sánh hai giá | Xong p3-g1-n06: Đổi một món hàng | This one is cheaper. (Cái này rẻ hơn.) | 5: cheaper, red, costs, more, chooses | I want to return this. | Nhận ra và dùng được «This one is cheaper.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n08` | Nghe 5 | Mua quà | Xong p3-g1-n07: So sánh hai giá | This gift is for Mai. (Món quà này dành cho Mai.) | 3: gift, buying, likes | This one is cheaper. | Nhận ra và dùng được «This gift is for Mai.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n09` | Nói 1 | Hỏi còn hàng | Xong p3-g1-n08: Mua quà | Do you have this in blue? (Bạn còn màu xanh không?) | 1: shop | This gift is for Mai. | Nhận ra và dùng được «Do you have this in blue?»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n10` | Nói 2 | Xin hóa đơn | Xong p3-g1-n09: Hỏi còn hàng | May I have the receipt? (Cho tôi xin hóa đơn.) | 4: may, keeps, shows, paid | Do you have this in blue? | Nhận ra và dùng được «May I have the receipt?»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n11` | Nói 3 | Mua nước uống | Xong p3-g1-n10: Xin hóa đơn | I would like water. (Tôi muốn mua nước.) | 2: bottle, two | May I have the receipt? | Nhận ra và dùng được «I would like water.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n12` | Nói 4 | Không mua món đắt | Xong p3-g1-n11: Mua nước uống | That is too expensive. (Cái đó đắt quá.) | 3: expensive, watch, buy | I would like water. | Nhận ra và dùng được «That is too expensive.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n13` | Nói 5 | Nhờ gói quà | Xong p3-g1-n12: Không mua món đắt | Could you wrap it? (Bạn gói quà giúp tôi được không?) | 2: wrap, covered | That is too expensive. | Nhận ra và dùng được «Could you wrap it?»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p3-g1-n14` | Đọc | Rời cửa hàng | Xong p3-g1-n13: Nhờ gói quà | Thank you, goodbye. (Cảm ơn, tạm biệt.) | 3: come, again, seller | Could you wrap it? | Nhận ra và dùng được «Thank you, goodbye.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 4 — Gia đình, bạn bè, cảm xúc (A1)

Cửa `p4-g1`. Chủ đề: Kể về gia đình. Nhãn ngữ pháp: Sở hữu cách (my, your, his, her).

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p4-g1-n01` | Từ vựng | Giới thiệu mẹ | Xong p3-g1-n14: Rời cửa hàng | This is my mother. (Đây là mẹ tôi.) | 4: mother, kind, person, photo | Thank you, goodbye. | Nhận ra và dùng được «This is my mother.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n02` | Mẫu câu | Kể về bố | Xong p4-g1-n01: Giới thiệu mẹ | My father is at work. (Bố tôi đang đi làm.) | 3: father, work, comes | This is my mother. | Nhận ra và dùng được «My father is at work.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n03` | Ngữ pháp | Nói về anh trai | Xong p4-g1-n02: Kể về bố | My brother is tall. (Anh trai tôi cao.) | 4: brother, tall, plays, football | My father is at work. | Nhận ra và dùng được «My brother is tall.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n04` | Nghe 1 | Nói về em gái | Xong p4-g1-n03: Nói về anh trai | My sister is young. (Em gái tôi còn nhỏ.) | 3: sister, young, stories | My brother is tall. | Nhận ra và dùng được «My sister is young.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n05` | Nghe 2 | Nhà có mấy người | Xong p4-g1-n04: Nói về em gái | There are four people. (Nhà có bốn người.) | 2: people, live | My sister is young. | Nhận ra và dùng được «There are four people.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n06` | Nghe 3 | Ông bà | Xong p4-g1-n05: Nhà có mấy người | My grandmother cooks. (Bà tôi nấu ăn.) | 5: grandmother, cooks, soup, hot, cooking | There are four people. | Nhận ra và dùng được «My grandmother cooks.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n07` | Nghe 4 | Ảnh gia đình | Xong p4-g1-n06: Ông bà | This photo shows my family. (Ảnh này là gia đình tôi.) | 4: garden, picture, flowers, behind | My grandmother cooks. | Nhận ra và dùng được «This photo shows my family.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n08` | Nghe 5 | Cuối tuần với gia đình | Xong p4-g1-n07: Ảnh gia đình | We stay home on Sunday. (Chủ nhật chúng tôi ở nhà.) | 5: stay, sunday, cook, talk, stays | This photo shows my family. | Nhận ra và dùng được «We stay home on Sunday.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n09` | Nói 1 | Giúp việc nhà | Xong p4-g1-n08: Cuối tuần với gia đình | I help my mother. (Tôi giúp mẹ.) | 2: dishes, dinner | We stay home on Sunday. | Nhận ra và dùng được «I help my mother.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n10` | Nói 2 | Phòng của Beego | Xong p4-g1-n09: Giúp việc nhà | This is my room. (Đây là phòng của tôi.) | 2: bed, window | I help my mother. | Nhận ra và dùng được «This is my room.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n11` | Nói 3 | Bữa tối gia đình | Xong p4-g1-n10: Phòng của Beego | We have dinner together. (Chúng tôi ăn tối cùng nhau.) | 1: story | This is my room. | Nhận ra và dùng được «We have dinner together.»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n12` | Nói 4 | Nhà của dì | Xong p4-g1-n11: Bữa tối gia đình | We visit my aunt. (Chúng tôi thăm dì.) | 5: visit, aunt, saturday, house, visits | We have dinner together. | Nhận ra và dùng được «We visit my aunt.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n13` | Nói 5 | Nuôi một con mèo | Xong p4-g1-n12: Nhà của dì | We have a cat. (Nhà tôi có một con mèo.) | 3: cat, sleeps, sofa | We visit my aunt. | Nhận ra và dùng được «We have a cat.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p4-g1-n14` | Đọc | Yêu gia đình | Xong p4-g1-n13: Nuôi một con mèo | I love my family. (Tôi yêu gia đình tôi.) | 2: love, loves | We have a cat. | Nhận ra và dùng được «I love my family.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 5 — Công việc và học tập (A1+)

Cửa `p5-g1`. Chủ đề: Nghề nghiệp & môi trường làm việc. Nhãn ngữ pháp: Thì hiện tại tiếp diễn (Present Continuous).

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p5-g1-n01` | Từ vựng | Nói về nghề của mình | Xong p4-g1-n14: Yêu gia đình | I am a teacher. (Tôi là giáo viên.) | 2: teacher, works | I love my family. | Nhận ra và dùng được «I am a teacher.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n02` | Mẫu câu | Nơi làm việc | Xong p5-g1-n01: Nói về nghề của mình | I work in an office. (Tôi làm việc trong văn phòng.) | 2: office, desk | I am a teacher. | Nhận ra và dùng được «I work in an office.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n03` | Ngữ pháp | Đồng nghiệp | Xong p5-g1-n02: Nơi làm việc | I work with a team. (Tôi làm việc với một nhóm.) | 4: team, share, plan, shares | I work in an office. | Nhận ra và dùng được «I work with a team.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n04` | Nghe 1 | Giờ làm | Xong p5-g1-n03: Đồng nghiệp | I start work at eight. (Tôi bắt đầu làm lúc tám giờ.) | 4: eight, finish, five, finishes | I work with a team. | Nhận ra và dùng được «I start work at eight.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n05` | Nghe 2 | Việc trong ngày | Xong p5-g1-n04: Giờ làm | I answer emails. (Tôi trả lời email.) | 3: answer, emails, answers | I start work at eight. | Nhận ra và dùng được «I answer emails.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n06` | Nghe 3 | Nghề của bạn | Xong p5-g1-n05: Việc trong ngày | What do you do? (Bạn làm nghề gì?) | 2: nurse, colleague | I answer emails. | Nhận ra và dùng được «What do you do?»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n07` | Nghe 4 | Máy tính ở bàn | Xong p5-g1-n06: Nghề của bạn | I use a computer. (Tôi dùng máy tính.) | 3: computer, screen, bright | What do you do? | Nhận ra và dùng được «I use a computer.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n08` | Nghe 5 | Cuộc gọi công việc | Xong p5-g1-n07: Máy tính ở bàn | I call a client. (Tôi gọi cho khách.) | 3: call, client, short | I use a computer. | Nhận ra và dùng được «I call a client.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n09` | Nói 1 | Việc nhà và việc làm | Xong p5-g1-n08: Cuộc gọi công việc | I work from home today. (Hôm nay tôi làm ở nhà.) | 0: — | I call a client. | Nhận ra và dùng được «I work from home today.»; 0 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n10` | Nói 2 | Nghỉ trưa | Xong p5-g1-n09: Việc nhà và việc làm | We have a lunch break. (Chúng tôi nghỉ trưa.) | 3: break, hour, lasts | I work from home today. | Nhận ra và dùng được «We have a lunch break.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n11` | Nói 3 | Sếp giao việc | Xong p5-g1-n10: Nghỉ trưa | My manager gives me a task. (Sếp giao cho tôi một việc.) | 3: manager, gives, task | We have a lunch break. | Nhận ra và dùng được «My manager gives me a task.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n12` | Nói 4 | Làm việc nhóm | Xong p5-g1-n11: Sếp giao việc | We finish the plan together. (Chúng tôi cùng hoàn thành kế hoạch.) | 3: everyone, part, each | My manager gives me a task. | Nhận ra và dùng được «We finish the plan together.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n13` | Nói 5 | Ngày đầu đi làm | Xong p5-g1-n12: Làm việc nhóm | It is my first day. (Đây là ngày đầu tiên tôi đi làm.) | 2: welcomes, glad | We finish the plan together. | Nhận ra và dùng được «It is my first day.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p5-g1-n14` | Đọc | Nói về công việc mình thích | Xong p5-g1-n13: Ngày đầu đi làm | I like my job. (Tôi thích công việc của mình.) | 3: job, busy, useful | It is my first day. | Nhận ra và dùng được «I like my job.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 6 — Du lịch và tình huống thực tế (A2)

Cửa `p6-g1`. Chủ đề: Sân bay & khách sạn. Nhãn ngữ pháp: Can / Could — yêu cầu lịch sự.

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p6-g1-n01` | Từ vựng | Hỏi cổng lên máy bay | Xong p5-g1-n14: Nói về công việc mình thích | Where is gate 4? (Cổng số 4 ở đâu?) | 5: left, boarding, sign, points, look | I like my job. | Nhận ra và dùng được «Where is gate 4?»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n02` | Mẫu câu | Làm thủ tục | Xong p6-g1-n01: Hỏi cổng lên máy bay | I have my passport. (Tôi có hộ chiếu.) | 3: passport, wait, moment | Where is gate 4? | Nhận ra và dùng được «I have my passport.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n03` | Ngữ pháp | Hỏi giờ bay | Xong p6-g1-n02: Làm thủ tục | What time is the flight? (Chuyến bay mấy giờ?) | 3: time, flight, nine | I have my passport. | Nhận ra và dùng được «What time is the flight?»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n04` | Nghe 1 | Tìm khách sạn | Xong p6-g1-n03: Hỏi giờ bay | I have a reservation. (Tôi có đặt phòng.) | 3: reservation, tonight, hotel | What time is the flight? | Nhận ra và dùng được «I have a reservation.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n05` | Nghe 2 | Hỏi tầng | Xong p6-g1-n04: Tìm khách sạn | The room is on the second floor. (Phòng ở tầng hai.) | 5: second, floor, which, key, lift | I have a reservation. | Nhận ra và dùng được «The room is on the second floor.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n06` | Nghe 3 | Gọi taxi đến khách sạn | Xong p6-g1-n05: Hỏi tầng | I need a taxi to the hotel. (Tôi cần taxi đến khách sạn.) | 4: need, taxi, outside, waiting | The room is on the second floor. | Nhận ra và dùng được «I need a taxi to the hotel.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n07` | Nghe 4 | Hỏi ăn sáng khách sạn | Xong p6-g1-n06: Gọi taxi đến khách sạn | Is breakfast included? (Bữa sáng đã gồm trong giá chưa?) | 1: included | I need a taxi to the hotel. | Nhận ra và dùng được «Is breakfast included?»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n08` | Nghe 5 | Xin bản đồ | Xong p6-g1-n07: Hỏi ăn sáng khách sạn | Could I have a map? (Cho tôi xin bản đồ được không?) | 3: map, area, station | Is breakfast included? | Nhận ra và dùng được «Could I have a map?»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n09` | Nói 1 | Hành lý | Xong p6-g1-n08: Xin bản đồ | This is my suitcase. (Đây là vali của tôi.) | 4: suitcase, mine, put, belongs | Could I have a map? | Nhận ra và dùng được «This is my suitcase.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n10` | Nói 2 | Chìa khóa phòng | Xong p6-g1-n09: Hành lý | Here is the room key. (Đây là chìa khóa phòng.) | 1: receptionist | This is my suitcase. | Nhận ra và dùng được «Here is the room key.»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n11` | Nói 3 | Hỏi wifi | Xong p6-g1-n10: Chìa khóa phòng | What is the wifi password? (Mật khẩu wifi là gì?) | 2: wifi, password | Here is the room key. | Nhận ra và dùng được «What is the wifi password?»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n12` | Nói 4 | Trả phòng | Xong p6-g1-n11: Hỏi wifi | I would like to check out. (Tôi muốn trả phòng.) | 5: check, out, bill, checkout, receives | What is the wifi password? | Nhận ra và dùng được «I would like to check out.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n13` | Nói 5 | Đến muộn | Xong p6-g1-n12: Trả phòng | My flight is late. (Chuyến bay của tôi bị trễ.) | 1: late | I would like to check out. | Nhận ra và dùng được «My flight is late.»; 1 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p6-g1-n14` | Đọc | Hỏi đường ra phố | Xong p6-g1-n13: Đến muộn | How do I get to the city? (Tôi ra trung tâm bằng cách nào?) | 4: city, center, bus, number | My flight is late. | Nhận ra và dùng được «How do I get to the city?»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 7 — Trung cấp giao tiếp (B1)

Cửa `p7-g1`. Chủ đề: Họp & email công việc. Nhãn ngữ pháp: Thì quá khứ đơn (Past Simple).

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p7-g1-n01` | Từ vựng | Gửi một email | Xong p6-g1-n14: Hỏi đường ra phố | Please reply to this email. (Vui lòng trả lời email này.) | 3: reply, email, afternoon | How do I get to the city? | Nhận ra và dùng được «Please reply to this email.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n02` | Mẫu câu | Đính kèm tệp | Xong p7-g1-n01: Gửi một email | I attached the file. (Tôi đã đính kèm tệp.) | 3: attached, file, should | Please reply to this email. | Nhận ra và dùng được «I attached the file.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n03` | Ngữ pháp | Hoãn cuộc họp | Xong p7-g1-n02: Đính kèm tệp | Can we postpone the meeting? (Chúng ta hoãn cuộc họp được không?) | 5: postpone, meeting, instead, moves, move | I attached the file. | Nhận ra và dùng được «Can we postpone the meeting?»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n04` | Nghe 1 | Xác nhận lịch | Xong p7-g1-n03: Hoãn cuộc họp | I confirm the schedule. (Tôi xác nhận lịch.) | 4: confirm, schedule, three, confirms | Can we postpone the meeting? | Nhận ra và dùng được «I confirm the schedule.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n05` | Nghe 2 | Xin phản hồi | Xong p7-g1-n04: Xác nhận lịch | Please send feedback. (Vui lòng gửi phản hồi.) | 2: send, feedback | I confirm the schedule. | Nhận ra và dùng được «Please send feedback.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n06` | Nghe 3 | Chuyển tiếp thư | Xong p7-g1-n05: Xin phản hồi | I will forward the email. (Tôi sẽ chuyển tiếp email.) | 4: forward, update, forwards, whole | Please send feedback. | Nhận ra và dùng được «I will forward the email.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n07` | Nghe 4 | Viết tiêu đề | Xong p7-g1-n06: Chuyển tiếp thư | The subject is urgent. (Tiêu đề là khẩn.) | 4: subject, urgent, mark, because | I will forward the email. | Nhận ra và dùng được «The subject is urgent.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n08` | Nghe 5 | Soạn bản nháp | Xong p7-g1-n07: Viết tiêu đề | I saved a draft. (Tôi đã lưu bản nháp.) | 5: saved, draft, sent, yet, only | The subject is urgent. | Nhận ra và dùng được «I saved a draft.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n09` | Nói 1 | Ghi biên bản | Xong p7-g1-n08: Soạn bản nháp | I will write the minutes. (Tôi sẽ viết biên bản.) | 3: write, minutes, sends | I saved a draft. | Nhận ra và dùng được «I will write the minutes.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n10` | Nói 2 | Việc cần làm | Xong p7-g1-n09: Ghi biên bản | This is an action item. (Đây là một việc cần làm.) | 2: action, item | I will write the minutes. | Nhận ra và dùng được «This is an action item.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n11` | Nói 3 | Họp online | Xong p7-g1-n10: Việc cần làm | The call is on the computer. (Cuộc họp diễn ra trên máy tính.) | 3: join, joining, joins | This is an action item. | Nhận ra và dùng được «The call is on the computer.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n12` | Nói 4 | Nhắc giờ | Xong p7-g1-n11: Họp online | The meeting starts in ten minutes. (Cuộc họp bắt đầu sau mười phút.) | 2: soon, waits | The call is on the computer. | Nhận ra và dùng được «The meeting starts in ten minutes.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n13` | Nói 5 | Xin lỗi vì trả lời muộn | Xong p7-g1-n12: Nhắc giờ | Sorry for the late reply. (Xin lỗi vì trả lời muộn.) | 3: sorry, another, replies | The meeting starts in ten minutes. | Nhận ra và dùng được «Sorry for the late reply.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p7-g1-n14` | Đọc | Tóm tắt cho sếp | Xong p7-g1-n13: Xin lỗi vì trả lời muộn | Here is a short summary. (Đây là bản tóm tắt ngắn.) | 2: summary, read | Sorry for the late reply. | Nhận ra và dùng được «Here is a short summary.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Phần 8 — Nâng cao / Tự tin giao tiếp (B1+)

Cửa `p8-g1`. Chủ đề: Thuyết trình & tranh luận. Nhãn ngữ pháp: Liên từ (although, however, therefore).

| Mã | Nhãn lộ trình | Mục tiêu | Tiên quyết | Cụm mục tiêu | Từ nội dung mới | Ôn | Bằng chứng đề xuất |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `p8-g1-n01` | Từ vựng | Nêu ý kiến | Xong p7-g1-n14: Tóm tắt cho sếp | In my opinion, the plan is clear. (Theo tôi, kế hoạch này rõ.) | 3: opinion, clear, agree | Here is a short summary. | Nhận ra và dùng được «In my opinion, the plan is clear.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n02` | Mẫu câu | Đồng ý có lý do | Xong p8-g1-n01: Nêu ý kiến | I agree because the evidence is strong. (Tôi đồng ý vì bằng chứng vững.) | 5: evidence, strong, proof, makes, say | In my opinion, the plan is clear. | Nhận ra và dùng được «I agree because the evidence is strong.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n03` | Ngữ pháp | Không đồng ý lịch sự | Xong p8-g1-n02: Đồng ý có lý do | I disagree because the cost is high. (Tôi không đồng ý vì chi phí cao.) | 5: disagree, cost, high, point, disagrees | I agree because the evidence is strong. | Nhận ra và dùng được «I disagree because the cost is high.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n04` | Nghe 1 | Đưa ví dụ | Xong p8-g1-n03: Không đồng ý lịch sự | Let me give an example. (Để tôi đưa một ví dụ.) | 3: give, example, liked | I disagree because the cost is high. | Nhận ra và dùng được «Let me give an example.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n05` | Nghe 2 | Nhượng bộ rồi phản biện | Xong p8-g1-n04: Đưa ví dụ | Although the idea is good, the time is short. (Dù ý tưởng hay, thời gian lại ít.) | 2: although, idea | Let me give an example. | Nhận ra và dùng được «Although the idea is good, the time is short.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n06` | Nghe 3 | Kết luận | Xong p8-g1-n05: Nhượng bộ rồi phản biện | Therefore, we should wait. (Do đó, chúng ta nên chờ.) | 3: therefore, decide, conclusion | Although the idea is good, the time is short. | Nhận ra và dùng được «Therefore, we should wait.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n07` | Nghe 4 | Mời khán giả | Xong p8-g1-n06: Kết luận | What do you think? (Bạn nghĩ sao?) | 3: think, students, questions | Therefore, we should wait. | Nhận ra và dùng được «What do you think?»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n08` | Nghe 5 | Dùng ảnh minh họa | Xong p8-g1-n07: Mời khán giả | This photo supports my point. (Ảnh này củng cố ý của tôi.) | 3: supports, result, easy | What do you think? | Nhận ra và dùng được «This photo supports my point.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n09` | Nói 1 | Nghe một ý trái | Xong p8-g1-n08: Dùng ảnh minh họa | However, the other group disagrees. (Tuy nhiên, nhóm kia không đồng ý.) | 4: however, other, group, different | This photo supports my point. | Nhận ra và dùng được «However, the other group disagrees.»; 4 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n10` | Nói 2 | Nói rõ ý chính | Xong p8-g1-n09: Nghe một ý trái | My main point is simple. (Ý chính của tôi rất đơn giản.) | 3: main, simple, remember | However, the other group disagrees. | Nhận ra và dùng được «My main point is simple.»; 3 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n11` | Nói 3 | Giọng nói | Xong p8-g1-n10: Nói rõ ý chính | Please speak in a clear voice. (Hãy nói bằng giọng rõ.) | 5: speak, voice, back, hear, helps | My main point is simple. | Nhận ra và dùng được «Please speak in a clear voice.»; 5 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n12` | Nói 4 | Trả lời câu hỏi | Xong p8-g1-n11: Giọng nói | That is a good question. (Đó là một câu hỏi hay.) | 0: — | Please speak in a clear voice. | Nhận ra và dùng được «That is a good question.»; 0 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n13` | Nói 5 | Tóm lại bài nói | Xong p8-g1-n12: Trả lời câu hỏi | In conclusion, the plan can work. (Tóm lại, kế hoạch này làm được.) | 2: try, saying | That is a good question. | Nhận ra và dùng được «In conclusion, the plan can work.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |
| `p8-g1-n14` | Đọc | Cảm ơn người nghe | Xong p8-g1-n13: Tóm lại bài nói | Thank you for listening. (Cảm ơn mọi người đã lắng nghe.) | 2: listening, any | In conclusion, the plan can work. | Nhận ra và dùng được «Thank you for listening.»; 2 từ mới trong khoảng kiểm chứng, chưa phải mục tiêu đã chốt |

## Khoảng trống

1. Nhãn 16 node trên lộ trình và nội dung 14 bài thường là hai lớp khác nhau. Bài `n01` được gọi là từ vựng nhưng chạy đủ 12 hoạt động của tình huống đầu tiên, không phải một danh sách 20 từ mới.
2. Đặc tả `docs/beego-learn-curriculum-content-spec.md` mục 5 và 6 mô tả blueprint và ngân hàng chủ đề. Ma trận này mới là khảo sát 112 bài đang sinh từ mã.
3. Giả thuyết 5 từ hoặc cụm mới mỗi bài chưa khớp mã: trung vị 3 từ nội dung mới, biên độ 0–8, chỉ 41/112 bài trong khoảng 4–6.
4. Một số từ mới là chi tiết tình huống (ví dụ hallway ở `p1-g1-n13`) chứ không nằm trong ngân hàng chủ đề và không có bài sau ôn lại.
5. Hàng ôn mới chỉ là cụm của bài ngay trước. Ngân hàng chung xoay vòng, không phải danh sách ôn đã chọn cho bài đó.
6. Hoàn thành bài không yêu cầu tỷ lệ đúng. Chưa có bằng chứng đạt theo từng cụm mới.
7. Nhãn ngữ pháp của cửa không có hoạt động riêng trong bộ 12 hoạt động.
8. Bài 15 và bài 16 không thuộc ma trận này. Khảo sát không đổi Boss Test, mastery hay SRS.
9. Phần 1 trong đặc tả cũ nêu alphabet và số đếm. Mười bốn bài thường của cửa 1 không lấy đó làm cụm mục tiêu.

## Cửa mẫu p1-g1 đã viết lại trong mã nguồn

Bảng phía trên là số đo trước khi sửa. Phần này là nội dung cửa 1 đang chạy trên production sau lần chỉnh bản dịch truyện, ôn đúng, câu dẫn, tên cửa, nhãn phiên và câu bắt buộc. Bài 15, bài 16 và cửa 2–8 không đổi câu hỏi.

Không ép mỗi bài đủ 5 mục mới. Bài củng cố n11 và n12 cố ý không thêm mục mới.

| Bài | Loại | Mục mới | Ôn | Trở lại sau |
| --- | --- | --- | --- | --- |
| n01 | Giới thiệu | Hello, I am, name | — | name ở n02; Hello và I am khi chào rồi hỏi tên |
| n02 | Giới thiệu | What is your name?, My name is | Hello, I am, name | My name is ở n09 |
| n03 | Giới thiệu | How are you?, I am fine | Hello, name | How are you? và I am fine ở n04, n11 |
| n04 | Giới thiệu | Good morning | Hello, I am fine | Good morning đối chiếu với Good night ở n05, rồi ở n11 |
| n05 | Giới thiệu | Good night | Good morning | Good morning là câu dịch đúng trong n05. Good night là câu đúng khi phải đi ở n14 |
| n06 | Giới thiệu | Thank you | Good morning, Hello | Thank you là câu dịch đúng ở n07 và n14 |
| n07 | Giới thiệu | Excuse me | Thank you, Hello | Excuse me là câu đúng khi giới thiệu bạn ở n09 |
| n08 | Giới thiệu | Goodbye, See you later | Hello | Goodbye và See you later là câu đúng ở n12 và n14 |
| n09 | Củng cố | friend, This is my friend | Hello, My name is, Excuse me | friend và This is my friend là câu đúng ở n10 |
| n10 | Giới thiệu | Welcome | Hello, friend | Welcome dùng đúng trong bài này, không tính là ôn ở bài sau |
| n11 | Củng cố | không thêm | Good morning, How are you?, I am fine | Ba cụm là câu đúng trong tình huống sáng |
| n12 | Củng cố | không thêm | Goodbye, See you later | Hai cụm là câu đúng khi phải đi ở n14 |
| n13 | Vận dụng | Hi, Good to see you | Hello, Good morning | Hello và Good morning là câu đúng. See you later chỉ là đáp án không chọn, không tính ôn |
| n14 | Vận dụng | I have to go | Good night, Thank you, Goodbye, See you later | Hết cửa 1; chưa đưa sang cửa 2 |

Nhãn trên màn hoàn thành là «Kết quả luyện tập trong phiên». Nhận biết là hoạt động 1, 2, 3, 4, 6, 7 và 12. Vận dụng là hoạt động 5, 8, 9 và 10. Đọc thành tiếng không được dùng để kết luận thành thạo hay phát âm đạt. Lượt không có câu nộp thì ghi chưa có câu luyện, không đổi bài đã hoàn thành. Bản dịch truyện chỉ hiện sau khi chấm. Câu 1–10 và 12 của cửa này là bắt buộc trên server; câu đọc thành tiếng không bắt buộc. Không dùng mốc “nghe đúng 4 mục” hay “đọc lại câu là đạt”. Ôn chỉ tính khi cụm được dùng đúng, không tính đáp án nhiễu.

## Phương án nâng cấp một cửa mẫu

Đoạn dưới là giả thuyết cũ, đã được thay bằng bảng “đã viết lại” ở trên. Giữ lại để thấy phần đã bác.

Giữ 14 bài thường và thứ tự mã `n01`–`n14`. Với mỗi bài, chốt một danh sách khoảng 5 mục mới trước khi viết câu. Mục mới phải là cụm hoặc từ sẽ xuất hiện lại ở hoạt động nghe, sắp xếp, nói và ở hàng ôn của bài sau. Chi tiết chỉ để hỏi đọc hiểu, như địa điểm trong câu chuyện, không được tính là mục mới nếu bài không dạy từ đó.

Phân bổ giả thuyết cho cửa mẫu, cần kiểm chứng khi viết lại nội dung:

| Bài | Mục tiêu giữ từ mã | Khoảng 5 mục mới đề xuất | Ôn lại ở bài sau |
| --- | --- | --- | --- |
| n01 | Chào một người mới | hello, I am, name, Beego, nice to meet you | n02 nghe và sắp xếp lại hello / I am |
| n02 | Hỏi tên | What is your name, My name is, friend, yes, no | n03 dùng name trong câu chào |
| n03 | Nói mình khỏe | How are you, I am fine, thank you, please, sorry | n04 ôn fine và thank you |
| n04 | Chào buổi sáng | Good morning, morning, see you, today, friend | n05 đối chiếu morning / night |
| n05 | Chào buổi tối | Good night, night, sleep, tomorrow, goodbye | n06 ôn goodbye |
| n06 | Cảm ơn | Thank you, thanks, welcome, please, help | n07 ôn thank you trước khi hỏi |
| n07 | Xin lỗi để hỏi | Excuse me, where, here, near, please | n08 ôn excuse me và goodbye |
| n08 | Tạm biệt | Goodbye, bye, see you later, friend, gate chỉ nếu được dạy như từ của bài | n09 ôn goodbye khi giới thiệu |
| n09 | Giới thiệu bạn | This is, my friend, his, her, name | n10 ôn This is và friend |
| n10 | Chào mừng | Welcome, new, class, sit, please | n11 ôn welcome và How are you |
| n11 | Hỏi sức khỏe buổi sáng | How are you this morning, I am fine, morning, thank you, today | n12 ôn see you |
| n12 | Hẹn gặp lại | See you later, today, noon, goodbye, friend | n13 ôn hi và see you |
| n13 | Chào đồng nghiệp | Hi, good to see you, colleague, hello, friend | n14 ôn hi và goodbye |
| n14 | Kết thúc nói chuyện | I have to go, now, bye, see you, thank you | Cửa sau ôn goodbye và see you, không đưa vào Boss Test trong pha này |

Giả thuyết bằng chứng cũ — nghe đúng ít nhất bốn trong năm mục và đọc lại câu là đạt — đã bị bác khi viết lại cửa mẫu. Bằng chứng đang dùng là nhận biết và vận dụng, tách khỏi hoàn thành bài.

Các cửa 2–8 dùng cùng khuôn sau khi cửa mẫu được đối chiếu với người học thật. Chưa nhân bản đề xuất 5 mục sang 98 bài còn lại trong tài liệu này, vì giả thuyết chưa được kiểm chứng.
