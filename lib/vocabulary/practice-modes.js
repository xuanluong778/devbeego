/** Vocabulary practice mode definitions & question builders. */

import { buildMeaningOptions } from "./study-session.js";

export const PRACTICE_MODES = [
  {
    id: "flashcard",
    label: "Flashcard",
    icon: "🃏",
    desc: "Lật thẻ — xem từ, nghĩa và ví dụ",
    accent: "violet",
    studyMode: "learn",
  },
  {
    id: "multiple_choice",
    label: "Multiple Choice",
    icon: "✅",
    desc: "Chọn nghĩa tiếng Việt đúng trong 4 đáp án",
    accent: "blue",
    studyMode: "learn",
  },
  {
    id: "listen_choose",
    label: "Listen & Choose",
    icon: "🎧",
    desc: "Nghe phát âm trước, rồi chọn từ tiếng Anh đúng",
    accent: "cyan",
    studyMode: "learn",
  },
  {
    id: "fill_blank",
    label: "Fill in Blank",
    icon: "✏️",
    desc: "Điền từ còn thiếu vào câu ví dụ",
    accent: "amber",
    studyMode: "learn",
  },
  {
    id: "speak_word",
    label: "Speak Word",
    icon: "🎤",
    desc: "Nói lại từ tiếng Anh — chấm phát âm cơ bản",
    accent: "rose",
    studyMode: "learn",
  },
  {
    id: "speak_sentence",
    label: "Speak Sentence",
    icon: "🗣️",
    desc: "Nói lại câu ví dụ — chấm phát âm cơ bản",
    accent: "pink",
    studyMode: "learn",
  },
  {
    id: "word_match",
    label: "Word Match",
    icon: "🔗",
    desc: "Ghép từ tiếng Anh với nghĩa tiếng Việt",
    accent: "green",
    studyMode: "learn",
  },
  {
    id: "weak_words",
    label: "Weak Words",
    icon: "💪",
    desc: "Chỉ luyện các từ bạn hay sai hoặc chưa nhớ",
    accent: "rose",
    studyMode: "weak",
    statKey: "weak_count",
  },
];

export const WORD_MATCH_SIZE = 6;

export function getPracticeMode(id) {
  return PRACTICE_MODES.find((m) => m.id === id) || PRACTICE_MODES[0];
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function poolCandidates(word, pool) {
  let candidates = pool.filter((w) => w.id !== word.id);
  if (word.topic) {
    const sameTopic = candidates.filter((w) => w.topic === word.topic);
    if (sameTopic.length >= 3) candidates = sameTopic;
  }
  return candidates;
}

/** 4 Vietnamese meanings — ưu tiên cùng topic/level qua pool. */
export function buildMeaningOptionsFromPool(word, pool) {
  return buildMeaningOptions(word, pool);
}

/** 4 English words — ưu tiên cùng topic/level qua pool. */
export function buildWordOptionsFromPool(word, pool) {
  const correct = String(word.word || "").trim();
  const distractors = poolCandidates(word, pool)
    .map((w) => String(w.word || "").trim())
    .filter((w) => w && w.toLowerCase() !== correct.toLowerCase());
  const unique = [...new Set(distractors)];
  const wrong = shuffle(unique).slice(0, 3);
  while (wrong.length < 3) {
    wrong.push(`word-${wrong.length + 1}`);
  }
  return shuffle([correct, ...wrong.slice(0, 3)]);
}

/** Pairs for Word Match mode. */
export function buildMatchRound(words, size = WORD_MATCH_SIZE) {
  const picked = shuffle(words).slice(0, Math.min(size, words.length));
  const pairs = picked.map((w) => ({
    id: w.id,
    word: String(w.word || "").trim(),
    meaning: String(w.vietnamese_meaning || "").trim(),
  }));
  return {
    pairs,
    words: shuffle(pairs.map((p) => ({ id: p.id, text: p.word }))),
    meanings: shuffle(pairs.map((p) => ({ id: p.id, text: p.meaning }))),
  };
}

export function tallyPracticeResults(results) {
  const correct = results.filter((r) => r.ok).length;
  return {
    total: results.length,
    correct,
    wrong: results.length - correct,
    accuracy: results.length ? Math.round((correct / results.length) * 100) : 0,
    missed: results.filter((r) => !r.ok),
  };
}
