import { IPA_PRACTICE_LESSONS } from "@/lib/ipa-practice-lessons";
import { PASS_SCORE } from "./drill-catalog";

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

const LESSON_TIPS = {
  "short-long-vowels":
    "Phân biệt âm ngắn và dài: /ɪ/ ngắn, /iː/ dài. Giữ miệng thả lỏng với âm ngắn.",
  "v-f-th": "Âm /θ/ và /ð/ đặt lưỡi nhẹ giữa hai hàm răng, thổi hơi ra — không chạm chặt.",
  lr: "Âm /l/ đầu lưỡi chạm vòm miệng; /r/ cuộn lưỡi nhẹ, không lẫn với âm L tiếng Việt.",
  "mn-ng": "Âm cuối /ŋ/ giữ hơi trong họng, không thêm âm /k/ hay /g/ ở cuối.",
  "diph-ai-oy": "Nguyên âm đôi: bắt đầu từ âm đầu, trượt mượt sang âm cuối trong cùng một âm tiết.",
  "ae-ah": "Âm /æ/ mở miệng rộng hơn /ʌ/ — hạ hàm và kéo dài âm ngắn gọn.",
  "phoneme-k": "Âm /k/ phát ở cuối họng, không rung dây thanh — như cat, key, school.",
  "phoneme-g": "Âm /ɡ/ cùng vị trí /k/ nhưng có rung dây thanh — như go, gold, girl.",
  default: "Nghe mẫu trước, đọc chậm từng âm, rồi tăng tốc khi đã quen.",
};

