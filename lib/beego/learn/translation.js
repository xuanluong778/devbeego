/**
 * Bidirectional translation for Learn.
 * Form is normalized, but Vietnamese diacritics and meaning stay intact.
 * Only compiled answers are accepted. This is not an open translator.
 */

function tidy(value) {
  return String(value || "")
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeTranslationText(value) {
  return tidy(value)
    .toLowerCase()
    .replace(/[.!?,;:]+$/g, "")
    .trim();
}

function asText(answer) {
  if (Array.isArray(answer)) return answer.map((part) => String(part ?? "")).join(" ");
  if (answer && typeof answer === "object") return String(answer.text ?? answer.value ?? "");
  return String(answer ?? "");
}

export function gradeTranslation(exercise, answer) {
  const given = normalizeTranslationText(asText(answer));
  if (!given) return false;
  const compiled = Array.isArray(exercise?.acceptedAnswers) && exercise.acceptedAnswers.length
    ? exercise.acceptedAnswers
    : [exercise?.correctAnswer];
  return compiled.some((item) => normalizeTranslationText(asText(item)) === given);
}

const CURATED = [
  {
    en: ["My name is Beego", "I am Beego", "I'm Beego"],
    vi: ["Tôi tên là Beego", "Tôi là Beego", "Tên tôi là Beego"],
    enModel: "My name is Beego.",
    viModel: "Tôi tên là Beego.",
    context: "",
    explanation: "Có thể nói tên bằng My name is hoặc I am. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
  },
  {
    en: ["How are you"],
    vi: ["Bạn khỏe không", "Bạn có khỏe không"],
    enModel: "How are you?",
    viModel: "Bạn khỏe không?",
    context: "Nói với một bạn.",
    explanation: "Câu này hỏi sức khỏe của một người. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
  },
  {
    en: ["I am fine", "I'm fine", "I am well", "I'm well"],
    vi: ["Tôi khỏe", "Tôi ổn", "Mình khỏe"],
    enModel: "I am fine.",
    viModel: "Tôi khỏe.",
    context: "",
    explanation: "fine và well đều nói là khỏe hoặc ổn. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
  },
  {
    en: ["I write a letter"],
    vi: ["Tôi viết một lá thư"],
    enModel: "I write a letter.",
    viModel: "Tôi viết một lá thư.",
    context: "Trong câu này letter là thư gửi bạn, không phải chữ cái.",
    explanation: "letter ở đây là lá thư. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
  },
  {
    en: ["What is your name", "What's your name"],
    vi: ["Bạn tên gì", "Tên bạn là gì"],
    enModel: "What is your name?",
    viModel: "Bạn tên gì?",
    context: "Hỏi tên một người.",
    explanation: "What is và What's cùng hỏi tên. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
  },
];

function sameCompiled(left, right) {
  return normalizeTranslationText(left) === normalizeTranslationText(right);
}

export function curatedTranslation(phrase) {
  const en = phrase?.en || "";
  const vi = phrase?.vi || "";
  return CURATED.find((item) => item.en.some((line) => sameCompiled(line, en)) || item.vi.some((line) => sameCompiled(line, vi))) || null;
}

function sentenceTokens(sentence) {
  return tidy(sentence)
    .replace(/[.!?,;:]+$/g, "")
    .split(" ")
    .filter(Boolean);
}

function tileBank(accepted, distractors) {
  const tokens = [];
  const seen = new Set();
  for (const sentence of accepted) {
    for (const token of sentenceTokens(sentence)) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      tokens.push(token);
    }
  }
  for (const extra of distractors || []) {
    const token = tidy(extra);
    if (!token || token.includes(" ") || seen.has(token.toLowerCase())) continue;
    seen.add(token.toLowerCase());
    tokens.push(token);
    if (tokens.length >= sentenceTokens(accepted[0]).length + 3) break;
  }
  return tokens;
}

export function buildTranslationExercise(phrase, direction, { partNumber = 1, distractors = [] } = {}) {
  const curated = curatedTranslation(phrase);
  const en = curated?.en || [tidy(phrase?.en).replace(/[.!?,;:]+$/g, "")];
  const vi = curated?.vi || [tidy(phrase?.vi).replace(/[.!?,;:]+$/g, "")];
  if (!en[0] || !vi[0]) return null;
  const toEnglish = direction === "vi-to-en";
  const accepted = toEnglish ? en : vi;
  const inputMode = Number(partNumber) <= 4 ? "tiles" : "text";
  const sourceText = toEnglish ? curated?.viModel || phrase.vi : curated?.enModel || phrase.en;
  const modelSentence = toEnglish ? curated?.enModel || en[0] : curated?.viModel || vi[0];
  return {
    direction,
    inputMode,
    sourceText: tidy(sourceText),
    context: curated?.context || "",
    accepted,
    modelSentence: tidy(modelSentence),
    speakText: tidy(curated?.enModel || phrase.en),
    explanation: curated?.explanation || "Bài chấm các câu đã biên soạn. Đây là một cách nói tự nhiên, không phải cách đúng duy nhất.",
    wordBank: inputMode === "tiles" ? tileBank(accepted, distractors) : [],
    correctAnswer: inputMode === "tiles" ? sentenceTokens(accepted[0]) : accepted[0],
  };
}
