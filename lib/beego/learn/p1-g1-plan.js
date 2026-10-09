/**
 * Mục tiêu cửa p1-g1. Không áp vào 7 cửa còn lại.
 * Hoàn thành bài và kết quả luyện tập trong phiên là hai việc khác nhau.
 * Đọc thành tiếng là luyện tập, không phải điểm phát âm.
 */

export const P1_CONTENT_REVISION = "p1g1-r3";

const PICTURES = [
  { en: "name", vi: "tên" },
  { en: "morning", vi: "buổi sáng" },
  { en: "night", vi: "buổi tối" },
  { en: "thanks", vi: "cảm ơn" },
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
  lesson({
    role: "introduce",
    goal: "Chào một người mới",
    newItems: ["Hello", "I am", "name"],
    reviewItems: [],
    pictureWord: "name",
    extraVocab: [{ en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "Hello I am Beego.", vi: "Xin chào, tôi là Beego." },
      { en: "Hello.", vi: "Xin chào." },
      { en: "I am Beego.", vi: "Tôi là Beego." },
    ],
    listen: "Hello Beego.",
    dictation: "I am Beego. Hello.",
    speak: "Hello. I am Beego.",
    story: {
      text: "Hello Mai. I am Beego.",
      q: "Beego chào Mai bằng câu nào?",
      a: "Hello I am Beego",
      wrong: ["Good night", "Thank you", "See you later"],
    },
    cloze: ["Beego says Hello to Mai.", "Hello", ["Goodbye", "Sorry", "Thanks"], "Khi mới gặp, lời chào là Hello."],
    dialogue: ["You meet Mai for the first time. What do you say?", "Hello. I am Beego.", ["Good night.", "Thank you very much.", "See you later."], "Nice to meet you.", "Lần đầu gặp thì chào và nói mình là ai."],
    returnsIn: "name được hỏi lại ở n02; Hello và I am được dùng khi chào rồi hỏi tên.",
  }),
  lesson({
    role: "introduce",
    goal: "Hỏi tên một người",
    newItems: ["What is your name?", "My name is"],
    reviewItems: ["Hello", "I am", "name"],
    pictureWord: "name",
    extraVocab: [{ en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "What is your name?", vi: "Bạn tên gì?" },
      { en: "My name is Beego.", vi: "Tên tôi là Beego." },
      { en: "Hello. My name is Beego.", vi: "Xin chào. Tên tôi là Beego." },
    ],
    listen: "Hello. I am Beego. What is your name?",
    dictation: "What is your name? My name is Beego.",
    speak: "My name is Beego. Hello.",
    story: {
      text: "Hello Lan. What is your name? My name is Beego.",
      q: "Beego nói tên mình thế nào?",
      a: "My name is Beego",
      wrong: ["I am fine", "Good night", "Thank you"],
    },
    cloze: ["Lan asks, and Beego tells her his name.", "name", ["morning", "night", "thanks"], "Câu đang hỏi tên, nên từ cần điền là name."],
    dialogue: ["Hello Beego. What is your name?", "My name is Beego.", ["I am fine.", "Good night.", "Thank you."], "Hello, Beego.", "Sau lời chào, câu hỏi xin tên thì đáp bằng tên."],
    returnsIn: "My name is trở lại ở n09 khi giới thiệu bạn.",
  }),
  lesson({
    role: "introduce",
    goal: "Nói mình khỏe",
    newItems: ["How are you?", "I am fine"],
    reviewItems: ["Hello", "My name is"],
    pictureWord: "name",
    extraVocab: [{ en: "fine", vi: "khỏe" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "I am fine.", vi: "Tôi khỏe." },
      { en: "How are you?", vi: "Bạn khỏe không?" },
      { en: "Hello. I am fine.", vi: "Xin chào. Tôi khỏe." },
    ],
    listen: "Hello. How are you?",
    dictation: "How are you? I am fine.",
    speak: "My name is Beego. I am fine.",
    story: {
      text: "Hello. How are you? I am fine.",
      q: "Beego nói mình thế nào?",
      a: "Anh ấy khỏe",
      wrong: ["Anh ấy tạm biệt", "Anh ấy cảm ơn", "Anh ấy chào buổi tối"],
    },
    cloze: ["Mai asks, and Beego says he is fine.", "fine", ["name", "morning", "night"], "Beego trả lời về sức khỏe: fine."],
    dialogue: ["Hello Beego. How are you?", "I am fine.", ["My name is Mai.", "Good night.", "Thank you."], "Good to hear that.", "Câu hỏi sức khỏe thì đáp I am fine, không nhắc lại tên."],
    returnsIn: "How are you và I am fine trở lại vào buổi sáng ở n11.",
  }),
  lesson({
    role: "introduce",
    goal: "Chào buổi sáng",
    newItems: ["Good morning"],
    reviewItems: ["Hello", "I am fine"],
    pictureWord: "morning",
    extraVocab: [{ en: "hello", vi: "xin chào" }, { en: "fine", vi: "khỏe" }],
    phrases: [
      { en: "Good morning.", vi: "Chào buổi sáng." },
      { en: "Good morning. I am fine.", vi: "Chào buổi sáng. Tôi khỏe." },
      { en: "Hello. Good morning.", vi: "Xin chào. Chào buổi sáng." },
    ],
    listen: "Good morning Beego.",
    dictation: "Good morning. I am fine. Hello.",
    speak: "Hello. Good morning. I am fine.",
    story: {
      text: "Good morning Mai. I am fine.",
      q: "Beego chào lúc nào?",
      a: "Buổi sáng",
      wrong: ["Buổi tối", "Lúc tạm biệt", "Lúc cảm ơn"],
    },
    cloze: ["At breakfast Beego says good morning.", "morning", ["night", "name", "thanks"], "Bữa sáng đi với morning."],
    dialogue: ["Good morning. How are you?", "Good morning. I am fine.", ["Good night.", "Thank you.", "See you later."], "Hello.", "Buổi sáng chào good morning và có thể nói mình khỏe."],
    returnsIn: "Good morning được đối chiếu với Good night ở n05 và được hỏi lại ở n11.",
  }),
  lesson({
    role: "introduce",
    goal: "Chào buổi tối",
    newItems: ["Good night"],
    reviewItems: ["Good morning"],
    pictureWord: "night",
    extraVocab: [
      { en: "hello", vi: "xin chào" },
      { en: "fine", vi: "khỏe" },
      { en: "morning", vi: "buổi sáng" },
    ],
    phrases: [
      { en: "Good night.", vi: "Chúc ngủ ngon." },
      { en: "Good morning.", vi: "Chào buổi sáng." },
      { en: "Good night Beego.", vi: "Chúc ngủ ngon, Beego." },
    ],
    listen: "Good night. Hello.",
    dictation: "Hello. Good night.",
    speak: "Good night. I am fine.",
    story: {
      text: "Good night Mai.",
      q: "Beego nói gì lúc kết thúc ngày?",
      a: "Good night",
      wrong: ["Good morning", "Thank you", "What is your name"],
    },
    cloze: ["Beego says good night.", "night", ["morning", "name", "thanks"], "Lúc chào buổi tối, từ cần điền là night."],
    dialogue: ["Hello Beego.", "Good night.", ["Good morning.", "What is your name?", "I am fine."], "Good night.", "Lời đáp đúng là Good night. Good morning là chào buổi sáng."],
    returnsIn: "Good morning được dùng lại thành câu dịch đúng, để tách với Good night. Good night được nói lại khi phải đi ở n14.",
  }),
  lesson({
    role: "introduce",
    goal: "Cảm ơn một người",
    newItems: ["Thank you"],
    reviewItems: ["Hello", "Good morning"],
    pictureWord: "thanks",
    extraVocab: [{ en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "Thank you.", vi: "Cảm ơn bạn." },
      { en: "Good morning. Thank you.", vi: "Chào buổi sáng. Cảm ơn bạn." },
      { en: "Hello. Thank you.", vi: "Xin chào. Cảm ơn bạn." },
    ],
    listen: "Thank you Beego.",
    dictation: "Good morning. Thank you. Hello.",
    speak: "Hello. Thank you. Good morning.",
    story: {
      text: "Thank you Mai. Hello.",
      q: "Beego nói gì sau khi được giúp?",
      a: "Cảm ơn",
      wrong: ["Tạm biệt", "Chúc ngủ ngon", "Hỏi tên"],
    },
    cloze: ["Beego says thank you.", "thank", ["name", "morning", "night"], "Lời cảm ơn dùng thank you."],
    dialogue: ["Good morning. I opened the door for you.", "Thank you.", ["Good night.", "What is your name?", "I am fine."], "You are welcome.", "Được giúp thì cảm ơn, dù vừa chào buổi sáng."],
    returnsIn: "Thank you trở lại ở n07 trong tình huống trước khi hỏi, và ở n14 khi chia tay.",
  }),
  lesson({
    role: "introduce",
    goal: "Xin lỗi để hỏi",
    newItems: ["Excuse me"],
    reviewItems: ["Thank you", "Hello"],
    pictureWord: "thanks",
    extraVocab: [{ en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "Excuse me.", vi: "Xin lỗi, cho tôi hỏi." },
      { en: "Excuse me. Hello.", vi: "Xin lỗi. Xin chào." },
      { en: "Thank you.", vi: "Cảm ơn bạn." },
    ],
    listen: "Excuse me Beego.",
    dictation: "Hello. Excuse me.",
    speak: "Thank you. Excuse me.",
    story: {
      text: "Excuse me Mai.",
      q: "Beego nói gì trước khi hỏi?",
      a: "Excuse me",
      wrong: ["Thank you", "Good night", "I am fine"],
    },
    cloze: ["Beego says excuse me.", "excuse", ["thank", "night", "name"], "Trước khi hỏi, Beego nói excuse me."],
    dialogue: ["You want to ask a question. What do you say first?", "Excuse me.", ["Thank you.", "Good night.", "I am fine."], "Yes?", "Trước câu hỏi là excuse me. Thank you dùng sau khi được giúp."],
    returnsIn: "Thank you là một câu dịch đúng trong bài, để dùng lại lời cảm ơn. Excuse me được dùng lại khi giới thiệu bạn ở n09.",
  }),
  lesson({
    role: "introduce",
    goal: "Tạm biệt bạn",
    newItems: ["Goodbye", "See you later"],
    reviewItems: ["Hello"],
    pictureWord: "name",
    extraVocab: [{ en: "hello", vi: "xin chào" }, { en: "goodbye", vi: "tạm biệt" }],
    phrases: [
      { en: "Goodbye.", vi: "Tạm biệt." },
      { en: "See you later.", vi: "Hẹn gặp lại." },
      { en: "Hello. Goodbye.", vi: "Xin chào. Tạm biệt." },
    ],
    listen: "Goodbye Beego.",
    dictation: "Goodbye. See you later.",
    speak: "See you later. Goodbye.",
    story: {
      text: "Goodbye Mai. See you later.",
      q: "Beego nói gì khi ra về?",
      a: "Tạm biệt",
      wrong: ["Xin chào", "Cảm ơn", "Chào buổi sáng"],
    },
    cloze: ["Beego says goodbye and see you later.", "goodbye", ["hello", "name", "thanks"], "Lúc ra về, từ là goodbye."],
    dialogue: ["The lesson is over. What do you say?", "Goodbye. See you later.", ["Hello. I am Beego.", "Excuse me.", "Good morning."], "Bye.", "Hết buổi thì tạm biệt và hẹn gặp lại, không chào như lúc mới đến."],
    returnsIn: "Goodbye và See you later trở lại khi rời lớp ở n12 và khi phải đi ở n14.",
  }),
  lesson({
    role: "reinforce",
    goal: "Giới thiệu một người bạn",
    newItems: ["This is my friend", "friend"],
    reviewItems: ["My name is", "Hello", "Excuse me"],
    pictureWord: "name",
    extraVocab: [{ en: "friend", vi: "bạn" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "This is my friend.", vi: "Đây là bạn của tôi." },
      { en: "My name is Beego.", vi: "Tên tôi là Beego." },
      { en: "Excuse me. This is my friend.", vi: "Xin lỗi. Đây là bạn của tôi." },
    ],
    listen: "Hello. This is my friend.",
    dictation: "This is my friend. My name is Beego.",
    speak: "My name is Beego. This is my friend.",
    story: {
      text: "Hello. This is my friend. My name is Beego.",
      q: "Beego giới thiệu ai?",
      a: "Bạn Mai",
      wrong: ["Buổi tối", "Lời cảm ơn", "Lời tạm biệt"],
    },
    cloze: ["This is my friend Mai.", "friend", ["name", "morning", "night"], "Câu giới thiệu dùng friend."],
    dialogue: ["Hello. Who is with you?", "This is my friend. Her name is Mai.", ["Good night.", "Thank you.", "Excuse me."], "Hello, Mai.", "Giới thiệu bạn, rồi nhắc tên. Không dùng lời tạm biệt."],
    returnsIn: "friend và This is trở lại khi chào bạn mới ở n10.",
  }),
  lesson({
    role: "introduce",
    goal: "Chào mừng người mới",
    newItems: ["Welcome"],
    reviewItems: ["Hello", "This is my friend", "friend"],
    pictureWord: "morning",
    extraVocab: [{ en: "welcome", vi: "chào mừng" }, { en: "friend", vi: "bạn" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "Welcome.", vi: "Chào mừng bạn." },
      { en: "Hello. Welcome.", vi: "Xin chào. Chào mừng bạn." },
      { en: "This is my friend.", vi: "Đây là bạn của tôi." },
    ],
    listen: "Welcome Beego.",
    dictation: "Welcome. This is my friend.",
    speak: "This is my friend. Welcome.",
    story: {
      text: "Hello. Welcome. This is my friend.",
      q: "Lớp nói gì với bạn mới?",
      a: "Chào mừng",
      wrong: ["Tạm biệt", "Chúc ngủ ngon", "Xin hóa đơn"],
    },
    cloze: ["Beego says welcome.", "welcome", ["goodbye", "night", "thanks"], "Gặp người mới thì nói welcome."],
    dialogue: ["A new friend walks in. What do you say?", "Hello. Welcome.", ["Goodbye. See you later.", "Good night.", "Excuse me."], "Thank you.", "Bạn mới đến thì chào và chào mừng, không tạm biệt."],
    returnsIn: "Welcome được dùng đúng trong câu chào người mới của bài này. Bài sau không lấy Welcome làm mục ôn.",
  }),
  lesson({
    role: "reinforce",
    goal: "Hỏi sức khỏe buổi sáng",
    newItems: [],
    reviewItems: ["Good morning", "How are you?", "I am fine"],
    pictureWord: "morning",
    extraVocab: [{ en: "fine", vi: "khỏe" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "How are you this morning?", vi: "Sáng nay bạn khỏe không?" },
      { en: "Good morning. I am fine.", vi: "Chào buổi sáng. Tôi khỏe." },
      { en: "Good morning.", vi: "Chào buổi sáng." },
    ],
    listen: "Good morning. How are you?",
    dictation: "How are you this morning? I am fine.",
    speak: "Good morning. I am fine. Hello.",
    story: {
      text: "Good morning. How are you? I am fine.",
      q: "Mai gọi để làm gì?",
      a: "Hỏi sức khỏe",
      wrong: ["Tạm biệt", "Chào buổi tối", "Cảm ơn"],
    },
    cloze: ["Good morning. Beego is fine.", "fine", ["name", "night", "thanks"], "Buổi sáng hỏi lại sức khỏe: fine."],
    dialogue: ["Good morning Beego. How are you?", "I am fine.", ["Good night.", "See you later.", "Excuse me."], "Good morning.", "Buổi sáng ghép lời chào sáng với câu hỏi sức khỏe đã học."],
    returnsIn: "Không thêm mục mới. Ba cụm đã học gặp nhau trong một tình huống sáng.",
  }),
  lesson({
    role: "reinforce",
    goal: "Hẹn gặp lại",
    newItems: [],
    reviewItems: ["Goodbye", "See you later"],
    pictureWord: "name",
    extraVocab: [{ en: "goodbye", vi: "tạm biệt" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "See you later.", vi: "Hẹn gặp lại." },
      { en: "Goodbye. See you later.", vi: "Tạm biệt. Hẹn gặp lại." },
      { en: "Goodbye.", vi: "Tạm biệt." },
    ],
    listen: "See you later Beego.",
    dictation: "See you later. Goodbye.",
    speak: "Goodbye Beego. See you later.",
    story: {
      text: "Goodbye. See you later Mai.",
      q: "Beego hẹn gặp khi nào?",
      a: "Lát nữa",
      wrong: ["Buổi tối", "Lúc chào buổi sáng", "Khi cảm ơn"],
    },
    cloze: ["Beego says goodbye and see you later.", "later", ["hello", "name", "night"], "Hẹn gặp lại trong ngày thì dùng later."],
    dialogue: ["You are leaving the class. What do you say?", "Goodbye. See you later.", ["Hello. I am Beego.", "Good morning.", "How are you?"], "Bye.", "Rời lớp thì dùng lại goodbye và see you later, không chào như lúc đến."],
    returnsIn: "Cùng hai cụm được dùng lại khi phải đi giữa chừng ở n14.",
  }),
  lesson({
    role: "apply",
    goal: "Chào đồng nghiệp",
    newItems: ["Hi", "Good to see you"],
    reviewItems: ["Hello", "Good morning"],
    pictureWord: "morning",
    extraVocab: [{ en: "hi", vi: "chào thân mật" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "Hi. Good to see you.", vi: "Chào, vui được gặp bạn." },
      { en: "Hello. Good morning.", vi: "Xin chào. Chào buổi sáng." },
      { en: "Hi.", vi: "Chào." },
    ],
    listen: "Hi Beego.",
    dictation: "Hello. Hi.",
    speak: "Hi. Good morning.",
    story: {
      text: "Hi Mai. Good to see you.",
      q: "Beego chào người quen thế nào?",
      a: "Hi. Good to see you",
      wrong: ["See you later", "Good night", "Excuse me"],
    },
    cloze: ["Beego says hi.", "hi", ["night", "name", "thanks"], "Gặp người quen, lời chào ngắn là hi."],
    dialogue: ["You meet someone you know. What do you say?", "Hi. Good to see you.", ["See you later.", "Good night.", "Excuse me."], "Good to see you too.", "Gặp người quen thì chào hi, chưa phải lúc hẹn gặp lại."],
    returnsIn: "Hello và Good morning được nói lại trong câu đúng. See you later chỉ là đáp án không chọn, nên không tính là ôn.",
  }),
  lesson({
    role: "apply",
    goal: "Kết thúc cuộc nói chuyện",
    newItems: ["I have to go"],
    reviewItems: ["Good night", "Goodbye", "See you later", "Thank you"],
    pictureWord: "thanks",
    extraVocab: [{ en: "goodbye", vi: "tạm biệt" }, { en: "hello", vi: "xin chào" }],
    phrases: [
      { en: "I have to go now.", vi: "Tôi phải đi bây giờ." },
      { en: "Good night. I have to go now.", vi: "Chúc ngủ ngon. Tôi phải đi bây giờ." },
      { en: "Thank you. See you later.", vi: "Cảm ơn. Hẹn gặp lại." },
    ],
    listen: "Thank you. I have to go now.",
    dictation: "Goodbye. See you later.",
    speak: "Thank you. Goodbye. See you later.",
    story: {
      text: "Thank you. I have to go now. See you later.",
      q: "Beego nói gì khi phải đi?",
      a: "I have to go now",
      wrong: ["Hello I am Beego", "How are you", "Good morning"],
    },
    cloze: ["Beego says he has to go now.", "go", ["hello", "name", "night"], "Beego phải go, không ở lại chào tiếp."],
    dialogue: ["You must leave now. What do you say?", "I have to go now. See you later.", ["Hello. I am Beego.", "How are you?", "Good morning."], "Thank you. Goodbye.", "Kết thúc bằng câu phải đi, rồi hẹn gặp lại. Không chào như lúc mới đến."],
    returnsIn: "Cửa này khép bằng các cụm đã học: cảm ơn, phải đi, hẹn gặp lại.",
  }),
];

