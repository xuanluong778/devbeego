/** Sinh câu ví dụ EN + VI đa dạng cho từ vựng cơ bản. */

const VERBS = new Set([
  "have", "want", "learn", "live", "drink", "see", "know", "feel", "hear", "laugh",
  "check", "work", "pack", "remind", "miss", "beg", "grow", "happen", "hate", "fight",
  "rain", "learn", "teach", "read", "write", "speak", "listen", "watch", "play", "run",
  "walk", "drive", "fly", "cook", "eat", "sleep", "wake", "open", "close", "help",
  "love", "like", "need", "use", "find", "think", "bring", "take", "give", "send",
  "meet", "leave", "arrive", "stay", "travel", "study", "practice", "try", "start",
  "stop", "wait", "pay", "buy", "sell", "wear", "put", "sit", "stand", "look",
]);

const ADJECTIVES = new Set([
  "fine", "nice", "good", "bad", "big", "small", "hot", "cold", "cheap", "expensive",
  "easy", "difficult", "fast", "slow", "happy", "married", "friendly", "horrible",
  "modern", "rich", "serious", "different", "exciting", "international", "american",
  "french", "italian", "japanese", "warm", "cool", "new", "old", "young", "beautiful",
  "ugly", "strong", "weak", "busy", "free", "ready", "sure", "sorry", "famous",
  "popular", "important", "possible", "comfortable", "dangerous", "safe", "clean",
  "dirty", "full", "empty", "hungry", "thirsty", "tired", "sick", "healthy", "late",
  "early", "right", "wrong", "true", "false", "quiet", "loud", "dark", "light",
  "brilliant", "luxury", "large", "little", "quite", "just", "initial", "second",
  "first", "last", "next", "same", "special", "perfect", "wonderful", "lovely",
]);

/** Câu cố định cho từ/ cụm đặc biệt */
const CUSTOM_EXAMPLES = {
  because: {
    en: "I stayed home because it was raining.",
    vi: "Tôi ở nhà vì trời đang mưa.",
  },
  from: {
    en: "She is from England.",
    vi: "Cô ấy đến từ nước Anh.",
  },
  between: {
    en: "The café is between the bank and the school.",
    vi: "Quán cà phê nằm giữa ngân hàng và trường học.",
  },
  have: {
    en: "I have two younger brothers.",
    vi: "Tôi có hai em trai.",
  },
  want: {
    en: "I want a cup of coffee.",
    vi: "Tôi muốn một tách cà phê.",
  },
  learn: {
    en: "I learn English every evening.",
    vi: "Tôi học tiếng Anh mỗi buổi tối.",
  },
  live: {
    en: "They live in a small flat.",
    vi: "Họ sống trong một căn hộ nhỏ.",
  },
  hello: {
    en: "Hello! How are you today?",
    vi: "Xin chào! Hôm nay bạn khỏe không?",
  },
  goodbye: {
    en: "We said goodbye at the station.",
    vi: "Chúng tôi nói tạm biệt ở nhà ga.",
  },
  "thank you": {
    en: "Thank you for your help.",
    vi: "Cảm ơn vì sự giúp đỡ của bạn.",
  },
  thanks: {
    en: "Thanks for the lovely gift.",
    vi: "Cảm ơn vì món quà đáng yêu.",
  },
  "see you": {
    en: "See you tomorrow at school.",
    vi: "Hẹn gặp lại bạn ngày mai ở trường.",
  },
  "not bad": {
    en: "The movie was not bad at all.",
    vi: "Bộ phim không tệ chút nào.",
  },
  "here you are": {
    en: "Here you are. This is your ticket.",
    vi: "Của bạn đây. Đây là vé của bạn.",
  },
  "can i help": {
    en: "Can I help you find your seat?",
    vi: "Tôi có thể giúp bạn tìm chỗ ngồi không?",
  },
  "how much": {
    en: "How much is this bag?",
    vi: "Cái túi này bao nhiêu tiền?",
  },
  "how old": {
    en: "How old is your daughter?",
    vi: "Con gái bạn bao nhiêu tuổi?",
  },
  "how many": {
    en: "How many books do you have?",
    vi: "Bạn có bao nhiêu quyển sách?",
  },
  "anything else": {
    en: "Would you like anything else?",
    vi: "Bạn còn muốn gì nữa không?",
  },
  "at home": {
    en: "I stayed at home all day.",
    vi: "Tôi ở nhà cả ngày.",
  },
  "do homework": {
    en: "I do homework after dinner.",
    vi: "Tôi làm bài tập về nhà sau bữa tối.",
  },
  "fall in love": {
    en: "They fell in love in college.",
    vi: "Họ phải lòng nhau khi đi học đại học.",
  },
  "now boarding": {
    en: "Flight 302 is now boarding at gate 5.",
    vi: "Chuyến bay 302 đang lên máy bay tại cổng 5.",
  },
  "passport control": {
    en: "We waited in line at passport control.",
    vi: "Chúng tôi xếp hàng ở khu kiểm tra hộ chiếu.",
  },
  "thanks a lot": {
    en: "Thanks a lot for your kindness.",
    vi: "Cảm ơn bạn rất nhiều vì sự tử tế.",
  },
  "telephone number": {
    en: "May I have your telephone number?",
    vi: "Cho tôi xin số điện thoại của bạn được không?",
  },
  "the usa": {
    en: "She studied in the USA for two years.",
    vi: "Cô ấy du học ở Hoa Kỳ trong hai năm.",
  },
};

