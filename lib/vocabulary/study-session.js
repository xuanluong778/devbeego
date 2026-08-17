/** Vocabulary study session — steps, options, scoring helpers. */

import { applySrsRating } from "@/lib/srs/update-srs";
import { normalizeAnswerType, SRS_ANSWER_TYPES } from "@/lib/srs/srs-types";
import {
  getGuestProgress,
  saveGuestProgress,
  getGuestSessionWordIds,
} from "@/lib/vocabulary/guest-srs";
import { defaultProgressRow } from "@/lib/srs/srs-types";

export const SESSION_SIZE = 10;

export const STUDY_STEPS = [
  { id: "intro", label: "Xem từ", icon: "👀" },
  { id: "listen_word", label: "Nghe từ", icon: "🔊" },
  { id: "listen_sentence", label: "Nghe câu", icon: "🎧" },
  { id: "choose_meaning", label: "Chọn nghĩa", icon: "✅" },
  { id: "fill_blank", label: "Điền từ", icon: "✏️" },
  { id: "speak", label: "Luyện nói", icon: "🎤" },
  { id: "rate", label: "Đánh giá", icon: "⭐" },
];

export const RATING_OPTIONS = [
  { id: "forgot", label: "Chưa nhớ", tone: "forgot", isCorrect: false },
  { id: "hard", label: "Khó", tone: "hard", isCorrect: false },
  { id: "normal", label: "Bình thường", tone: "normal", isCorrect: true },
  { id: "easy", label: "Dễ", tone: "easy", isCorrect: true },
];

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Nghĩa dự phòng khi pool API quá ít — vẫn là tiếng Việt thật, không dùng placeholder. */
const FALLBACK_VI_MEANINGS = [
  "ngôi nhà",
  "con mèo",
  "bữa sáng",
  "đi học",
  "màu đỏ",
  "bạn bè",
  "quả táo",
  "xe buýt",
  "nước uống",
  "gia đình",
  "công việc",
  "thời tiết",
  "bệnh viện",
  "thư viện",
  "bãi biển",
];

function collectMeaningDistractors(word, pool) {
  const correct = String(word.vietnamese_meaning || "").trim();
  const others = pool.filter((w) => w.id !== word.id);

  const fromSameTopic = word.topic
    ? others.filter((w) => w.topic === word.topic)
    : [];
  const candidateSets = [
    fromSameTopic.length >= 3 ? fromSameTopic : null,
    others,
    pool,
  ].filter(Boolean);

  const unique = [];
  const seen = new Set();
  for (const set of candidateSets) {
    for (const row of set) {
      const meaning = String(row.vietnamese_meaning || "").trim();
      if (!meaning || meaning === correct || seen.has(meaning)) continue;
      seen.add(meaning);
      unique.push(meaning);
      if (unique.length >= 12) break;
    }
    if (unique.length >= 3) break;
  }
  return unique;
}

export function buildMeaningOptions(word, pool) {
  const correct = String(word.vietnamese_meaning || "").trim();
  const unique = collectMeaningDistractors(word, pool);
  const wrong = shuffle(unique).slice(0, 3);

  for (const meaning of shuffle(FALLBACK_VI_MEANINGS)) {
    if (wrong.length >= 3) break;
    if (meaning !== correct && !wrong.includes(meaning)) wrong.push(meaning);
  }

  return shuffle([correct, ...wrong.slice(0, 3)]);
}

