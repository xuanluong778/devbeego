/**
 * One communicative slice per normal node.
 * Sentences are different situations inside the part topic, not renamed copies.
 */

function phrase(en, vi) {
  return { en, vi, words: en.replace(/[.!?,]+$/g, "").split(" ").filter(Boolean) };
}

function story(text, q, a, wrong) {
  return { text, q, a, wrong };
}

function row(goal, phraseEn, phraseVi, listen, dictation, speak, storyText, storyQ, storyA, wrong) {
  return {
    goal,
    phrase: phrase(phraseEn, phraseVi),
    listen,
    dictation,
    speak,
    story: story(storyText, storyQ, storyA, wrong),
  };
}

const PARTS = {
  1: [
    row("Chào một người mới", "Hello I am Beego.", "Xin chào, tôi là Beego.", "Hello, I am Beego.", "Nice to meet you.", "Hello.", "Beego meets Mai at the door and says hello.", "Beego làm gì khi gặp Mai?", "Chào Mai", ["Đi mua táo", "Gửi email", "Hỏi giá"]),
    row("Hỏi tên một người", "What is your name?", "Bạn tên gì?", "My name is Beego.", "What is your name?", "My name is Beego.", "Lan asks a new classmate for their name.", "Lan đang hỏi gì?", "Tên của bạn mới", ["Giá vé", "Giờ họp", "Số phòng"]),
    row("Nói mình khỏe", "I am fine.", "Tôi khỏe.", "I am fine today.", "How are you?", "I am fine.", "After class, Mai asks Beego how he is. He says he is fine.", "Beego nói mình thế nào?", "Anh ấy khỏe", ["Anh ấy bị trễ", "Anh ấy đói", "Anh ấy muốn taxi"]),
    row("Chào buổi sáng", "Good morning.", "Chào buổi sáng.", "Good morning, Mai.", "See you in the morning.", "Good morning.", "Beego sees his friend at breakfast and says good morning.", "Beego chào lúc nào?", "Buổi sáng", ["Buổi tối", "Lúc họp", "Lúc trả hàng"]),
    row("Chào buổi tối", "Good night.", "Chúc ngủ ngon.", "Good night, friend.", "See you tomorrow.", "Good night.", "At the end of the day, Beego says good night to his family.", "Beego nói gì lúc kết thúc ngày?", "Good night", ["Good morning", "How much", "Send the file"]),
    row("Cảm ơn một người", "Thank you.", "Cảm ơn bạn.", "Thank you very much.", "You are welcome.", "Thank you.", "Mai helps Beego open the door. Beego says thank you.", "Beego nói gì sau khi được giúp?", "Cảm ơn", ["Xin lỗi", "Tạm biệt", "Bao nhiêu tiền"]),
    row("Xin lỗi để hỏi đường", "Excuse me.", "Xin lỗi, cho tôi hỏi.", "Excuse me, where is the hall?", "The hall is near here.", "Excuse me.", "Beego needs the hall. He says excuse me before the question.", "Beego nói gì trước khi hỏi?", "Excuse me", ["Good night", "I am fine", "See you later"]),
    row("Tạm biệt bạn", "Goodbye.", "Tạm biệt.", "Goodbye, see you later.", "See you later.", "Goodbye.", "The lesson ends. Beego says goodbye at the gate.", "Beego nói gì ở cổng?", "Tạm biệt", ["Chào buổi sáng", "Cảm ơn món quà", "Gửi biên bản"]),
    row("Giới thiệu một người bạn", "This is my friend.", "Đây là bạn của tôi.", "This is my friend Mai.", "Her name is Mai.", "This is my friend.", "Beego introduces Mai to a new classmate.", "Beego giới thiệu ai?", "Bạn Mai", ["Giáo viên mới", "Người bán hàng", "Khách sạn"]),
    row("Chào mừng người mới", "Welcome.", "Chào mừng bạn.", "Welcome to our class.", "Please sit here.", "Welcome.", "A new student arrives. The class says welcome.", "Lớp nói gì với bạn mới?", "Chào mừng", ["Tạm biệt", "Trả áo", "Hoãn họp"]),
    row("Hỏi sức khỏe buổi sáng", "How are you this morning?", "Sáng nay bạn khỏe không?", "How are you this morning?", "I am well this morning.", "How are you?", "Mai calls Beego in the morning and asks how he is.", "Mai gọi để làm gì?", "Hỏi sức khỏe", ["Hỏi giá", "Hỏi giờ bay", "Hỏi bài tập"]),
    row("Hẹn gặp lại", "See you later.", "Hẹn gặp lại.", "See you later today.", "I will see you at noon.", "See you later.", "Beego leaves the classroom and says see you later.", "Beego hẹn gặp khi nào?", "Lát nữa", ["Tối mai ở sân bay", "Sau buổi thuyết trình", "Khi có hóa đơn"]),
    row("Chào đồng nghiệp", "Hi, good to see you.", "Chào, vui được gặp bạn.", "Hi, good to see you here.", "Good to see you too.", "Hi.", "Beego meets a colleague in the hallway and greets them.", "Họ gặp nhau ở đâu?", "Hành lang", ["Quầy thu ngân", "Cửa sân bay", "Bục thuyết trình"]),
    row("Kết thúc cuộc nói chuyện", "I have to go now.", "Tôi phải đi bây giờ.", "I have to go now.", "Bye, take care.", "I have to go now.", "The chat ends because Beego has to go to his next class.", "Vì sao cuộc nói chuyện kết thúc?", "Beego phải đi học tiếp", ["Vì hết hàng", "Vì trễ chuyến bay", "Vì hết giờ tranh luận"]),
  ],
  2: [
    row("Thức dậy đúng giờ", "I wake up at six.", "Tôi thức dậy lúc sáu giờ.", "I wake up at six.", "It is six o'clock.", "I wake up at six.", "Beego wakes up at six and opens the curtain.", "Beego thức dậy lúc mấy giờ?", "Sáu giờ", ["Tám giờ tối", "Giờ họp", "Giờ bay"]),
    row("Đánh răng buổi sáng", "I brush my teeth.", "Tôi đánh răng.", "I brush my teeth every morning.", "Then I wash my face.", "I brush my teeth.", "Before breakfast, Beego brushes his teeth.", "Beego làm gì trước bữa sáng?", "Đánh răng", ["Gửi email", "Mua áo", "Thuyết trình"]),
    row("Rửa mặt", "I wash my face.", "Tôi rửa mặt.", "I wash my face with water.", "The water is cold.", "I wash my face.", "Beego washes his face after he brushes his teeth.", "Beego rửa mặt bằng gì?", "Nước", ["Cà phê", "Sữa", "Trà"]),
    row("Ăn sáng ở nhà", "I eat breakfast at home.", "Tôi ăn sáng ở nhà.", "I eat breakfast at home.", "Breakfast is ready.", "I eat breakfast.", "Beego eats breakfast in the kitchen, not at a cafe.", "Beego ăn sáng ở đâu?", "Ở nhà", ["Ở khách sạn", "Ở sân bay", "Ở cửa hàng"]),
    row("Uống nước buổi sáng", "I drink water.", "Tôi uống nước.", "I drink a glass of water.", "Water is good in the morning.", "I drink water.", "After breakfast Beego drinks a glass of water.", "Beego uống gì sau bữa sáng?", "Nước", ["Cà phê sữa", "Nước ngọt", "Trà đá"]),
    row("Mặc quần áo", "I get dressed.", "Tôi mặc quần áo.", "I get dressed for school.", "My shirt is blue.", "I get dressed.", "Beego gets dressed and chooses a blue shirt.", "Áo của Beego màu gì?", "Xanh", ["Đỏ", "Đen", "Trắng"]),
    row("Chuẩn bị cặp sách", "I pack my bag.", "Tôi xếp cặp.", "I pack my bag for school.", "My book is in the bag.", "I pack my bag.", "Beego packs his bag and puts one book inside.", "Beego bỏ gì vào cặp?", "Một quyển sách", ["Hóa đơn", "Hộ chiếu", "Slide"]),
    row("Đi học", "I go to school.", "Tôi đi học.", "I go to school at seven.", "School starts at seven.", "I go to school.", "Beego leaves home and goes to school at seven.", "Beego đến trường lúc mấy giờ?", "Bảy giờ", ["Sáu giờ", "Trưa", "Tối"]),
    row("Ăn sáng với gia đình", "We eat together.", "Chúng tôi ăn cùng nhau.", "We eat breakfast together.", "My family is at the table.", "We eat together.", "The family sits at one table and eats breakfast together.", "Gia đình ăn ở đâu?", "Cùng một bàn", ["Mỗi người một quán", "Trên taxi", "Trong phòng họp"]),
    row("Nghe đồng hồ báo thức", "The alarm rings.", "Chuông báo thức kêu.", "The alarm rings at six.", "I turn off the alarm.", "The alarm rings.", "The alarm rings, and Beego turns it off.", "Beego làm gì khi chuông kêu?", "Tắt chuông", ["Gọi điện", "Gửi file", "Mua vé"]),
    row("Chuẩn bị bữa trưa", "I pack my lunch.", "Tôi chuẩn bị bữa trưa.", "I pack my lunch box.", "Lunch is rice and an egg.", "I pack my lunch.", "Beego packs rice and an egg for lunch.", "Hộp cơm có gì?", "Cơm và trứng", ["Bánh pizza", "Chỉ trà", "Chỉ nước"]),
    row("Chào bố mẹ trước khi đi", "Bye, I am leaving.", "Con đi đây.", "Bye, I am leaving now.", "Have a good day.", "Bye.", "Beego says bye to his parents before he leaves.", "Beego nói gì trước khi rời nhà?", "Tạm biệt", ["Chúc ngủ ngon", "Xin hóa đơn", "Tôi phản đối"]),
    row("Đến lớp sớm", "I arrive early.", "Tôi đến sớm.", "I arrive at school early.", "The classroom is quiet.", "I arrive early.", "Beego arrives early and the classroom is still quiet.", "Lớp học thế nào khi Beego đến?", "Còn yên tĩnh", ["Đông khách", "Đang tranh luận", "Đang lên máy bay"]),
    row("Bắt đầu ngày mới", "My day starts now.", "Ngày mới của tôi bắt đầu.", "My morning routine is done.", "Now I start the day.", "My day starts now.", "After the routine, Beego starts his school day.", "Beego bắt đầu ngày khi nào?", "Sau thói quen buổi sáng", ["Sau buổi thuyết trình", "Sau giờ lên máy bay", "Sau khi trả áo"]),
  ],
  3: [
    row("Hỏi giá một món", "How much is this?", "Cái này bao nhiêu tiền?", "How much is this shirt?", "It is ten dollars.", "How much is this?", "Beego holds a shirt and asks the price.", "Beego đang hỏi gì?", "Giá cái áo", ["Tên người bán", "Đường đến ga", "Giờ họp"]),
    row("Mua táo", "I would like apples.", "Tôi muốn mua táo.", "I would like four apples.", "The apples are fresh.", "I would like apples.", "Beego buys four fresh apples at the market.", "Beego mua gì?", "Bốn quả táo", ["Áo xanh", "Vé tàu", "Cà phê"]),
    row("Trả tiền mặt", "I will pay cash.", "Tôi trả tiền mặt.", "I will pay in cash.", "Here is the money.", "I will pay cash.", "Beego pays with cash, not by card.", "Beego trả bằng gì?", "Tiền mặt", ["Thẻ", "Chuyển khoản", "Vé"]),
    row("Xin túi", "A bag, please.", "Cho tôi một túi.", "A bag, please.", "Here is a paper bag.", "A bag, please.", "The apples need a bag, so Beego asks for one.", "Beego cần túi để làm gì?", "Đựng táo", ["Đựng hộ chiếu", "Đựng slide", "Đựng biên bản"]),
    row("Hỏi cỡ áo", "Do you have a larger size?", "Bạn có cỡ lớn hơn không?", "This shirt is small.", "Here is a larger size.", "Do you have a larger size?", "The blue shirt is small, so Beego asks for a larger size.", "Vì sao Beego hỏi cỡ khác?", "Áo đang nhỏ", ["Áo đang đắt", "Áo đang rách", "Áo đang bẩn"]),
    row("Đổi một món hàng", "I want to return this.", "Tôi muốn trả món này.", "I want to return this cup.", "Do you have the receipt?", "I want to return this.", "Beego returns a cup and the seller asks for the receipt.", "Người bán hỏi gì?", "Hóa đơn", ["Hộ chiếu", "Email", "Tên"]),
    row("So sánh hai giá", "This one is cheaper.", "Cái này rẻ hơn.", "The red bag is cheaper.", "The blue bag costs more.", "This one is cheaper.", "Beego compares two bags and chooses the cheaper red one.", "Beego chọn túi nào?", "Túi đỏ rẻ hơn", ["Túi xanh đắt hơn", "Cả hai cùng giá", "Không mua"]),
    row("Mua quà", "This gift is for Mai.", "Món quà này dành cho Mai.", "I am buying a gift.", "Mai likes this book.", "This gift is for Mai.", "Beego buys a book as a gift for Mai.", "Quà là gì?", "Một quyển sách", ["Một cái áo", "Một vé bay", "Một slide"]),
    row("Hỏi còn hàng", "Do you have this in blue?", "Bạn còn màu xanh không?", "Do you have this in blue?", "Yes, here is the blue one.", "Do you have this in blue?", "Beego wants the blue item, and the shop still has it.", "Cửa hàng còn màu gì?", "Xanh", ["Chỉ đỏ", "Hết hàng", "Chỉ đen"]),
    row("Xin hóa đơn", "May I have the receipt?", "Cho tôi xin hóa đơn.", "May I have the receipt?", "Here is your receipt.", "May I have the receipt?", "After paying, Beego asks for the receipt.", "Beego xin hóa đơn khi nào?", "Sau khi trả tiền", ["Trước khi vào cửa hàng", "Khi đang hỏi đường", "Khi đang họp"]),
    row("Mua nước uống", "I would like water.", "Tôi muốn mua nước.", "I would like a bottle of water.", "The water is two dollars.", "I would like water.", "At the shop counter Beego buys one bottle of water.", "Chai nước giá bao nhiêu?", "Hai đô", ["Mười đô", "Năm đô", "Một đô"]),
    row("Không mua món đắt", "That is too expensive.", "Cái đó đắt quá.", "That watch is too expensive.", "I will not buy it.", "That is too expensive.", "Beego sees a watch, says it is too expensive, and does not buy it.", "Beego có mua đồng hồ không?", "Không", ["Có", "Mua hai cái", "Đặt trước"]),
    row("Nhờ gói quà", "Could you wrap it?", "Bạn gói quà giúp tôi được không?", "Could you wrap this book?", "Yes, I can wrap it.", "Could you wrap it?", "Beego asks the seller to wrap the book.", "Người bán làm gì?", "Gói sách", ["Đổi sách", "Gửi email", "Chỉ đường"]),
    row("Rời cửa hàng", "Thank you, goodbye.", "Cảm ơn, tạm biệt.", "Thank you, goodbye.", "Please come again.", "Thank you.", "Beego thanks the seller and leaves the shop.", "Beego làm gì cuối cùng?", "Cảm ơn rồi rời cửa hàng", ["Ở lại cả ngày", "Đổi toàn bộ hàng", "Gọi taxi"]),
  ],
  4: [
    row("Giới thiệu mẹ", "This is my mother.", "Đây là mẹ tôi.", "This is my mother.", "She is kind.", "This is my mother.", "Beego shows a photo and says this is his mother.", "Người trong ảnh là ai?", "Mẹ của Beego", ["Bố", "Anh trai", "Bạn cùng lớp"]),
    row("Kể về bố", "My father is at work.", "Bố tôi đang đi làm.", "My father is at work.", "He comes home at six.", "My father is at work.", "Beego's father is at work and comes home at six.", "Bố về nhà lúc mấy giờ?", "Sáu giờ", ["Sáng sớm", "Trưa", "Nửa đêm"]),
    row("Nói về anh trai", "My brother is tall.", "Anh trai tôi cao.", "My brother is tall.", "He plays football.", "My brother is tall.", "Beego's brother is tall and plays football.", "Anh trai thích gì?", "Bóng đá", ["Nấu ăn", "Vẽ", "Bơi"]),
    row("Nói về em gái", "My sister is young.", "Em gái tôi còn nhỏ.", "My sister is young.", "She likes stories.", "My sister is young.", "Beego's young sister likes bedtime stories.", "Em gái thích gì?", "Truyện", ["Họp", "Mua đồng hồ", "Bay"]),
    row("Nhà có mấy người", "There are four people.", "Nhà có bốn người.", "There are four people in my family.", "We live together.", "There are four people.", "Beego's home has four people living together.", "Nhà Beego có mấy người?", "Bốn", ["Hai", "Sáu", "Một"]),
    row("Ông bà", "My grandmother cooks.", "Bà tôi nấu ăn.", "My grandmother cooks lunch.", "The soup is hot.", "My grandmother cooks.", "Grandmother cooks hot soup for lunch.", "Bà nấu món gì?", "Canh nóng", ["Bánh pizza", "Chỉ salad", "Chỉ trà"]),
    row("Ảnh gia đình", "This photo shows my family.", "Ảnh này là gia đình tôi.", "This photo shows my family.", "We are in the garden.", "This is my family.", "The family photo was taken in the garden.", "Ảnh chụp ở đâu?", "Trong vườn", ["Ở sân bay", "Ở cửa hàng", "Ở văn phòng"]),
    row("Cuối tuần với gia đình", "We stay home on Sunday.", "Chủ nhật chúng tôi ở nhà.", "We stay home on Sunday.", "We cook and talk.", "We stay home.", "On Sunday the family stays home, cooks, and talks.", "Chủ nhật họ làm gì?", "Ở nhà, nấu ăn và nói chuyện", ["Đi công tác", "Đi mua sắm cả ngày", "Đi thuyết trình"]),
    row("Giúp việc nhà", "I help my mother.", "Tôi giúp mẹ.", "I help my mother wash the dishes.", "The dishes are clean.", "I help my mother.", "After dinner Beego helps his mother wash the dishes.", "Beego giúp việc gì?", "Rửa bát", ["Gửi email", "Đóng gói hàng", "Soạn slide"]),
    row("Phòng của Beego", "This is my room.", "Đây là phòng của tôi.", "This is my room.", "My bed is near the window.", "This is my room.", "Beego's bed is near the window in his room.", "Giường ở đâu?", "Gần cửa sổ", ["Trong bếp", "Ngoài vườn", "Ở gara"]),
    row("Bữa tối gia đình", "We have dinner together.", "Chúng tôi ăn tối cùng nhau.", "We have dinner at seven.", "Father tells a story.", "We have dinner together.", "At seven the family has dinner and father tells a story.", "Ai kể chuyện lúc ăn tối?", "Bố", ["Em gái", "Khách", "Giáo viên"]),
    row("Nhà của dì", "We visit my aunt.", "Chúng tôi thăm dì.", "We visit my aunt on Saturday.", "Her house is quiet.", "We visit my aunt.", "On Saturday the family visits the aunt's quiet house.", "Họ thăm ai?", "Dì", ["Ông nội", "Bạn cùng lớp", "Sếp"]),
    row("Nuôi một con mèo", "We have a cat.", "Nhà tôi có một con mèo.", "Our cat is small.", "The cat sleeps on the sofa.", "We have a cat.", "The small cat sleeps on the family sofa.", "Con mèo ngủ ở đâu?", "Trên ghế sofa", ["Trong cặp", "Trên bàn họp", "Trong vali"]),
    row("Yêu gia đình", "I love my family.", "Tôi yêu gia đình tôi.", "I love my family.", "They love me too.", "I love my family.", "Beego says he loves his family, and they love him too.", "Gia đình đáp lại thế nào?", "Họ cũng yêu Beego", ["Họ đi xa", "Họ im lặng", "Họ chuyển nhà"]),
  ],
  5: [
    row("Nói về nghề của mình", "I am a teacher.", "Tôi là giáo viên.", "I am a teacher.", "I work at a school.", "I am a teacher.", "Beego tells the class that he is a teacher at a school.", "Beego làm nghề gì?", "Giáo viên", ["Phi công", "Đầu bếp", "Tài xế"]),
    row("Nơi làm việc", "I work in an office.", "Tôi làm việc trong văn phòng.", "I work in a small office.", "My desk is near the door.", "I work in an office.", "Mai works in a small office and her desk is near the door.", "Bàn của Mai ở đâu?", "Gần cửa", ["Gần sân bay", "Trong bếp", "Ngoài vườn"]),
    row("Đồng nghiệp", "I work with a team.", "Tôi làm việc với một nhóm.", "I work with a small team.", "We share one plan.", "I work with a team.", "Beego's team shares one plan for the week.", "Nhóm dùng chung gì?", "Một kế hoạch", ["Một hóa đơn", "Một vé", "Một công thức"]),
    row("Giờ làm", "I start work at eight.", "Tôi bắt đầu làm lúc tám giờ.", "I start work at eight.", "I finish at five.", "I start work at eight.", "Beego starts at eight and finishes at five.", "Beego tan làm lúc mấy giờ?", "Năm giờ", ["Tám giờ", "Trưa", "Sáng"]),
    row("Việc trong ngày", "I answer emails.", "Tôi trả lời email.", "I answer emails in the morning.", "Then I meet my team.", "I answer emails.", "In the morning Beego answers emails, then he meets his team.", "Buổi sáng Beego làm gì trước?", "Trả lời email", ["Thuyết trình", "Đi chợ", "Đón khách"]),
    row("Nghề của bạn", "What do you do?", "Bạn làm nghề gì?", "What do you do?", "I am a nurse.", "What do you do?", "Lan asks a new colleague what they do. The colleague is a nurse.", "Người đồng nghiệp là ai?", "Y tá", ["Phi công", "Đầu bếp", "Hướng dẫn viên"]),
    row("Máy tính ở bàn", "I use a computer.", "Tôi dùng máy tính.", "I use a computer at work.", "The screen is bright.", "I use a computer.", "Beego uses a computer with a bright screen.", "Màn hình thế nào?", "Sáng", ["Tắt", "Vỡ", "Nhỏ xíu"]),
    row("Cuộc gọi công việc", "I call a client.", "Tôi gọi cho khách.", "I call a client at ten.", "The call is short.", "I call a client.", "At ten Beego makes a short call to a client.", "Cuộc gọi dài hay ngắn?", "Ngắn", ["Rất dài", "Bị hủy", "Không ai nghe"]),
    row("Việc nhà và việc làm", "I work from home today.", "Hôm nay tôi làm ở nhà.", "I work from home today.", "My computer is on the table.", "I work from home.", "Today Beego works from home with the computer on the table.", "Máy tính để ở đâu?", "Trên bàn", ["Ở văn phòng", "Ở trường", "Ở quán"]),
    row("Nghỉ trưa", "We have a lunch break.", "Chúng tôi nghỉ trưa.", "We have a lunch break at noon.", "The break is one hour.", "We have a lunch break.", "The office lunch break is one hour at noon.", "Nghỉ trưa bao lâu?", "Một giờ", ["Mười phút", "Cả buổi chiều", "Không nghỉ"]),
    row("Sếp giao việc", "My manager gives me a task.", "Sếp giao cho tôi một việc.", "Please finish this task today.", "I will finish it today.", "I will finish it.", "The manager gives Beego a task and he will finish it today.", "Beego hẹn xong việc khi nào?", "Hôm nay", ["Tuần sau", "Tháng sau", "Không làm"]),
    row("Làm việc nhóm", "We finish the plan together.", "Chúng tôi cùng hoàn thành kế hoạch.", "We finish the plan together.", "Everyone has one part.", "We finish the plan.", "Each person has one part, and the team finishes the plan together.", "Mỗi người có gì?", "Một phần việc", ["Cùng một phần", "Không có việc", "Chỉ sếp làm"]),
    row("Ngày đầu đi làm", "It is my first day.", "Đây là ngày đầu tiên tôi đi làm.", "It is my first day at work.", "The team welcomes me.", "It is my first day.", "On the first day the team welcomes the new worker.", "Nhóm làm gì với người mới?", "Chào đón", ["Bỏ về", "Im lặng", "Đổi ca"]),
    row("Nói về công việc mình thích", "I like my job.", "Tôi thích công việc của mình.", "I like my job.", "The work is busy but useful.", "I like my job.", "Beego likes his job even though the work is busy.", "Công việc của Beego thế nào?", "Bận nhưng hữu ích", ["Nhàm chán", "Quá rảnh", "Không có việc"]),
  ],
  6: [
    row("Hỏi cổng lên máy bay", "Where is gate 4?", "Cổng số 4 ở đâu?", "Where is gate 4?", "Gate 4 is on the left.", "Where is gate 4?", "At the airport Beego asks where gate 4 is.", "Cổng 4 ở hướng nào?", "Bên trái", ["Bên phải", "Tầng hầm", "Ngoài đường"]),
    row("Làm thủ tục", "I have my passport.", "Tôi có hộ chiếu.", "Here is my passport.", "Please wait a moment.", "Here is my passport.", "Beego shows his passport at the check-in desk.", "Beego đưa gì ở quầy?", "Hộ chiếu", ["Vé tàu", "Hóa đơn", "Thẻ học"]),
    row("Hỏi giờ bay", "What time is the flight?", "Chuyến bay mấy giờ?", "The flight is at nine.", "Please go to the gate.", "The flight is at nine.", "The flight leaves at nine, so Beego goes to the gate.", "Máy bay cất cánh lúc mấy giờ?", "Chín giờ", ["Sáu giờ", "Trưa", "Tối"]),
    row("Tìm khách sạn", "I have a reservation.", "Tôi có đặt phòng.", "I have a reservation for tonight.", "Your room is ready.", "I have a reservation.", "Beego arrives at the hotel and his room is ready.", "Phòng đã sẵn sàng chưa?", "Rồi", ["Chưa", "Hết phòng", "Đang sửa"]),
    row("Hỏi tầng", "The room is on the second floor.", "Phòng ở tầng hai.", "Which floor is my room?", "It is on the second floor.", "Which floor is my room?", "The receptionist says the room is on the second floor.", "Phòng ở tầng mấy?", "Tầng hai", ["Tầng một", "Tầng năm", "Tầng trệt"]),
    row("Gọi taxi đến khách sạn", "I need a taxi to the hotel.", "Tôi cần taxi đến khách sạn.", "I need a taxi to the hotel.", "The taxi is outside.", "I need a taxi.", "Beego needs a taxi, and it is waiting outside.", "Taxi đang ở đâu?", "Bên ngoài", ["Trên tầng hai", "Ở cổng bay", "Trong phòng"]),
    row("Hỏi ăn sáng khách sạn", "Is breakfast included?", "Bữa sáng đã gồm trong giá chưa?", "Is breakfast included?", "Yes, it starts at seven.", "Is breakfast included?", "Breakfast at the hotel is included and starts at seven.", "Ăn sáng bắt đầu lúc mấy giờ?", "Bảy giờ", ["Năm giờ", "Trưa", "Tối"]),
    row("Xin bản đồ", "Could I have a map?", "Cho tôi xin bản đồ được không?", "Could I have a map of the area?", "The station is on the map.", "Could I have a map?", "Beego asks for a map because he wants the station.", "Beego cần bản đồ để tìm gì?", "Nhà ga", ["Bãi biển", "Bệnh viện", "Trường học"]),
    row("Hành lý", "This is my suitcase.", "Đây là vali của tôi.", "This suitcase is mine.", "Please put it here.", "This is my suitcase.", "Beego puts his own suitcase by the desk.", "Vali của ai?", "Của Beego", ["Của Mai", "Của khách khác", "Của tài xế"]),
    row("Chìa khóa phòng", "Here is the room key.", "Đây là chìa khóa phòng.", "May I have the room key?", "Here is your key.", "May I have the key?", "The receptionist gives Beego the room key.", "Beego nhận được gì?", "Chìa khóa phòng", ["Vé mới", "Hộ chiếu mới", "Bản đồ"]),
    row("Hỏi wifi", "What is the wifi password?", "Mật khẩu wifi là gì?", "What is the wifi password?", "It is on this card.", "What is the wifi password?", "The wifi password is printed on a card.", "Mật khẩu ở đâu?", "Trên thẻ", ["Trong email công ty", "Ở cổng bay", "Trong vali"]),
    row("Trả phòng", "I would like to check out.", "Tôi muốn trả phòng.", "I would like to check out.", "Here is your bill.", "I would like to check out.", "Beego checks out and receives the hotel bill.", "Khách sạn đưa gì khi trả phòng?", "Hóa đơn", ["Chìa khóa mới", "Vé bay", "Bản đồ"]),
    row("Đến muộn", "My flight is late.", "Chuyến bay của tôi bị trễ.", "My flight is late.", "I will arrive at night.", "My flight is late.", "The late flight means Beego arrives at the hotel at night.", "Beego đến khách sạn khi nào?", "Buổi tối", ["Buổi sáng", "Buổi trưa", "Hôm qua"]),
    row("Hỏi đường ra phố", "How do I get to the city?", "Tôi ra trung tâm bằng cách nào?", "How do I get to the city center?", "Take bus number 5.", "How do I get to the city?", "From the hotel, bus number 5 goes to the city center.", "Xe nào vào trung tâm?", "Xe buýt số 5", ["Xe số 2", "Đi bộ một giờ", "Không có xe"]),
  ],
  7: [
    row("Gửi một email", "Please reply to this email.", "Vui lòng trả lời email này.", "Please reply today.", "I will reply this afternoon.", "Please reply today.", "An asks Beego to reply to one email today.", "Beego cần trả lời khi nào?", "Hôm nay", ["Tuần sau", "Tháng sau", "Không cần"]),
    row("Đính kèm tệp", "I attached the file.", "Tôi đã đính kèm tệp.", "The file is attached.", "Please check the file.", "The file is attached.", "Beego attaches the file and asks An to check it.", "An cần làm gì?", "Kiểm tra tệp", ["Xóa tệp", "In vé", "Gọi taxi"]),
    row("Hoãn cuộc họp", "Can we postpone the meeting?", "Chúng ta hoãn cuộc họp được không?", "Can we meet tomorrow instead?", "Yes, tomorrow at ten.", "Can we postpone the meeting?", "The team postpones the meeting to tomorrow at ten.", "Họp lúc mấy giờ ngày mai?", "Mười giờ", ["Tám giờ", "Trưa", "Tối"]),
    row("Xác nhận lịch", "I confirm the schedule.", "Tôi xác nhận lịch.", "The meeting is at three.", "I confirm three o'clock.", "I confirm the schedule.", "Beego confirms the meeting time at three.", "Cuộc họp lúc mấy giờ?", "Ba giờ", ["Một giờ", "Năm giờ", "Chín giờ"]),
    row("Xin phản hồi", "Please send feedback.", "Vui lòng gửi phản hồi.", "Please send feedback today.", "I will send it before noon.", "Please send feedback.", "An needs feedback before noon, and Beego will send it.", "Phản hồi cần đến trước khi nào?", "Trưa", ["Tối", "Sáng mai", "Cuối tuần"]),
    row("Chuyển tiếp thư", "I will forward the email.", "Tôi sẽ chuyển tiếp email.", "I will forward it to the team.", "The team needs the update.", "I will forward the email.", "Beego forwards the update so the whole team can read it.", "Ai cần bản cập nhật?", "Cả nhóm", ["Chỉ một khách", "Chỉ lễ tân", "Chỉ người bán"]),
    row("Viết tiêu đề", "The subject is urgent.", "Tiêu đề là khẩn.", "Please mark the subject as urgent.", "The client needs it today.", "The subject is urgent.", "The email subject says urgent because the client needs it today.", "Vì sao thư khẩn?", "Khách cần trong hôm nay", ["Vì thư cũ", "Vì hết việc", "Vì họp đã xong"]),
    row("Soạn bản nháp", "I saved a draft.", "Tôi đã lưu bản nháp.", "The draft is not sent yet.", "I will check it first.", "I saved a draft.", "Beego saves a draft and checks it before sending.", "Thư đã được gửi chưa?", "Chưa, mới là bản nháp", ["Rồi", "Bị trả lại", "Bị xóa"]),
    row("Ghi biên bản", "I will write the minutes.", "Tôi sẽ viết biên bản.", "The minutes are ready.", "I sent the minutes.", "I will write the minutes.", "After the meeting Beego writes the minutes and sends them.", "Beego gửi gì sau cuộc họp?", "Biên bản", ["Hóa đơn", "Vé", "Ảnh gia đình"]),
    row("Việc cần làm", "This is an action item.", "Đây là một việc cần làm.", "Please finish this action item.", "I will do it today.", "This is an action item.", "The action item is Beego's task for today.", "Việc này của ai?", "Của Beego", ["Của khách", "Của lễ tân", "Của người bán"]),
    row("Họp online", "The call is on the computer.", "Cuộc họp diễn ra trên máy tính.", "Please join on your computer.", "I am joining now.", "Please join the call.", "The team joins the meeting on their computers.", "Họ họp bằng gì?", "Máy tính", ["Điện thoại bàn khách sạn", "Giấy", "Loa phòng"]),
    row("Nhắc giờ", "The meeting starts in ten minutes.", "Cuộc họp bắt đầu sau mười phút.", "Please be on time.", "I will be there.", "The meeting starts soon.", "Beego reminds the team that the meeting starts in ten minutes.", "Còn bao lâu nữa thì họp?", "Mười phút", ["Một giờ", "Cả buổi", "Ngày mai"]),
    row("Xin lỗi vì trả lời muộn", "Sorry for the late reply.", "Xin lỗi vì trả lời muộn.", "Sorry for the late reply.", "I was in another meeting.", "Sorry for the late reply.", "Beego apologizes because he was in another meeting.", "Vì sao Beego trả lời muộn?", "Đang họp khác", ["Quên địa chỉ", "Hết pin điện thoại", "Đang đi chợ"]),
    row("Tóm tắt cho sếp", "Here is a short summary.", "Đây là bản tóm tắt ngắn.", "The summary has three points.", "The manager will read it.", "Here is the summary.", "Beego sends a three-point summary for the manager to read.", "Bản tóm tắt có mấy ý?", "Ba ý", ["Một ý", "Mười ý", "Không có ý"]),
  ],
  8: [
    row("Nêu ý kiến", "In my opinion, the plan is clear.", "Theo tôi, kế hoạch này rõ.", "In my opinion, the plan is clear.", "I agree with the plan.", "The plan is clear.", "Beego gives his opinion: the plan is clear.", "Beego nghĩ gì về kế hoạch?", "Kế hoạch rõ", ["Kế hoạch sai", "Kế hoạch quá dài", "Chưa có kế hoạch"]),
    row("Đồng ý có lý do", "I agree because the evidence is strong.", "Tôi đồng ý vì bằng chứng vững.", "The evidence is strong.", "I agree with you.", "I agree.", "Mai agrees because the evidence is strong.", "Vì sao Mai đồng ý?", "Bằng chứng vững", ["Vì bạn bè", "Vì hết giờ", "Vì không nghe"]),
    row("Không đồng ý lịch sự", "I disagree because the cost is high.", "Tôi không đồng ý vì chi phí cao.", "The cost is high.", "I disagree with that point.", "The cost is high.", "Beego disagrees with one point because the cost is high.", "Beego phản đối điều gì?", "Chi phí cao", ["Bằng chứng yếu", "Giọng nói nhỏ", "Slide xấu"]),
    row("Đưa ví dụ", "Let me give an example.", "Để tôi đưa một ví dụ.", "For example, the class liked the talk.", "The example is clear.", "Let me give an example.", "Beego gives an example from the class that liked the talk.", "Ví dụ lấy từ đâu?", "Lớp đã thích bài nói", ["Từ một hóa đơn", "Từ một vé bay", "Từ một bức ảnh gia đình"]),
    row("Nhượng bộ rồi phản biện", "Although the idea is good, the time is short.", "Dù ý tưởng hay, thời gian lại ít.", "The time is short.", "We need more time.", "The time is short.", "The idea is good, but the team does not have enough time.", "Nhóm thiếu gì?", "Thời gian", ["Bằng chứng", "Ảnh", "Sách"]),
    row("Kết luận", "Therefore, we should wait.", "Do đó, chúng ta nên chờ.", "Therefore, we should wait.", "We can decide tomorrow.", "We should wait.", "Because the time is short, Beego concludes that they should wait.", "Kết luận là gì?", "Nên chờ", ["Nên ký ngay", "Nên hủy cả đề tài", "Nên im lặng"]),
    row("Mời khán giả", "What do you think?", "Bạn nghĩ sao?", "What does the class think?", "The students have questions.", "What do you think?", "After the talk, Beego asks the class what they think.", "Ai có câu hỏi?", "Các học viên", ["Chỉ giáo viên", "Chỉ khách mời", "Không ai"]),
    row("Dùng ảnh minh họa", "This photo supports my point.", "Ảnh này củng cố ý của tôi.", "This photo shows the result.", "The result is easy to see.", "This photo supports my point.", "Beego shows a photo so the result is easy to see.", "Ảnh dùng để làm gì?", "Cho thấy kết quả", ["Thay cả bài nói", "Che slide", "Ghi âm"]),
    row("Nghe một ý trái", "However, the other group disagrees.", "Tuy nhiên, nhóm kia không đồng ý.", "The other group disagrees.", "They want a different plan.", "They disagree.", "One group wants a different plan and disagrees.", "Nhóm kia muốn gì?", "Một kế hoạch khác", ["Cùng kế hoạch", "Hủy buổi nói", "Im lặng"]),
    row("Nói rõ ý chính", "My main point is simple.", "Ý chính của tôi rất đơn giản.", "My main point is simple.", "Please remember this point.", "My main point is simple.", "Beego asks the audience to remember one simple point.", "Beego muốn người nghe nhớ gì?", "Một ý đơn giản", ["Mọi chi tiết", "Cả cuốn sách", "Mật khẩu"]),
    row("Giọng nói", "Please speak in a clear voice.", "Hãy nói bằng giọng rõ.", "Please speak in a clear voice.", "The people at the back can hear.", "Speak in a clear voice.", "A clear voice helps the people at the back hear the talk.", "Vì sao cần giọng rõ?", "Người ngồi sau nghe được", ["Để nói nhanh hơn", "Để tranh luận to hơn", "Để tắt micro"]),
    row("Trả lời câu hỏi", "That is a good question.", "Đó là một câu hỏi hay.", "Let me answer your question.", "The answer is in the book.", "That is a good question.", "A student asks a question, and the answer is in the book.", "Câu trả lời nằm ở đâu?", "Trong sách", ["Trong email", "Trên vé", "Trong hóa đơn"]),
    row("Tóm lại bài nói", "In conclusion, the plan can work.", "Tóm lại, kế hoạch này làm được.", "In conclusion, the plan can work.", "We should try it.", "The plan can work.", "Beego ends the talk by saying the plan can work.", "Beego kết thúc bằng điều gì?", "Kế hoạch làm được", ["Kế hoạch thất bại", "Chưa có kết luận", "Cần hủy"]),
    row("Cảm ơn người nghe", "Thank you for listening.", "Cảm ơn mọi người đã lắng nghe.", "Thank you for listening.", "Are there any questions?", "Thank you for listening.", "Beego thanks the listeners and asks if there are questions.", "Beego hỏi gì sau lời cảm ơn?", "Còn câu hỏi không", ["Còn vé không", "Còn hàng không", "Còn phòng không"]),
  ],
};

function fillPart(part, rows) {
  if (rows.length !== 14) throw new Error(`part ${part} has ${rows.length} node rows`);
  return rows;
}

for (const [part, rows] of Object.entries(PARTS)) fillPart(part, rows);

export function integratedNodeContent(partNumber, nodeIndex) {
  const rows = PARTS[Number(partNumber)];
  if (!rows) return null;
  const index = Math.min(14, Math.max(1, Number(nodeIndex) || 1)) - 1;
  return rows[index] || null;
}

export function integratedNodeGoal(partNumber, nodeIndex) {
  return integratedNodeContent(partNumber, nodeIndex).goal;
}