const ROLE_LABEL = {
  introduce: "Giới thiệu mới",
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
    roleLabel: ROLE_LABEL[plan.role],
    goal: plan.goal,
    newItems: plan.newItems,
    reviewItems: plan.reviewItems,
    targets: plan.phrases.slice(0, 1).map((item) => item.en),
    returnsIn: plan.returnsIn,
    recognition: "Nghe, chọn nghĩa, ghép, nghe điền, nghe nhập lại và đọc đoạn.",
    application: "Sắp xếp câu, dịch, điền từ và chọn câu đáp trong tình huống.",
    practiceNote: "Đọc thành tiếng chỉ là luyện tập trong phiên. Transcript không được dùng để kết luận phát âm đạt.",
    completionNote: "Hoàn thành bài vẫn theo luật điểm và mở khóa hiện có. Kết quả luyện tập trong phiên không đổi trạng thái hoàn thành.",
  };
}

const RECOGNITION_ACTIVITIES = new Set([1, 2, 3, 4, 6, 7, 12]);
const APPLICATION_ACTIVITIES = new Set([5, 8, 9, 10]);
const PRACTICE_ACTIVITIES = new Set([11]);

export function evidenceRoleForActivity(activityNumber) {
  const n = Number(activityNumber);
  if (RECOGNITION_ACTIVITIES.has(n)) return "recognition";
  if (APPLICATION_ACTIVITIES.has(n)) return "application";
  if (PRACTICE_ACTIVITIES.has(n)) return "practice";
  return "";
}

/**
 * Session evidence only. It does not read or write lesson completion.
 * @param {Array<{ activity?: number, correct?: boolean }>} attempts
 */
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
