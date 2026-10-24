/**
 * Mục tiêu cửa p1-g1. Không áp vào 7 cửa còn lại.
 * Hoàn thành bài và kết quả luyện tập trong phiên là hai việc khác nhau.
 * Đọc thành tiếng là luyện tập, không phải điểm phát âm.
 */

export const P1_CONTENT_REVISION = "p1g1-r4";

export const PICTURES = [
  { en: "name", vi: "tên" },
  { en: "morning", vi: "buổi sáng" },
  { en: "afternoon", vi: "buổi chiều" },
  { en: "night", vi: "buổi tối" },
  { en: "thanks", vi: "cảm ơn" },
  { en: "vietnam", vi: "việt nam" },
  { en: "friend", vi: "bạn bè" },
  { en: "welcome", vi: "chào mừng" },
];

function phrase(en, vi) {
  return { en, vi, words: en.replace(/[.!?,]+$/g, "").split(" ").filter(Boolean) };
}

function lesson(spec) {
  const vocab = [];
  const seen = new Set();
  for (const item of [...(spec.extraVocab || []), ...PICTURES]) {
    const key = item.en.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    vocab.push(item);
  }
  return { ...spec, vocab, phrases: spec.phrases.map((item) => phrase(item.en, item.vi)) };
}

const LESSONS = [
  // n01: Học có hỗ trợ — Chào hỏi ban đầu và xưng tên mình (Cho phép thử tên thật)
  lesson({
    role: "introduce",
    goal: "Chào hỏi ban đầu và xưng tên mình",
    newItems: ["Hello", "Hi", "I am", "name"],
    reviewItems: [],
    pictureWord: "name",
    extraVocab: [{ en: "hello", vi: "xin chào" }, { en: "hi", vi: "chào" }],
    allowRealName: true,
    phrases: [
      { en: "Hello. I am Nam.", vi: "Xin chào, tôi là Nam." },
      { en: "Hi. I am Mai.", vi: "Chào bạn, tôi là Mai." },
      { en: "Hello. I am Beego.", vi: "Xin chào, tôi là Beego." },
    ],
    listen: "Hello. I am Nam.",
    dictation: "Hello. I am Beego.",
    speak: "Hello. I am Nam.",
    speakTarget: "Hello. I am [name].",
    story: {
      text: "Hello Mai. I am Nam.",
      q: "Nam chào Mai bằng câu nào?",
      a: "Hello Mai. I am Nam.",
      wrong: ["Good morning", "Thank you", "Good night"],
    },
    cloze: ["When meeting someone, say hello.", "Hello", ["Goodbye", "Sorry", "Thanks"], "Khi mới gặp, lời chào thân thiện là Hello."],
    dialogue: ["You meet someone for the first time. What do you say?", "Hello. I am Nam.", ["Good night.", "Thank you very much.", "Excuse me."], "Hello. Nice to meet you.", "Lần đầu gặp thì chào và nói tên mình."],
    returnsIn: "name được hỏi lại ở n02; Hello và I am được dùng khi chào rồi hỏi tên.",
  }),

  // n02: Học có hỗ trợ — Hỏi tên người đối diện và nói tên trang trọng
  lesson({
    role: "introduce",
    goal: "Hỏi tên người đối diện và nói tên trang trọng",
    newItems: ["What is your name?", "My name is"],
    reviewItems: ["Hello", "I am", "name"],
    pictureWord: "name",
    extraVocab: [{ en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "What is your name?", vi: "Bạn tên gì?" },
      { en: "My name is Nam.", vi: "Tên tôi là Nam." },
      { en: "Hello. What is your name?", vi: "Xin chào. Bạn tên gì?" },
    ],
    listen: "Hello. What is your name?",
    dictation: "What is your name? My name is Nam.",
    speak: "What is your name? My name is Nam.",
    story: {
      text: "Hello Lan. What is your name? My name is Nam.",
      q: "Nam nói tên mình thế nào?",
      a: "My name is Nam",
      wrong: ["I am fine", "Good night", "Thank you"],
    },
    cloze: ["Lan asks, and Nam tells his name.", "name", ["morning", "night", "thanks"], "Câu đang hỏi tên, nên từ cần điền là name."],
    dialogue: ["Hello! What is your name?", "My name is Nam.", ["I am fine.", "Good night.", "Thank you."], "Nice to meet you, Nam.", "Sau câu hỏi xin tên thì đáp bằng tên của mình."],
    returnsIn: "My name is trở lại ở n06 khi ôn tập và n09 khi giới thiệu bạn.",
  }),

  // n03: Học có hỗ trợ — Chào theo thời điểm (Sáng / Chiều)
  lesson({
    role: "introduce",
    goal: "Chào theo thời điểm (Sáng / Chiều)",
    newItems: ["Good morning", "Good afternoon", "day"],
    reviewItems: ["Hello", "Hi", "My name is"],
    pictureWord: "morning",
    extraVocab: [
      { en: "morning", vi: "buổi sáng" },
      { en: "afternoon", vi: "buổi chiều" },
    ],
    phrases: [
      { en: "Good morning.", vi: "Chào buổi sáng." },
      { en: "Good afternoon.", vi: "Chào buổi chiều." },
      { en: "Good morning. My name is Nam.", vi: "Chào buổi sáng. Tên tôi là Nam." },
    ],
    listen: "Good morning. Good afternoon.",
    dictation: "Good morning. My name is Nam.",
    speak: "Good morning. Good afternoon.",
    story: {
      text: "Good morning Mai. I am fine.",
      q: "Nam chào lúc nào?",
      a: "Buổi sáng",
      wrong: ["Buổi tối", "Lúc tạm biệt", "Lúc cảm ơn"],
    },
    cloze: ["In the morning, people say good morning.", "morning", ["night", "name", "thanks"], "Buổi sáng đi với morning."],
    dialogue: ["It is 2 PM and you meet your colleague.", "Good afternoon.", ["Good morning.", "Good night.", "Excuse me."], "Good afternoon!", "Sau 12 giờ trưa chào Good afternoon."],
    returnsIn: "Good morning và Good afternoon được kiểm tra ở bài n08.",
  }),

  // n04: Học có hỗ trợ — Hỏi thăm sức khỏe và phản hồi
  lesson({
    role: "introduce",
    goal: "Hỏi thăm sức khỏe và phản hồi",
    newItems: ["How are you?", "I am fine", "thank you", "good"],
    reviewItems: ["Good morning", "Hello", "I am"],
    pictureWord: "thanks",
    extraVocab: [{ en: "fine", vi: "khỏe" }, { en: "good", vi: "tốt" }],
    phrases: [
      { en: "How are you?", vi: "Bạn khỏe không?" },
      { en: "I am fine, thank you.", vi: "Tôi khỏe, cảm ơn bạn." },
      { en: "I am good, thank you.", vi: "Tôi khỏe, cảm ơn." },
    ],
    listen: "How are you? I am fine, thank you.",
    dictation: "How are you? I am fine.",
    speak: "How are you? I am fine, thank you.",
    story: {
      text: "Hello. How are you? I am fine.",
      q: "Nam trả lời sức khỏe thế nào?",
      a: "Anh ấy khỏe",
      wrong: ["Anh ấy tạm biệt", "Anh ấy cảm ơn", "Anh ấy chào buổi tối"],
    },
    cloze: ["Mai asks, and Nam says he is fine.", "fine", ["name", "morning", "night"], "Nam trả lời về sức khỏe: fine."],
    dialogue: ["Hello Nam. How are you?", "I am fine, thank you.", ["My name is Nam.", "Good night.", "Where are you from?"], "Good to hear that.", "Hỏi sức khỏe thì đáp I am fine, thank you."],
    returnsIn: "How are you và I am fine trở lại ở n06 và n08.",
  }),

  // n05: Học có hỗ trợ — Xuất thân & Quê quán (Mục tiêu chuẩn A0)
  lesson({
    role: "introduce",
    goal: "Nói và hỏi về quê quán / xuất thân",
    newItems: ["Where are you from?", "I am from", "Vietnam", "from"],
    reviewItems: ["What is your name?", "I am"],
    pictureWord: "vietnam",
    extraVocab: [{ en: "from", vi: "từ, đến từ" }, { en: "vietnam", vi: "việt nam" }],
    phrases: [
      { en: "Where are you from?", vi: "Bạn đến từ đâu?" },
      { en: "I am from Vietnam.", vi: "Tôi đến từ Việt Nam." },
      { en: "Hello. I am from Vietnam.", vi: "Xin chào. Tôi đến từ Việt Nam." },
    ],
    listen: "Where are you from? I am from Vietnam.",
    dictation: "Where are you from? I am from Vietnam.",
    speak: "Where are you from? I am from Vietnam.",
    story: {
      text: "Where are you from? I am from Vietnam.",
      q: "Người nói đến từ đâu?",
      a: "Việt Nam",
      wrong: ["Nước Anh", "Nước Mỹ", "Nhật Bản"],
    },
    cloze: ["I come from Vietnam. I am ___ Vietnam.", "from", ["name", "fine", "morning"], "Đi kèm với địa danh là from: I am from Vietnam."],
    dialogue: ["John asks: Where are you from?", "I am from Vietnam.", ["My name is Vietnam.", "I am fine, thank you.", "Good morning."], "Vietnam is beautiful!", "Hỏi quê quán Where are you from đáp I am from Vietnam."],
    returnsIn: "Where are you from và I am from Vietnam được truy hồi ở n06 và kiểm tra ở n08/n15.",
  }),

  // n06: Ôn truy hồi — Kích hoạt trí nhớ 5 bài đầu (newItems: [])
  lesson({
    role: "retrieval",
    goal: "Kích hoạt trí nhớ 5 bài đầu: Tên, Chào hỏi, Sức khỏe, Xuất xứ",
    newItems: [],
    reviewItems: ["Hello", "My name is", "How are you?", "I am from Vietnam", "Good morning"],
    pictureWord: "vietnam",
    extraVocab: [],
    phrases: [
      { en: "Hello. My name is Nam.", vi: "Xin chào. Tên tôi là Nam." },
      { en: "How are you? I am fine.", vi: "Bạn khỏe không? Tôi khỏe." },
      { en: "I am from Vietnam.", vi: "Tôi đến từ Việt Nam." },
    ],
    listen: "Hello. How are you? I am from Vietnam.",
    dictation: "Where are you from? I am from Vietnam.",
    speak: "Hello. I am from Vietnam.",
    story: {
      text: "Hello! My name is Nam. I am from Vietnam.",
      q: "Nam giới thiệu thông tin gì?",
      a: "Tên và quê quán",
      wrong: ["Hỏi giờ", "Chào tạm biệt", "Cảm ơn"],
    },
    cloze: ["To say your country, say: I am ___ Vietnam.", "from", ["is", "name", "am"], "Dùng from để nói xuất xứ."],
    dialogue: ["Where are you from?", "I am from Vietnam.", ["Good night.", "Thank you.", "Excuse me."], "Welcome!", "Đáp lại câu hỏi quê quán."],
    returnsIn: "Chuẩn bị kiến thức nền tảng trước bài kiểm tra giữa cửa n08.",
  }),

  // n07: Mở rộng — Lịch sự xã giao: Xin phép trước khi hỏi, Cảm ơn & Xin lỗi
  lesson({
    role: "expansion",
    goal: "Lịch sự xã giao: Xin phép trước khi hỏi, Cảm ơn & Xin lỗi",
    newItems: ["Excuse me", "please", "sorry", "welcome"],
    reviewItems: ["Thank you", "Where are you from?", "What is your name?"],
    pictureWord: "thanks",
    extraVocab: [{ en: "please", vi: "làm ơn, xin vui lòng" }, { en: "sorry", vi: "xin lỗi" }],
    phrases: [
      { en: "Excuse me, what is your name?", vi: "Xin lỗi, cho tôi hỏi bạn tên gì?" },
      { en: "You are welcome.", vi: "Không có gì (đáp lại lời cảm ơn)." },
      { en: "Excuse me, please.", vi: "Xin lỗi, làm ơn." },
    ],
    listen: "Excuse me, what is your name? Thank you. You are welcome.",
    dictation: "Excuse me. You are welcome.",
    speak: "Excuse me, what is your name?",
    story: {
      text: "Excuse me. What is your name? Thank you. You are welcome.",
      q: "Câu nào dùng để đáp lại lời cảm ơn?",
      a: "You are welcome",
      wrong: ["Excuse me", "Good night", "I am fine"],
    },
    cloze: ["When someone says thank you, you reply: You are ___.", "welcome", ["thanks", "sorry", "fine"], "Đáp lại cảm ơn bằng You are welcome."],
    dialogue: ["Lan says: Thank you for your help!", "You are welcome.", ["Good morning.", "My name is Nam.", "I am from Vietnam."], "Have a good day!", "Đáp lại lời cảm ơn lịch sự."],
    returnsIn: "Được tích hợp đầy đủ vào bài kiểm tra giữa cửa n08.",
  }),

  // n08: Kiểm tra giữa cửa — Đánh giá 7 bài nền tảng (n01–n07, strictly no premature items)
  lesson({
    role: "checkpoint",
    goal: "Kiểm tra giữa cửa 7 bài nền tảng (n01–n07)",
    newItems: [],
    reviewItems: ["Hello", "Name", "Morning", "Health", "Origin", "Polite"],
    pictureWord: "morning",
    phrases: [
      { en: "Good morning. How are you?", vi: "Chào buổi sáng. Bạn khỏe không?" },
      { en: "I am from Vietnam.", vi: "Tôi đến từ Việt Nam." },
      { en: "Excuse me, what is your name?", vi: "Xin lỗi, bạn tên gì?" },
    ],
    listen: "Good morning. How are you? I am fine, thank you.",
    dictation: "Where are you from? I am from Vietnam.",
    speak: "Good morning. I am from Vietnam.",
    story: {
      text: "Good morning. How are you? I am fine, thank you.",
      q: "Hai người chào nhau vào thời điểm nào?",
      a: "Buổi sáng",
      wrong: ["Buổi tối", "Lúc tạm biệt", "Lúc xin lỗi"],
    },
    cloze: ["Before asking a question politely, say: ___ me.", "Excuse", ["Thank", "Sorry", "Please"], "Dùng Excuse me để bắt chuyện lịch sự."],
    dialogue: ["Someone asks: Where are you from?", "I am from Vietnam.", ["Good afternoon.", "You are welcome.", "My name is Nam."], "Great!", "Trả lời đúng câu hỏi xuất xứ."],
    returnsIn: "Đánh giá đạt ≥ 75% để tiếp tục lộ trình.",
  }),

  // n09: Vận dụng — Giới thiệu người thứ ba (Bạn bè, đồng nghiệp)
  lesson({
    role: "application",
    goal: "Giới thiệu người thứ ba (Bạn bè, đồng nghiệp)",
    newItems: ["This is my friend", "friend", "He is", "She is"],
    reviewItems: ["My name is", "I am from", "Vietnam"],
    pictureWord: "friend",
    extraVocab: [{ en: "friend", vi: "bạn bè" }],
    phrases: [
      { en: "This is my friend, Nam.", vi: "Đây là bạn của tôi, Nam." },
      { en: "He is from Vietnam.", vi: "Anh ấy đến từ Việt Nam." },
      { en: "She is my friend.", vi: "Cô ấy là bạn của tôi." },
    ],
    listen: "This is my friend, Nam. He is from Vietnam.",
    dictation: "This is my friend, Nam.",
    speak: "This is my friend, Nam. He is from Vietnam.",
    story: {
      text: "This is my friend, Nam. He is from Vietnam.",
      q: "Câu nào dùng để giới thiệu bạn?",
      a: "This is my friend",
      wrong: ["My name is", "Where are you from", "How are you"],
    },
    cloze: ["To introduce a friend: This is my ___.", "friend", ["name", "morning", "night"], "Dùng friend để nói về bạn bè."],
    dialogue: ["Introduce your friend Mai to John.", "This is my friend, Mai.", ["What is your name?", "I am from Vietnam.", "Good night."], "Nice to meet you, Mai!", "Mẫu câu giới thiệu người thứ ba."],
    returnsIn: "Kết hợp với n10 để mở rộng hội thoại làm quen đa chiều.",
  }),

  // n10: Vận dụng — Chào đón người mới đến và thể hiện sự hiếu khách
  lesson({
    role: "application",
    goal: "Chào đón người mới đến và thể hiện sự hiếu khách",
    newItems: ["Welcome to", "meet", "Nice to meet you"],
    reviewItems: ["This is my friend", "Hello", "Vietnam"],
    pictureWord: "welcome",
    extraVocab: [{ en: "welcome", vi: "chào mừng" }, { en: "meet", vi: "gặp gỡ" }],
    phrases: [
      { en: "Welcome to Vietnam.", vi: "Chào mừng bạn đến Việt Nam." },
      { en: "Nice to meet you.", vi: "Rất vui được gặp bạn." },
      { en: "Nice to meet you too.", vi: "Tôi cũng rất vui được gặp bạn." },
    ],
    listen: "Welcome to Vietnam. Nice to meet you.",
    dictation: "Nice to meet you. Nice to meet you too.",
    speak: "Welcome to Vietnam! Nice to meet you.",
    story: {
      text: "Hello! Welcome to Vietnam. Nice to meet you.",
      q: "Lời đáp chuẩn cho Nice to meet you là gì?",
      a: "Nice to meet you too",
      wrong: ["Good morning", "Thank you", "Excuse me"],
    },
    cloze: ["Meeting a new friend: Nice to ___ you.", "meet", ["name", "go", "fine"], "Cụm Nice to meet you."],
    dialogue: ["Lan says: Nice to meet you!", "Nice to meet you too.", ["Good night.", "Excuse me.", "Where are you from?"], "Happy to know you!", "Đáp lại lời làm quen."],
    returnsIn: "Xuất hiện trong hội thoại tổng hợp n13 và bài kiểm tra n15.",
  }),

  // n11: Củng cố điểm yếu — Khắc phục lỗi sai n01–n10 (newItems: [])
  lesson({
    role: "remediation",
    goal: "Củng cố điểm yếu và khắc phục lỗi sai n01–n10",
    newItems: [],
    reviewItems: ["Where are you from?", "What is your name?", "How are you?", "Excuse me", "Nice to meet you"],
    pictureWord: "welcome",
    extraVocab: [],
    phrases: [
      { en: "Where are you from?", vi: "Bạn đến từ đâu?" },
      { en: "I am fine, thank you.", vi: "Tôi khỏe, cảm ơn bạn." },
      { en: "Nice to meet you too.", vi: "Tôi cũng rất vui được gặp bạn." },
    ],
    listen: "Where are you from? I am from Vietnam.",
    dictation: "Excuse me, what is your name?",
    speak: "Nice to meet you too.",
    story: {
      text: "Where are you from? I am from Vietnam.",
      q: "Cấu trúc hỏi xuất xứ đúng là gì?",
      a: "Where are you from?",
      wrong: ["Where you are from?", "You are from where?", "What is from you?"],
    },
    cloze: ["Check question order: Where ___ you from?", "are", ["is", "am", "do"], "Động từ to be đi với you là are."],
    dialogue: ["Excuse me, what is your name?", "My name is Nam.", ["I am from Vietnam.", "Good night.", "Fine, thank you."], "Nice to meet you, Nam.", "Phân biệt câu hỏi tên với câu hỏi xuất xứ."],
    returnsIn: "Bài tập dự phòng cho học viên chưa đạt bài kiểm tra n15.",
  }),

  // n12: Câu chuyện ngữ cảnh — Đọc & nghe câu chuyện bạn mới đến lớp
  lesson({
    role: "narrative",
    goal: "Câu chuyện ngữ cảnh: bạn mới đến lớp học ngoại ngữ",
    newItems: ["new", "student", "class", "together"],
    reviewItems: ["Hello", "My name is", "Where are you from?", "This is my friend"],
    pictureWord: "friend",
    extraVocab: [{ en: "class", vi: "lớp học" }],
    phrases: [
      { en: "Hello, I am a new student.", vi: "Xin chào, tôi là học sinh mới." },
      { en: "Welcome to our class.", vi: "Chào mừng bạn đến với lớp của chúng tôi." },
      { en: "We learn together.", vi: "Chúng ta học cùng nhau." },
    ],
    listen: "Hello, I am a new student. Welcome to our class.",
    dictation: "Welcome to our class.",
    speak: "Hello, I am a new student. Welcome to our class.",
    story: {
      text: "Hello, I am a new student. Welcome to our class.",
      q: "Bạn mới được lớp chào đón thế nào?",
      a: "Chào mừng đến với lớp",
      wrong: ["Tạm biệt", "Chúc ngủ ngon", "Xin lỗi"],
    },
    cloze: ["A new person in school is a new ___.", "student", ["morning", "night", "name"], "student là học sinh."],
    dialogue: ["A new student joins your class.", "Welcome to our class!", ["Goodbye!", "I have to go now.", "Good night."], "Thank you so much!", "Chào đón bạn mới."],
    returnsIn: "Luyện đọc hiểu ngữ cảnh liên hoàn.",
  }),

  // n13: Hội thoại hướng dẫn — Thực hành 4 lượt thoại hoàn chỉnh
  lesson({
    role: "roleplay",
    goal: "Hội thoại hướng dẫn: thực hành 4 lượt thoại hoàn chỉnh",
    newItems: ["How is it going?", "Good to see you", "And you?"],
    reviewItems: ["Hi", "How are you?", "I am fine", "Where are you from?"],
    pictureWord: "welcome",
    extraVocab: [],
    phrases: [
      { en: "Hi! Good to see you.", vi: "Chào bạn! Rất vui được gặp bạn." },
      { en: "How is it going? - Good, and you?", vi: "Dạo này thế nào? - Tốt, còn bạn?" },
      { en: "Where are you from? - I am from Vietnam.", vi: "Bạn từ đâu đến? - Tôi đến từ Việt Nam." },
    ],
    listen: "Hi! Good to see you. How is it going?",
    dictation: "Good to see you. And you?",
    speak: "Hi! Good to see you. I am fine, and you?",
    story: {
      text: "Hi! Good to see you. How is it going? Good, and you?",
      q: "Câu nào dùng để hỏi lại người đối diện?",
      a: "And you?",
      wrong: ["Where?", "What?", "Why?"],
    },
    cloze: ["To ask back quickly: And ___?", "you", ["I", "he", "she"], "And you? nghĩa là Còn bạn thì sao?"],
    dialogue: ["John says: I am fine, and you?", "I am good, thank you.", ["Good night.", "Goodbye.", "What is your name?"], "Awesome!", "Đối thoại phản xạ 2 chiều."],
    returnsIn: "Thực hành phản xạ trước khi tự giới thiệu hoàn chỉnh ở n14.",
  }),

  // n14: Tự giới thiệu & Rời đi — Giới thiệu bản thân trọn vẹn và kết thúc lịch sự
  lesson({
    role: "production",
    goal: "Tự giới thiệu bản thân trọn vẹn và xin phép rời đi lịch sự",
    newItems: ["I have to go now", "Goodbye", "See you later", "take care"],
    reviewItems: ["Hello", "I am", "from Vietnam", "Thank you"],
    pictureWord: "thanks",
    extraVocab: [{ en: "goodbye", vi: "tạm biệt" }],
    phrases: [
      { en: "I have to go now. Goodbye!", vi: "Tôi phải đi bây giờ. Tạm biệt!" },
      { en: "Thank you. See you later.", vi: "Cảm ơn bạn. Hẹn gặp lại." },
      { en: "Take care. See you later.", vi: "Bảo trọng nhé. Hẹn gặp lại." },
    ],
    listen: "I have to go now. Thank you, goodbye!",
    dictation: "Thank you. See you later.",
    speak: "Hello, I am Nam. I am from Vietnam. I have to go now. Goodbye!",
    story: {
      text: "Thank you. I have to go now. See you later.",
      q: "Bạn nói gì khi có việc bận phải rời đi?",
      a: "I have to go now",
      wrong: ["Good morning", "Where are you from", "How are you"],
    },
    cloze: ["When you must leave: I have to ___ now.", "go", ["come", "see", "meet"], "I have to go now nghĩa là Tôi phải đi bây giờ."],
    dialogue: ["You finished your talk and must leave now.", "I have to go now. Goodbye!", ["Good morning!", "What is your name?", "Where are you from?"], "Goodbye! Take care!", "Kết thúc lịch thiệp."],
    returnsIn: "Tổng kết toàn bộ kỹ năng giao tiếp Cửa 1.",
  }),
];

