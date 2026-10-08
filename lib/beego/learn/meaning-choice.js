/**
 * Meaning-choice content for the existing multiple_choice exercise.
 * Does not grade, store attempts, or touch listening picture questions.
 */

const STOP = new Set(["của", "và", "là", "một", "những", "trong", "cho", "với", "your", "the"]);

function tidy(value) {
  return String(value || "")
    .trim()
    .replace(/[.?!]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function contentWords(value) {
  return tidy(value)
    .toLowerCase()
    .split(/[^a-z0-9à-ỹđ]+/i)
    .filter((word) => word.length > 3 && !STOP.has(word));
}

function tooClose(correct, other) {
  const a = tidy(correct).toLowerCase();
  const b = tidy(other).toLowerCase();
  if (!a || !b || a === b) return true;
  if (a.includes(b) || b.includes(a)) return true;
  const left = new Set(contentWords(a));
  return contentWords(b).some((word) => left.has(word));
}

function shuffle(arr, seed) {
  const out = [...arr];
  let s = Math.abs(Number(seed) || 1);
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function pickSimilarDistractors(correct, pool, seed, n = 3) {
  const target = tidy(correct);
  const unique = [];
  const seen = new Set();
  for (const item of pool || []) {
    const text = tidy(item);
    const key = text.toLowerCase();
    if (!text || seen.has(key) || tooClose(target, text)) continue;
    seen.add(key);
    unique.push(text);
  }
  const limit = Math.max(4, Math.round(target.length * 0.35));
  const band = unique.filter((text) => Math.abs(text.length - target.length) <= limit);
  const source = band.length >= n ? band : unique;
  return shuffle(source, seed).slice(0, n);
}

const SENSES = {
  letter: {
    context: "I write a letter to my friend.",
    vi: "lá thư",
    distractors: ["chữ cái", "số đếm", "lời chào"],
    explanation: "Trong câu này letter là lá thư. Chữ cái là một nghĩa khác, không đúng ở đây.",
  },
  change: {
    context: "Here is your change.",
    vi: "tiền thừa",
    distractors: ["thay đổi", "hóa đơn", "cửa hàng"],
    explanation: "Trong câu này change là tiền thừa. Thay đổi là một nghĩa khác.",
  },
};

const SAMPLES = {
  1: {
    en: "How are you?",
    vi: "Bạn khỏe không",
    distractors: ["Chào buổi sáng", "Hẹn gặp lại", "Cảm ơn bạn"],
    explanation: "How are you hỏi sức khỏe, không phải chào, tạm biệt hay cảm ơn.",
  },
  2: {
    en: "I brush my teeth.",
    vi: "Tôi đánh răng",
    distractors: ["Tôi rửa mặt", "Tôi uống cà phê", "Tôi ăn sáng"],
    explanation: "Câu này nói về đánh răng, không phải rửa mặt, cà phê hay ăn sáng.",
  },
  3: {
    en: "How much is this?",
    vi: "Cái này bao nhiêu",
    distractors: ["Cái này rẻ", "Tôi muốn mua", "Cho tôi hóa đơn"],
    explanation: "How much hỏi giá. Các câu kia nói về rẻ, muốn mua hoặc hóa đơn.",
  },
  4: {
    en: "This is my mother.",
    vi: "Đây là mẹ tôi",
    distractors: ["Đây là bố tôi", "Đây là anh tôi", "Đây là nhà tôi"],
    explanation: "Mother trong câu này là mẹ, không phải bố, anh hay nhà.",
  },
  5: {
    en: "She works in an office.",
    vi: "Cô ấy làm việc ở văn phòng",
    distractors: ["Cô ấy gửi email", "Cô ấy họp sáng", "Cô ấy nghỉ hôm nay"],
    explanation: "Câu nói nơi làm việc là văn phòng, không nói về email, họp hay nghỉ.",
  },
  6: {
    en: "I need to book a room.",
    vi: "Tôi cần đặt phòng",
    distractors: ["Tôi cần hộ chiếu", "Tôi cần vé tàu", "Tôi cần bản đồ"],
    explanation: "Trong câu này book là đặt. Đặt phòng khác với hộ chiếu, vé hay bản đồ.",
  },
  7: {
    en: "Please read the minutes.",
    vi: "Hãy đọc biên bản",
    distractors: ["Hãy đọc thư", "Hãy đọc lịch", "Hãy đọc hóa đơn"],
    explanation: "Trong câu này minutes là biên bản cuộc họp, không phải thư, lịch hay hóa đơn.",
  },
  8: {
    en: "I agree. However, I have one question.",
    vi: "Tôi đồng ý, nhưng tôi có một câu hỏi",
    distractors: ["Tôi phản đối câu này", "Tôi không có ý kiến", "Tôi kết thúc buổi nói"],
    explanation: "However báo một ý khác sau khi đồng ý. Không có nghĩa là phản đối hay kết thúc.",
  },
};

export function senseForWord(en) {
  return SENSES[String(en || "").trim().toLowerCase()] || null;
}

export function meaningSampleForPart(partNumber) {
  return SAMPLES[Number(partNumber)] || null;
}

export function prepareEnToViMeaning({ stimulus, correct, pool, seed, context, explanation, distractors }) {
  const vi = tidy(correct);
  const wrongs =
    Array.isArray(distractors) && distractors.length >= 3
      ? distractors.map(tidy).filter((item) => !tooClose(vi, item)).slice(0, 3)
      : pickSimilarDistractors(vi, pool, seed, 3);
  const safeWrongs = wrongs.length >= 3 ? wrongs : pickSimilarDistractors(vi, pool, seed, 3);
  const english = String(context || stimulus || "").replace(/\s+/g, " ").trim();
  const word = String(stimulus || "").replace(/\s+/g, " ").trim();
  const prompt = context
    ? `Trong câu “${tidy(context)}”, “${word}” nghĩa là gì?`
    : `"${word}" nghĩa là gì?`;
  const contrast = tidy(safeWrongs[0] || "");
  const text =
    explanation ||
    (context
      ? `Trong câu này «${word}» nghĩa là «${vi}», không phải «${contrast}».`
      : `«${word}» nghĩa là «${vi}», không phải «${contrast}».`);
  return {
    prompt,
    correct: vi,
    wrongs: safeWrongs,
    explanation: text,
    ttsText: english,
    direction: "en-to-vi",
  };
}

export function prepareViToEnMeaning({ vi, correct, pool, seed }) {
  const meaning = tidy(vi);
  const answer = tidy(correct);
  const wrongs = pickSimilarDistractors(answer, (pool || []).map(tidy), seed, 3);
  return {
    prompt: `Câu nào đúng cho «${meaning}»?`,
    correct: answer,
    wrongs,
    explanation: `«${meaning}» nói là “${answer}”. Các câu kia cùng chủ đề nhưng không đúng nghĩa này.`,
    ttsText: "",
    direction: "vi-to-en",
  };
}