const CUSTOM_BY_VI = [
  {
    word: "please",
    test: (v) => v.includes("hài lòng"),
    en: "The service pleased every guest.",
    vi: "Dịch vụ làm hài lòng mọi vị khách.",
  },
  {
    word: "please",
    test: (v) => v.includes("lòng"),
    en: "Please close the window.",
    vi: "Làm ơn đóng cửa sổ lại.",
  },
  {
    word: "fine",
    test: (v) => v.includes("khỏe"),
    en: "I am fine, thank you.",
    vi: "Tôi khỏe, cảm ơn bạn.",
  },
  {
    word: "letter",
    test: (v) => v.includes("thư"),
    en: "I wrote a letter to my friend.",
    vi: "Tôi viết một lá thư cho bạn tôi.",
  },
  {
    word: "letter",
    test: (v) => v.includes("chữ"),
    en: "The word starts with the letter B.",
    vi: "Từ này bắt đầu bằng chữ cái B.",
  },
  {
    word: "orange",
    test: (v) => v.includes("quả"),
    en: "She peeled an orange for lunch.",
    vi: "Cô ấy gọt một quả cam cho bữa trưa.",
  },
  {
    word: "orange",
    test: (v) => v.includes("màu"),
    en: "She wore an orange dress.",
    vi: "Cô ấy mặc một chiếc váy màu cam.",
  },
  {
    word: "fast",
    test: (v) => v === "nhanh",
    en: "This train is very fast.",
    vi: "Chuyến tàu này rất nhanh.",
  },
  {
    word: "miss",
    test: (v) => v.includes("nhớ"),
    en: "I miss my family a lot.",
    vi: "Tôi rất nhớ gia đình.",
  },
  {
    word: "miss",
    test: (v) => v.includes("lỡ"),
    en: "I missed the last bus home.",
    vi: "Tôi lỡ chuyến xe buýt cuối về nhà.",
  },
];

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function article(word) {
  const w = String(word || "").trim().toLowerCase();
  const first = w.split(/\s+/)[0] || w;
  return /^[aeiou]/i.test(first) ? "an" : "a";
}