export const ROLE_LABEL = {
  introduce: "Học có hỗ trợ",
  retrieval: "Ôn truy hồi",
  expansion: "Mở rộng",
  checkpoint: "Kiểm tra giữa cửa",
  application: "Vận dụng",
  remediation: "Củng cố điểm yếu",
  narrative: "Câu chuyện ngữ cảnh",
  roleplay: "Hội thoại hướng dẫn",
  production: "Tự giới thiệu",
  reinforce: "Củng cố",
  apply: "Vận dụng",
};

export function p1GateLesson(nodeIndex) {
  const index = Math.min(14, Math.max(1, Number(nodeIndex) || 1)) - 1;
  return LESSONS[index];
}

export function p1ContentRow(nodeIndex) {
  const plan = p1GateLesson(nodeIndex);
  return {
    goal: plan.goal,
    phrase: plan.phrases[0],
    listen: plan.listen,
    dictation: plan.dictation,
    speak: plan.speak,
    story: plan.story,
  };
}

export function p1MasteryRubric(nodeIndex) {
  const plan = p1GateLesson(nodeIndex);
  return {
    gateId: "p1-g1",
    role: plan.role,
    roleLabel: ROLE_LABEL[plan.role] || "Bài học",
    goal: plan.goal,
    newItems: plan.newItems || [],
    reviewItems: plan.reviewItems || [],
    targets: plan.phrases.slice(0, 1).map((item) => item.en),
    returnsIn: plan.returnsIn,
    recognition: "Nghe nhận diện, chọn nghĩa, ghép cặp từ, điền từ thiếu.",
    application: "Sắp xếp từ, dịch phản xạ, chọn câu đáp tình huống và nói câu hoàn chỉnh.",
    practiceNote: "Đọc thành tiếng là luyện phản xạ phát âm trong phiên, không dùng transcript để kết luận thành thạo.",
    completionNote: "Hoàn thành bài khi đạt đủ điều kiện câu đúng theo quy định.",
  };
}

