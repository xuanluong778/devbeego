/**
 * Phần thưởng Beego Kids — localStorage, không cần đăng nhập.
 * Tích hợp với kids_vocab_progress_v1.
 */

import { KIDS_VOCAB_LESSONS } from "@/lib/kids-vocabulary/curriculum";
import { lessonCompletionCount, loadAllProgress } from "@/lib/kids-vocabulary/progress";

const STORAGE_KEY = "kids_rewards_v1";
const STORY_KEY = "kids_story_progress_v1";

const BADGE_DEFS = [
  { id: "first_lesson", emoji: "🌟", label: "Bài đầu tiên", needStars: 10 },
  { id: "word_master", emoji: "📚", label: "Bậc thầy từ", needStars: 50 },
  { id: "story_fan", emoji: "📖", label: "Mê truyện", needStories: 3 },
  { id: "streak_3", emoji: "🔥", label: "3 ngày liên tiếp", needStreak: 3 },
  { id: "streak_7", emoji: "🏆", label: "7 ngày liên tiếp", needStreak: 7 },
  { id: "speaker", emoji: "🎙️", label: "Bé nói giỏi", needStars: 30 },
];

const STICKER_DEFS = ["🐝", "🌈", "⭐", "🎈", "🦋", "🍎", "🐶", "🚀", "🎨", "🌸"];

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function safeParse(raw) {
  try {
    const o = JSON.parse(raw);
    return o && typeof o === "object" ? o : {};
  } catch {
    return {};
  }
}

export function loadRewards() {
  if (typeof window === "undefined") {
    return defaultRewards();
  }
  const raw = safeParse(window.localStorage.getItem(STORAGE_KEY) || "{}");
  return { ...defaultRewards(), ...raw };
}

function defaultRewards() {
  return {
    stars: 0,
    stickers: [],
    badges: [],
    pet: { name: "BeeBee", level: 1, happiness: 70 },
    streak: { count: 0, lastDate: "" },
    pronunciationScores: [],
    lessonsCompleted: [],
    gamesPlayed: {},
  };
}

export function saveRewards(data) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  try {
    window.dispatchEvent(new Event("kids_rewards_updated"));
  } catch (_e) {}
}

export function addStars(amount, reason) {
  const r = loadRewards();
  r.stars = Math.max(0, (Number(r.stars) || 0) + amount);
  syncBadges(r);
  saveRewards(r);
  return { stars: r.stars, reason };
}

export function recordLessonComplete(lessonId, starsEarned = 3) {
  const r = loadRewards();
  if (!r.lessonsCompleted.includes(lessonId)) {
    r.lessonsCompleted.push(lessonId);
  }
  r.stars = (Number(r.stars) || 0) + starsEarned * 5;
  touchStreak(r);
  maybeAddSticker(r);
  syncBadges(r);
  bumpPetHappiness(r, 8);
  saveRewards(r);
}

export function recordGamePlayed(gameId) {
  const r = loadRewards();
  r.gamesPlayed[gameId] = (Number(r.gamesPlayed[gameId]) || 0) + 1;
  r.stars = (Number(r.stars) || 0) + 2;
  touchStreak(r);
  syncBadges(r);
  saveRewards(r);
}

export function recordPronunciationScore(score) {
  const r = loadRewards();
  const s = Math.max(0, Math.min(100, Number(score) || 0));
  r.pronunciationScores = [...(r.pronunciationScores || []), s].slice(-20);
  if (s >= 70) r.stars = (Number(r.stars) || 0) + 1;
  syncBadges(r);
  saveRewards(r);
}

export function loadStoryProgress() {
  if (typeof window === "undefined") return { completed: [] };
  return safeParse(window.localStorage.getItem(STORY_KEY) || "{}");
}

export function recordStoryComplete(storyId) {
  const sp = loadStoryProgress();
  const completed = sp.completed || [];
  if (!completed.includes(storyId)) completed.push(storyId);
  window.localStorage.setItem(STORY_KEY, JSON.stringify({ completed }));

  const r = loadRewards();
  r.stars = (Number(r.stars) || 0) + 8;
  touchStreak(r);
  maybeAddSticker(r);
  syncBadges(r);
  bumpPetHappiness(r, 10);
  saveRewards(r);
}

function touchStreak(r) {
  const today = todayKey();
  if (r.streak.lastDate === today) return;
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = yesterday.toISOString().slice(0, 10);
  if (r.streak.lastDate === yKey) {
    r.streak.count = (Number(r.streak.count) || 0) + 1;
  } else {
    r.streak.count = 1;
  }
  r.streak.lastDate = today;
}

function maybeAddSticker(r) {
  const pool = STICKER_DEFS.filter((s) => !(r.stickers || []).includes(s));
  if (pool.length && Math.random() < 0.35) {
    r.stickers = [...(r.stickers || []), pool[Math.floor(Math.random() * pool.length)]];
  }
}

function bumpPetHappiness(r, delta) {
  r.pet.happiness = Math.min(100, Math.max(0, (Number(r.pet.happiness) || 50) + delta));
  if (r.pet.happiness >= 95 && r.pet.level < 5) {
    r.pet.level += 1;
    r.pet.happiness = 60;
  }
}

function syncBadges(r) {
  const earned = new Set(r.badges || []);
  const storyCount = (loadStoryProgress().completed || []).length;
  for (const b of BADGE_DEFS) {
    if (earned.has(b.id)) continue;
    if (b.needStars && r.stars >= b.needStars) earned.add(b.id);
    if (b.needStreak && r.streak.count >= b.needStreak) earned.add(b.id);
    if (b.needStories && storyCount >= b.needStories) earned.add(b.id);
  }
  r.badges = [...earned];
}

export function getParentStats() {
  const progress = loadAllProgress();
  const rewards = loadRewards();
  const storyProgress = loadStoryProgress();

  let wordsLearned = 0;
  let wordsWeak = [];
  const topicStats = KIDS_VOCAB_LESSONS.map((lesson) => {
    const wordIds = lesson.words.map((w) => w.id);
    const done = lessonCompletionCount(lesson.id, wordIds);
    for (const wid of wordIds) {
      const p = progress[wid];
      if (p && Number(p.correct) >= 1) wordsLearned += 1;
      if (p && Number(p.wrong) > Number(p.correct)) {
        const word = lesson.words.find((w) => w.id === wid);
        if (word) wordsWeak.push(word.word);
      }
    }
    return { id: lesson.id, titleVi: lesson.titleVi, done, total: wordIds.length };
  });

  const scores = rewards.pronunciationScores || [];
  const avgPronunciation =
    scores.length > 0 ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length) : null;

  const studyMinutesEst = Math.round(
    (rewards.lessonsCompleted?.length || 0) * 8 +
      (storyProgress.completed?.length || 0) * 5 +
      Object.values(rewards.gamesPlayed || {}).reduce((a, b) => a + Number(b), 0) * 3
  );

  return {
    studyMinutesEst,
    wordsLearned,
    lessonsCompleted: rewards.lessonsCompleted?.length || 0,
    storiesCompleted: storyProgress.completed?.length || 0,
    avgPronunciation,
    wordsWeak: [...new Set(wordsWeak)].slice(0, 8),
    topicStats,
    stars: rewards.stars,
    streak: rewards.streak?.count || 0,
    badges: rewards.badges,
  };
}

export { BADGE_DEFS, STICKER_DEFS };