function normalizeWord(input) {
  return String(input || "")
    .toLowerCase()
    .replace(/[^a-z'\s-]/g, "")
    .trim();
}

export function buildWordOptions(word, pool) {
  const correct = String(word.word || "").trim();
  let candidates = pool.filter((w) => w.id !== word.id);
  if (word.topic) {
    const sameTopic = candidates.filter((w) => w.topic === word.topic);
    if (sameTopic.length >= 3) candidates = sameTopic;
  }
  const distractors = candidates
    .map((w) => String(w.word || "").trim())
    .filter((w) => w && w.toLowerCase() !== correct.toLowerCase());
  const unique = [...new Set(distractors)];
  const wrong = shuffle(unique).slice(0, 3);
  while (wrong.length < 3) {
    wrong.push(`word-${wrong.length + 1}`);
  }
  return shuffle([correct, ...wrong.slice(0, 3)]);
}

export function buildFillBlankPrompt(sentence, word) {
  const w = String(word || "").trim();
  const s = String(sentence || "").trim();
  if (!w || !s) return { display: s, answer: w };
  const re = new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i");
  if (!re.test(s)) {
    return { display: s.replace(/\b\w+\b/, "______"), answer: w };
  }
  return {
    display: s.replace(re, "______"),
    answer: w,
  };
}

export function checkFillBlank(input, answer) {
  return normalizeWord(input) === normalizeWord(answer);
}

export function checkMeaningChoice(selected, word) {
  return String(selected || "").trim() === String(word.vietnamese_meaning || "").trim();
}

export function speakPassScore(score) {
  return Number(score) >= 65;
}

export function ratingMeta(ratingId) {
  return RATING_OPTIONS.find((r) => r.id === ratingId) || RATING_OPTIONS[2];
}

export function createWordResult(word) {
  return {
    wordId: word.id,
    word: word.word,
    meaning: word.vietnamese_meaning,
    steps: {},
    rating: null,
    xpDelta: 0,
    needsReview: false,
    correctCount: 0,
    wrongCount: 0,
  };
}

export function tallySessionResults(results) {
  let correct = 0;
  let wrong = 0;
  let xp = 0;
  const reviewAgain = [];
  for (const r of results) {
    const stepCorrect = Object.values(r.steps).filter((s) => s?.ok).length;
    const stepWrong = Object.values(r.steps).filter((s) => s && !s.ok).length;
    if (r.rating?.isCorrect) correct += 1;
    else wrong += 1;
    xp += Number(r.xpDelta || 0);
    if (!r.rating?.isCorrect || r.needsReview) {
      reviewAgain.push(r);
    }
  }
  return {
    total: results.length,
    correct,
    wrong,
    xp,
    reviewAgain,
  };
}

const XP_BY_ANSWER = {
  [SRS_ANSWER_TYPES.FORGOT]: 0,
  [SRS_ANSWER_TYPES.HARD]: 5,
  [SRS_ANSWER_TYPES.NORMAL]: 10,
  [SRS_ANSWER_TYPES.EASY]: 12,
  [SRS_ANSWER_TYPES.MASTERED]: 15,
};

async function fetchWordsByIds(ids, { level = "beginner", topic = "" } = {}) {
  if (!ids.length) return [];
  const params = new URLSearchParams({
    page: "1",
    limit: String(Math.max(ids.length, SESSION_SIZE)),
    level,
    study_filter: "saved",
    bookmark_ids: ids.join(","),
  });
  if (topic) params.set("topic", topic);
  const res = await fetch(`/api/vocabulary?${params.toString()}`, {
    cache: "no-store",
    credentials: "same-origin",
  });
  const json = await res.json();
  if (!res.ok || !json.success || !Array.isArray(json.data)) return [];
  const order = new Map(ids.map((id, i) => [id, i]));
  return [...json.data].sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
}

export async function fetchStudySessionWords({ mode = "learn", topic = "", level = "beginner" }) {
  const filters =
    mode === "review"
      ? ["review_today"]
      : mode === "weak"
      ? ["difficult"]
      : ["not_learned", "learning"];

  for (const studyFilter of filters) {
    const params = new URLSearchParams({
      page: "1",
      limit: String(SESSION_SIZE),
      level,
      study_filter: studyFilter,
    });
    if (topic) params.set("topic", topic);

    const res = await fetch(`/api/vocabulary?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = await res.json();
    if (json.auth_required) {
      const guestIds = getGuestSessionWordIds(mode, SESSION_SIZE);
      if (guestIds.length) {
        const words = await fetchWordsByIds(guestIds, { level, topic });
        if (words.length) return { words: words.slice(0, SESSION_SIZE), filter: studyFilter, guest: true };
      }
      if (mode === "learn") break;
      return { authRequired: false, words: [], empty: true, filter: studyFilter, guest: true };
    }
    if (res.ok && json.success && Array.isArray(json.data) && json.data.length) {
      return { words: json.data.slice(0, SESSION_SIZE), filter: studyFilter };
    }
  }

  if (mode === "learn") {
    const params = new URLSearchParams({ page: "1", limit: String(SESSION_SIZE * 3), level });
    if (topic) params.set("topic", topic);
    const res = await fetch(`/api/vocabulary?${params.toString()}`, { cache: "no-store" });
    const json = await res.json();
    if (res.ok && json.success && json.data?.length) {
      const poolWords = shuffle(json.data).filter((w) => {
        const row = getGuestProgress(w.id);
        return !row || row.status === "new";
      });
      const picked = poolWords.length ? poolWords : shuffle(json.data);
      return { words: picked.slice(0, SESSION_SIZE), filter: "all", guest: true };
    }
  }

  return { words: [], empty: true, filter: filters[0] };
}

/** Lấy pool từ vựng làm đáp án nhiễu (ưu tiên cùng topic/level). */
export async function fetchDistractorPool({
  level = "beginner",
  topic = "",
  seedWords = [],
  limit = 48,
} = {}) {
  const pool = [...seedWords];
  const seen = new Set(pool.map((w) => w.id));

  async function appendFromApi(topicFilter) {
    const params = new URLSearchParams({
      page: "1",
      limit: String(limit),
      level,
      study_filter: "all",
    });
    if (topicFilter) params.set("topic", topicFilter);
    const res = await fetch(`/api/vocabulary?${params.toString()}`, {
      cache: "no-store",
      credentials: "same-origin",
    });
    const json = await res.json();
    if (!res.ok || !json.success || !Array.isArray(json.data)) return;
    for (const row of json.data) {
      if (!seen.has(row.id)) {
        seen.add(row.id);
        pool.push(row);
      }
    }
  }

  try {
    await appendFromApi(topic);
    if (pool.length < 12 && topic) {
      await appendFromApi("");
    }
  } catch {
    /* giữ seedWords */
  }

  return pool;
}

/** Fetch words + distractor pool for practice modes (same level/topic). */
export async function fetchPracticeSession({ practiceMode = "flashcard", topic = "", level = "beginner" }) {
  const studyMode = practiceMode === "weak_words" ? "weak" : "learn";
  const session = await fetchStudySessionWords({ mode: studyMode, topic, level });
  if (!session.words?.length) {
    return { words: [], pool: [], empty: session.empty, guest: session.guest };
  }

  const pool = await fetchDistractorPool({
    level,
    topic,
    seedWords: session.words,
    limit: 48,
  });

  return {
    words: session.words,
    pool,
    empty: false,
    guest: session.guest,
    filter: session.filter,
  };
}

function saveGuestRating(wordId, ratingId, pronunciationScore) {
  const answerType = normalizeAnswerType(ratingId, ratingMeta(ratingId).isCorrect);
  const prev = getGuestProgress(wordId) || defaultProgressRow();
  const next = applySrsRating(prev, answerType, {
    pronunciationScore: pronunciationScore != null ? Number(pronunciationScore) : null,
  });
  saveGuestProgress(wordId, next);
  const xpDelta = XP_BY_ANSWER[answerType] ?? 0;
  return {
    progress: next,
    stats: { xp_delta: xpDelta, xp_total: 0, current_streak: 0, level: 1 },
    guest: true,
  };
}

export async function submitWordRating(wordId, ratingId, attemptId, options = {}) {
  const res = await fetch("/api/review/result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({
      word_id: wordId,
      answer_type: ratingId,
      pronunciation_score: options.pronunciationScore ?? null,
      attempt_id: attemptId,
    }),
  });
  const json = await res.json();
  if (res.status === 401) {
    return saveGuestRating(wordId, ratingId, options.pronunciationScore);
  }
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Không lưu được kết quả.");
  }
  return json.data;
}

export function playAudioUrl(url, fallbackText) {
  if (url) {
    const audio = new Audio(url);
    audio.play().catch(() => speakText(fallbackText));
    return;
  }
  speakText(fallbackText);
}

export function speakText(text) {
  if (typeof window === "undefined" || !text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  window.speechSynthesis.speak(u);
}
