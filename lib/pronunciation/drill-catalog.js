import { IPA_PRACTICE_LESSONS } from "@/lib/ipa-practice-lessons";

export const PASS_SCORE = 65;

export const PRON_FILTERS = [
  { id: "all", label: "Tất cả" },
  { id: "vowel", label: "Nguyên âm" },
  { id: "consonant", label: "Phụ âm" },
  { id: "ending", label: "Âm cuối" },
  { id: "stress", label: "Trọng âm" },
  { id: "short_sentence", label: "Câu ngắn" },
  { id: "weak", label: "Từ dễ sai" },
];

const VOWEL_LESSONS = new Set(["diph-ai-oy", "short-long-vowels", "ae-ah"]);
const ENDING_LESSONS = new Set(["mn-ng"]);
const CONSONANT_LESSONS = new Set([
  "lr",
  "v-f-th",
  "s-z-sh",
  "t-d",
  "p-b",
  "phoneme-k",
  "phoneme-g",
  "h-w-j",
  "ch-j",
]);

function sampleSentence(word) {
  const w = String(word || "").trim();
  if (!w) return "";
  const lower = w.toLowerCase();
  if (lower === "hello") return "Hello, how are you?";
  if (lower === "think") return "I think so.";
  if (lower === "sing") return "She likes to sing.";
  return `Practice: ${w}.`;
}

function drillLevel(lessonIndex) {
  if (lessonIndex < 4) return "Cơ bản";
  if (lessonIndex < 8) return "Trung bình";
  return "Nâng cao";
}

function baseCategories(lessonId, ipa) {
  const cats = new Set();
  if (VOWEL_LESSONS.has(lessonId)) cats.add("vowel");
  if (CONSONANT_LESSONS.has(lessonId)) cats.add("consonant");
  if (ENDING_LESSONS.has(lessonId)) cats.add("ending");
  if (String(ipa || "").includes("ˈ")) cats.add("stress");
  if (String(ipa || "").split(/[.\s]/).filter(Boolean).length >= 3) cats.add("short_sentence");
  if (!cats.size) cats.add("consonant");
  return [...cats];
}

/** @returns {import('./drill-catalog').PronDrillItem[]} */
export function buildDrillCatalog() {
  const items = [];
  IPA_PRACTICE_LESSONS.forEach((lesson, lessonIndex) => {
    lesson.words.forEach((w, wordIndex) => {
      const targetPhoneme = w.targetPhoneme || lesson.targetPhoneme || null;
      const ipaFocus = targetPhoneme
        ? targetPhoneme.startsWith("/")
          ? targetPhoneme
          : `/${targetPhoneme}/`
        : null;
      items.push({
        id: `${lesson.id}__${w.word.toLowerCase()}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        word: w.word,
        ipa: w.ipa,
        meaning: w.vi,
        targetPhoneme: ipaFocus,
        ipaFocus,
        sampleSentence: sampleSentence(w.word),
        level: drillLevel(lessonIndex),
        categories: baseCategories(lesson.id, w.ipa),
        order: lessonIndex * 100 + wordIndex,
      });
    });
  });
  return items;
}

export function filterDrills(drills, filterId, progressMap) {
  if (filterId === "all") return drills;
  if (filterId === "weak") {
    return drills.filter((d) => {
      const score = progressMap?.[d.lessonId]?.[d.word.toLowerCase()] || 0;
      return score > 0 && score < PASS_SCORE;
    });
  }
  return drills.filter((d) => d.categories.includes(filterId));
}

export function getTodayDrill(drills, progressMap) {
  const today = new Date();
  const daySeed = today.getFullYear() * 1000 + today.getMonth() * 50 + today.getDate();
  const pending = drills.filter((d) => {
    const score = progressMap?.[d.lessonId]?.[d.word.toLowerCase()] || 0;
    return score < PASS_SCORE;
  });
  const pool = pending.length ? pending : drills;
  return pool[daySeed % pool.length] || drills[0] || null;
}

export function getWeakDrills(drills, progressMap) {
  return filterDrills(drills, "weak", progressMap);
}

export function getRetryDrills(drills, progressMap) {
  return drills
    .filter((d) => {
      const score = progressMap?.[d.lessonId]?.[d.word.toLowerCase()] || 0;
      return score > 0 && score < PASS_SCORE;
    })
    .sort((a, b) => {
      const sa = progressMap[a.lessonId]?.[a.word.toLowerCase()] || 0;
      const sb = progressMap[b.lessonId]?.[b.word.toLowerCase()] || 0;
      return sa - sb;
    });
}

export function getSoundFocus(drills, progressMap) {
  const weak = getWeakDrills(drills, progressMap);
  if (!weak.length) return drills[0] || null;
  const counts = {};
  weak.forEach((d) => {
    counts[d.lessonId] = (counts[d.lessonId] || 0) + 1;
  });
  const topLesson = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  return weak.find((d) => d.lessonId === topLesson) || weak[0];
}
