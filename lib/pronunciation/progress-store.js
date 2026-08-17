const PROGRESS_KEY = "ipa-practice-progress-v1";
const META_KEY = "pron-practice-meta-v1";

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function readLessonProgress() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(PROGRESS_KEY);
    const p = raw ? JSON.parse(raw) : {};
    return typeof p === "object" && p ? p : {};
  } catch {
    return {};
  }
}

export function writeLessonProgress(data) {
  try {
    window.localStorage.setItem(PROGRESS_KEY, JSON.stringify(data));
  } catch (_e) {}
}

function readMeta() {
  if (typeof window === "undefined") {
    return { streak: 0, lastDate: "", sessionCount: 0, scores: [] };
  }
  try {
    const raw = window.localStorage.getItem(META_KEY);
    const m = raw ? JSON.parse(raw) : {};
    return {
      streak: Number(m.streak || 0),
      lastDate: String(m.lastDate || ""),
      sessionCount: Number(m.sessionCount || 0),
      scores: Array.isArray(m.scores) ? m.scores.map(Number).filter(Number.isFinite) : [],
    };
  } catch {
    return { streak: 0, lastDate: "", sessionCount: 0, scores: [] };
  }
}

function writeMeta(meta) {
  try {
    window.localStorage.setItem(META_KEY, JSON.stringify(meta));
  } catch (_e) {}
}

export function recordPracticeScore(lessonId, word, score) {
  const k = String(word || "").toLowerCase();
  const rounded = Math.max(0, Math.round(Number(score) || 0));
  const progress = readLessonProgress();
  const lesson = { ...(progress[lessonId] || {}) };
  lesson[k] = Math.max(lesson[k] || 0, rounded);
  const nextProgress = { ...progress, [lessonId]: lesson };
  writeLessonProgress(nextProgress);

  const meta = readMeta();
  const today = todayKey();
  if (meta.lastDate) {
    const last = new Date(meta.lastDate);
    const curr = new Date(today);
    const diffDays = Math.round((curr - last) / 86400000);
    if (diffDays === 1) meta.streak += 1;
    else if (diffDays > 1) meta.streak = 1;
  } else {
    meta.streak = 1;
  }
  if (meta.lastDate !== today) {
    meta.lastDate = today;
    meta.sessionCount += 1;
  }
  meta.scores = [...meta.scores, rounded].slice(-80);
  writeMeta(meta);

  return { progress: nextProgress, meta };
}

export function readPracticeStats(progressMap) {
  const meta = readMeta();
  const scores = meta.scores.length
    ? meta.scores
    : Object.values(progressMap || {}).flatMap((lesson) => Object.values(lesson || {}));
  const avg =
    scores.length > 0
      ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
      : null;
  let passed = 0;
  Object.values(progressMap || {}).forEach((lesson) => {
    Object.values(lesson || {}).forEach((s) => {
      if (Number(s) >= 65) passed += 1;
    });
  });
  return {
    streak: meta.streak,
    avgScore: avg,
    sessionCount: meta.sessionCount || passed,
    practicedCount: scores.length,
  };
}

export function getWordScore(progressMap, lessonId, word) {
  return progressMap?.[lessonId]?.[String(word || "").toLowerCase()] || 0;
}