const RECOGNITION_ACTIVITIES = new Set([1, 2, 3, 4, 6, 7]);
const APPLICATION_ACTIVITIES = new Set([5, 8, 9, 10]);
const PRACTICE_ACTIVITIES = new Set([11, 12]);

export function evidenceRoleForActivity(activityNumber) {
  const n = Number(activityNumber);
  if (RECOGNITION_ACTIVITIES.has(n)) return "recognition";
  if (APPLICATION_ACTIVITIES.has(n)) return "application";
  if (PRACTICE_ACTIVITIES.has(n)) return "practice";
  return "recognition";
}

export function assessP1MasteryEvidence(attempts) {
  const rows = Array.isArray(attempts) ? attempts : [];
  const ofRole = (role) => rows.filter((item) => evidenceRoleForActivity(item.activity) === role);
  const recognition = ofRole("recognition");
  const application = ofRole("application");
  const practice = ofRole("practice");
  const allCorrect = (list) => list.length > 0 && list.every((item) => item.correct === true);
  return {
    recognitionMet: allCorrect(recognition),
    applicationMet: allCorrect(application),
    recognitionCount: recognition.length,
    applicationCount: application.length,
    practiceCount: practice.length,
    mastered: allCorrect(recognition) && allCorrect(application),
  };
}