function capitalizeVi(text) {
  const t = String(text || "").trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function capitalize(text) {
  const t = String(text || "").trim();
  if (!t) return t;
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function lookupCustom(wordKey, vi) {
  const normalized = wordKey.replace(/\?$/, "").trim();
  if (CUSTOM_EXAMPLES[normalized]) return CUSTOM_EXAMPLES[normalized];

  for (const rule of CUSTOM_BY_VI) {
    if (rule.word === normalized && rule.test(vi.toLowerCase())) {
      return { en: rule.en, vi: rule.vi };
    }
  }
  return null;
}

function detectCategory(word, vi) {
  const w = word.toLowerCase().trim().replace(/\?$/, "");
  const v = vi.toLowerCase().trim();

  if (lookupCustom(w, vi)) return "custom";
  if (/^(thank you|thanks|hello|hi|goodbye|see you|nice to meet|here you are)/.test(w)) return "greeting";
  if (/\?$/.test(word) || /^(how |what |where |can i|do you)/.test(w)) return "question";
  if (v.startsWith("nước ") || /^(brazil|egypt|england|france|germany|japan|italy|spain|russia|mexico|hungary|canada|argentina)$/i.test(w)) {
    return "country";
  }
  if (/^(my|your|her|his|our|their|me|you|we|they|this|that|these|those)$/i.test(w)) return "pronoun";
  if (w.includes(" ")) return "phrase";
  if (VERBS.has(w) || /^động từ/.test(v)) return "verb";
  if (ADJECTIVES.has(w)) return "adjective";
  if (/(bác sĩ|giáo viên|học sinh|sinh viên|kế toán|thư ký|quản lý|tiếp viên|hàng xóm|triệu phú)/.test(v)) return "person";
  if (/(quả |thịt |bánh |cà phê|bia|trứng|gà|sô cô la|khoai)/.test(v)) return "food";
  if (/(nhà |phòng |công viên|bếp|vườn|siêu thị|sân bay|bệnh viện|rạp|tầng |cửa )/.test(v)) return "place";
  return "noun";
}

const TEMPLATES = {
  greeting: [
    {
      en: ({ word }) => `${capitalize(word)}! Nice to meet you.`,
      vi: ({ vi }) => `${capitalizeVi(vi)}! Rất vui được gặp bạn.`,
    },
    {
      en: ({ word }) => `She smiled and said, "${capitalize(word)}."`,
      vi: ({ vi }) => `Cô ấy mỉm cười và nói: "${capitalizeVi(vi)}."`,
    },
    {
      en: ({ word }) => `I always say "${word.toLowerCase()}" when I leave.`,
      vi: ({ vi }) => `Tôi luôn nói "${vi}" khi ra về.`,
    },
  ],
  question: [
    {
      en: ({ word }) => `${capitalize(word)}`,
      vi: ({ vi }) => `${capitalizeVi(vi)}`,
    },
    {
      en: ({ word }) => `Excuse me, ${word.toLowerCase()}`,
      vi: ({ vi }) => `Xin lỗi, ${vi}`,
    },
    {
      en: ({ word }) => `Could you tell me ${word.toLowerCase()}?`,
      vi: ({ vi }) => `Bạn có thể cho tôi biết ${vi} không?`,
    },
  ],
  country: [
    {
      en: ({ word }) => `I dream of visiting ${capitalize(word)} one day.`,
      vi: ({ vi }) => `Tôi mơ một ngày được đến thăm ${vi}.`,
    },
    {
      en: ({ word }) => `${capitalize(word)} has a rich culture.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} có nền văn hóa phong phú.`,
    },
    {
      en: ({ word }) => `My friend lives in ${capitalize(word)}.`,
      vi: ({ vi }) => `Bạn tôi sống ở ${vi}.`,
    },
  ],
  pronoun: [
    {
      en: ({ word }) => `${capitalize(word)} book is on the table.`,
      vi: ({ vi }) => `Sách ${vi} đang ở trên bàn.`,
    },
    {
      en: ({ word }) => `I gave the keys to ${word.toLowerCase()}.`,
      vi: ({ vi }) => `Tôi đưa chìa khóa cho ${vi}.`,
    },
    {
      en: ({ word }) => `${capitalize(word)} is very kind.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} rất tốt bụng.`,
    },
  ],
  phrase: [
    {
      en: ({ word }) => `${capitalize(word)}.`,
      vi: ({ vi }) => `${capitalizeVi(vi)}.`,
    },
    {
      en: ({ word }) => `At the airport, I heard: "${capitalize(word)}."`,
      vi: ({ vi }) => `Ở sân bay, tôi nghe thấy: "${capitalizeVi(vi)}."`,
    },
    {
      en: ({ word }) => `Remember to say "${word.toLowerCase()}" politely.`,
      vi: ({ vi }) => `Hãy nhớ nói "${vi}" một cách lịch sự.`,
    },
    {
      en: ({ word }) => `Every day, I practice saying "${word.toLowerCase()}."`,
      vi: ({ vi }) => `Mỗi ngày, tôi luyện nói "${vi}."`,
    },
  ],
  verb: [
    {
      en: ({ word }) => `I ${word.toLowerCase()} every day after school.`,
      vi: ({ vi }) => `Tôi ${vi} mỗi ngày sau giờ học.`,
    },
    {
      en: ({ word }) => `She likes to ${word.toLowerCase()} with her friends.`,
      vi: ({ vi }) => `Cô ấy thích ${vi} cùng bạn bè.`,
    },
    {
      en: ({ word }) => `They ${word.toLowerCase()} together on weekends.`,
      vi: ({ vi }) => `Họ ${vi} cùng nhau vào cuối tuần.`,
    },
    {
      en: ({ word }) => `Do you ${word.toLowerCase()} English at work?`,
      vi: ({ vi }) => `Bạn có ${vi} tiếng Anh ở nơi làm việc không?`,
    },
  ],
  adjective: [
    {
      en: ({ word }) => `The weather is very ${word.toLowerCase()} today.`,
      vi: ({ vi }) => `Thời tiết hôm nay rất ${vi}.`,
    },
    {
      en: ({ word }) => `That was a ${word.toLowerCase()} idea.`,
      vi: ({ vi }) => `Đó là một ý tưởng ${vi}.`,
    },
    {
      en: ({ word }) => `She looks ${word.toLowerCase()} in that dress.`,
      vi: ({ vi }) => `Cô ấy trông ${vi} trong chiếc váy đó.`,
    },
    {
      en: ({ word }) => `This lesson is not ${word.toLowerCase()} at all.`,
      vi: ({ vi }) => `Bài học này hoàn toàn không ${vi}.`,
    },
  ],
  person: [
    {
      en: ({ word, a }) => `My sister wants to be ${a} ${word.toLowerCase()}.`,
      vi: ({ vi }) => `Chị gái tôi muốn trở thành ${vi}.`,
    },
    {
      en: ({ word, a }) => `The ${word.toLowerCase()} helped us quickly.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} đã giúp chúng tôi rất nhanh.`,
    },
    {
      en: ({ word, a }) => `We met ${a} ${word.toLowerCase()} at the hospital.`,
      vi: ({ vi }) => `Chúng tôi gặp ${vi} ở bệnh viện.`,
    },
  ],
  food: [
    {
      en: ({ word, a }) => `I had ${a} ${word.toLowerCase()} for breakfast.`,
      vi: ({ vi }) => `Tôi đã ăn ${vi} cho bữa sáng.`,
    },
    {
      en: ({ word, a }) => `Would you like ${a} ${word.toLowerCase()}?`,
      vi: ({ vi }) => `Bạn có muốn ${vi} không?`,
    },
    {
      en: ({ word }) => `This ${word.toLowerCase()} tastes delicious.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} này có vị rất ngon.`,
    },
  ],
  place: [
    {
      en: ({ word, a }) => `We cleaned the ${word.toLowerCase()} yesterday.`,
      vi: ({ vi }) => `Hôm qua chúng tôi đã dọn ${vi}.`,
    },
    {
      en: ({ word }) => `The children are playing in the ${word.toLowerCase()}.`,
      vi: ({ vi }) => `Bọn trẻ đang chơi ở ${vi}.`,
    },
    {
      en: ({ word, a }) => `There is ${a} ${word.toLowerCase()} near my school.`,
      vi: ({ vi }) => `Có ${vi} gần trường tôi.`,
    },
  ],
  noun: [
    {
      en: ({ word, a }) => `I bought ${a} ${word.toLowerCase()} yesterday.`,
      vi: ({ vi }) => `Hôm qua tôi đã mua ${vi}.`,
    },
    {
      en: ({ word, a }) => `She showed me ${a} ${word.toLowerCase()}.`,
      vi: ({ vi }) => `Cô ấy cho tôi xem ${vi}.`,
    },
    {
      en: ({ word }) => `We need a new ${word.toLowerCase()}.`,
      vi: ({ vi }) => `Chúng tôi cần ${vi} mới.`,
    },
    {
      en: ({ word }) => `This ${word.toLowerCase()} is very useful.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} này rất hữu ích.`,
    },
    {
      en: ({ word, a }) => `He left ${a} ${word.toLowerCase()} on the table.`,
      vi: ({ vi }) => `Anh ấy để ${vi} trên bàn.`,
    },
    {
      en: ({ word }) => `I forgot my ${word.toLowerCase()} at home.`,
      vi: ({ vi }) => `Tôi quên ${vi} ở nhà.`,
    },
    {
      en: ({ word, a }) => `There is ${a} ${word.toLowerCase()} in my bag.`,
      vi: ({ vi }) => `Trong túi tôi có ${vi}.`,
    },
    {
      en: ({ word }) => `The ${word.toLowerCase()} belongs to my brother.`,
      vi: ({ vi }) => `${capitalizeVi(vi)} thuộc về anh trai tôi.`,
    },
  ],
};

/**
 * @param {{ word: string, wordKey: string, vietnamese_meaning: string, unit?: number, lineNo?: number }} item
 */
export function buildBasicExample(item) {
  const word = String(item.word || item.wordKey || "").trim();
  const wordKey = String(item.wordKey || word).trim().toLowerCase();
  const vi = String(item.vietnamese_meaning || "").trim();

  const custom = lookupCustom(wordKey, vi);
  if (custom) {
    return {
      example_sentence: custom.en,
      example_sentence_vi: custom.vi,
    };
  }

  const category = detectCategory(wordKey, vi);
  const templates = TEMPLATES[category] || TEMPLATES.noun;
  const seed = hashSeed(`${wordKey}|${item.unit || 0}|${item.lineNo || 0}`);
  const template = templates[seed % templates.length];
  const ctx = { word, wordKey, vi, a: article(wordKey) };

  return {
    example_sentence: template.en(ctx),
    example_sentence_vi: template.vi(ctx),
  };
}

export function buildBasicExamples(items) {
  return items.map((item) => ({ ...item, ...buildBasicExample(item) }));
}
