const STORAGE_KEY = "beego-vocab-guest-srs-v1";

export function readGuestSrsMap() {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

export function writeGuestSrsMap(map) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    /* quota */
  }
}

export function getGuestProgress(wordId) {
  const map = readGuestSrsMap();
  return map[String(wordId)] || null;
}

export function saveGuestProgress(wordId, progress) {
  const map = readGuestSrsMap();
  map[String(wordId)] = { ...progress, word_id: Number(wordId) };
  writeGuestSrsMap(map);
  return map[String(wordId)];
}

export function buildGuestSrsStats(allWordIds = []) {
  const map = readGuestSrsMap();
  const now = Date.now();
  const newWords = [];
  const dueWords = [];
  const weakWords = [];
  let masteredCount = 0;

  const seen = new Set();

  for (const id of allWordIds) {
    seen.add(String(id));
    const row = map[String(id)];
    if (!row || row.status === "new") {
      newWords.push(Number(id));
      continue;
    }
    if (row.status === "mastered") masteredCount += 1;
    if (row.status === "weak") weakWords.push(Number(id));
    if (row.next_review_at && new Date(row.next_review_at).getTime() <= now) {
      dueWords.push(Number(id));
    }
  }

  for (const [key, row] of Object.entries(map)) {
    if (seen.has(key)) continue;
    const id = Number(key);
    if (!Number.isFinite(id)) continue;
    if (row.status === "mastered") masteredCount += 1;
    if (row.status === "weak") weakWords.push(id);
    if (row.next_review_at && new Date(row.next_review_at).getTime() <= now) dueWords.push(id);
  }

  return {
    new_words: newWords,
    due_words: dueWords,
    weak_words: weakWords,
    mastered_count: masteredCount,
    total_learning: Object.keys(map).length,
  };
}

export function mergeGuestStatsIntoDashboard(baseStats, wordIds = []) {
  const guest = buildGuestSrsStats(wordIds);
  const totalWords = Number(baseStats.total_words || 0);
  const estimatedNew =
    wordIds.length > 0
      ? guest.new_words.length
      : Math.max(0, totalWords - guest.total_learning);
  return {
    ...baseStats,
    authenticated: false,
    new_words: guest.new_words,
    due_words: guest.due_words,
    weak_words: guest.weak_words,
    mastered_count: guest.mastered_count,
    review_due: guest.due_words.length,
    weak_count: guest.weak_words.length,
    total_learning: guest.total_learning,
    new_today: estimatedNew,
  };
}

/** Word IDs for guest study sessions from localStorage SRS map. */
export function getGuestSessionWordIds(mode = "learn", limit = 10) {
  const map = readGuestSrsMap();
  const now = Date.now();
  const ids = [];

  if (mode === "review") {
    for (const [key, row] of Object.entries(map)) {
      if (row.next_review_at && new Date(row.next_review_at).getTime() <= now) {
        ids.push(Number(key));
      }
    }
  } else if (mode === "weak") {
    for (const [key, row] of Object.entries(map)) {
      if (row.status === "weak") ids.push(Number(key));
    }
  } else {
    for (const [key, row] of Object.entries(map)) {
      if (row.status === "learning" || row.status === "review") ids.push(Number(key));
    }
  }

  return ids.filter((id) => Number.isFinite(id) && id > 0).slice(0, limit);
}