function extractIpaFocus(lesson) {
  if (lesson?.targetPhoneme) return lesson.targetPhoneme;
  const m = String(lesson?.title || "").match(/\/[^/]+\//);
  return m ? m[0] : "/·/";
}

function wordTargetPhoneme(word, lesson) {
  return word.targetPhoneme || lesson.targetPhoneme || null;
}

function formatPhonemeLabel(phoneme) {
  if (!phoneme) return "";
  const p = String(phoneme).trim();
  return p.startsWith("/") ? p : `/${p}/`;
}

function lessonCategories(lessonId) {
  const cats = new Set();
  if (VOWEL_LESSONS.has(lessonId)) cats.add("vowel");
  if (CONSONANT_LESSONS.has(lessonId)) cats.add("consonant");
  if (ENDING_LESSONS.has(lessonId)) cats.add("ending");
  if (!cats.size) cats.add("consonant");
  return [...cats];
}

function lessonLevel(idx) {
  if (idx < 4) return "A1";
  if (idx < 8) return "A2";
  return "B1";
}

function sampleSentence(word) {
  const w = String(word || "").trim();
  const lower = w.toLowerCase();
  if (lower === "hello") return { en: "Hello, how are you?", vi: "Xin chào, bạn khỏe không?" };
  if (lower === "ship") return { en: "The ship is big.", vi: "Con tàu to." };
  if (lower === "think") return { en: "I think so.", vi: "Tôi nghĩ vậy." };
  if (lower === "sing") return { en: "She likes to sing.", vi: "Cô ấy thích hát." };
  if (lower === "sit") return { en: "Sit down, please.", vi: "Mời ngồi." };
  if (lower === "gold") return { en: "Gold is valuable.", vi: "Vàng rất quý." };
  if (lower === "girl") return { en: "The girl is happy.", vi: "Cô gái vui vẻ." };
  if (lower === "go") return { en: "Let's go now.", vi: "Chúng ta đi thôi." };
  if (lower === "cat") return { en: "The cat is small.", vi: "Con mèo nhỏ." };
  return { en: `Practice the word: ${w}.`, vi: `Luyện từ: ${w}.` };
}

export function buildLessonGroups() {
  return IPA_PRACTICE_LESSONS.map((lesson, idx) => {
    const ipaFocus = extractIpaFocus(lesson);
    const words = lesson.words.map((w, wi) => {
      const sample = w.example_sentence
        ? { en: w.example_sentence, vi: sampleSentence(w.word).vi }
        : sampleSentence(w.word);
      const targetPhoneme = wordTargetPhoneme(w, lesson);
      const drillFocus = targetPhoneme ? formatPhonemeLabel(targetPhoneme) : ipaFocus;
      return {
        id: `${lesson.id}__${w.word.toLowerCase()}`,
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        ipaFocus: drillFocus,
        targetPhoneme: drillFocus,
        word: w.word,
        ipa: w.ipa,
        meaning: w.vi,
        example_sentence: w.example_sentence || sample.en,
        sampleSentence: w.example_sentence || sample.en,
        sampleSentenceVi: sample.vi,
        level: lessonLevel(idx),
        categories: lessonCategories(lesson.id),
        order: idx * 100 + wi,
      };
    });
    return {
      id: lesson.id,
      title: lesson.title.replace(/^Âm\s+/, "Âm "),
      ipaFocus,
      targetPhoneme: lesson.targetPhoneme ? formatPhonemeLabel(lesson.targetPhoneme) : ipaFocus,
      phonemeAudioText: lesson.phonemeAudioText,
      exampleWords: lesson.words.map((w) => w.word).join(", "),
      level: lessonLevel(idx),
      categories: lessonCategories(lesson.id),
      tip: LESSON_TIPS[lesson.id] || LESSON_TIPS.default,
      words,
      wordCount: words.length,
    };
  });
}

export function getLessonProgress(group, progressMap) {
  let done = 0;
  let bestSum = 0;
  let bestCount = 0;
  group.words.forEach((w) => {
    const sc = progressMap?.[w.lessonId]?.[w.word.toLowerCase()] || 0;
    if (sc >= PASS_SCORE) done += 1;
    if (sc > 0) {
      bestSum += sc;
      bestCount += 1;
    }
  });
  return {
    done,
    total: group.wordCount,
    avgScore: bestCount ? Math.round(bestSum / bestCount) : null,
  };
}

export function filterLessonGroups(groups, filterId, levelId, progressMap) {
  let list = groups;
  if (levelId && levelId !== "all") {
    list = list.filter((g) => g.level === levelId);
  }
  if (filterId === "all") return list;
  if (filterId === "weak") {
    return list.filter((g) =>
      g.words.some((w) => {
        const sc = progressMap?.[w.lessonId]?.[w.word.toLowerCase()] || 0;
        return sc > 0 && sc < PASS_SCORE;
      })
    );
  }
  return list.filter((g) => g.categories.includes(filterId));
}

export function getTodayLessonGroup(groups, progressMap) {
  const daySeed = new Date().getDate() + new Date().getMonth() * 31;
  const pending = groups.filter((g) => getLessonProgress(g, progressMap).done < g.wordCount);
  const pool = pending.length ? pending : groups;
  return pool[daySeed % pool.length] || groups[0];
}

export function getWeakSoundSymbols(groups, progressMap) {
  const symbols = new Set();
  groups.forEach((g) => {
    g.words.forEach((w) => {
      const sc = progressMap?.[w.lessonId]?.[w.word.toLowerCase()] || 0;
      if (sc > 0 && sc < PASS_SCORE) symbols.add(g.ipaFocus);
    });
  });
  return [...symbols].slice(0, 5);
}

export function countRetryWords(groups, progressMap) {
  let n = 0;
  groups.forEach((g) => {
    g.words.forEach((w) => {
      const sc = progressMap?.[w.lessonId]?.[w.word.toLowerCase()] || 0;
      if (sc > 0 && sc < PASS_SCORE) n += 1;
    });
  });
  return n;
}

export const PRON_LEVELS = [
  { id: "all", label: "Tất cả" },
  { id: "A1", label: "A1" },
  { id: "A2", label: "A2" },
  { id: "B1", label: "B1" },
];
