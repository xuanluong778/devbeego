/**
 * English–Vietnamese pair matching for LessonPlayer.
 * Identity is pairId / itemId. Column order is seeded once.
 */

function tidy(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function nextRandom(s) {
  return (Math.imul(s, 1664525) + 1013904223) >>> 0;
}

function shuffleWithState(arr, state) {
  const out = [...arr];
  let s = Math.abs(Number(state) || 1);
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = nextRandom(s);
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { out, state: s };
}

function shuffle(arr, seed) {
  return shuffleWithState(arr, seed).out;
}

function hashSeed(value) {
  const text = String(value || "");
  let h = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h >>> 0) || 1;
}

/**
 * Ensure every pair has a stable pairId (UI columns key off pairId).
 * Hand-authored banks sometimes only ship `{ en, vi }`.
 * @param {Array<{ pairId?: string, en?: string, vi?: string }>|null|undefined} pairs
 */
export function ensureMatchPairIds(pairs) {
  if (!Array.isArray(pairs)) return [];
  const used = new Set();
  return pairs.map((pair, index) => {
    const en = tidy(pair?.en);
    const vi = tidy(pair?.vi);
    let pairId = tidy(pair?.pairId);
    if (!pairId) {
      const slug = en.toLowerCase().replace(/[^a-z0-9]+/g, "") || `i${index + 1}`;
      pairId = `pair-${index + 1}-${slug}`;
    }
    if (used.has(pairId)) pairId = `${pairId}-${index + 1}`;
    used.add(pairId);
    return { ...pair, pairId, en, vi };
  });
}

export function leftItemId(pairId) {
  return `L:${pairId}`;
}

export function rightItemId(pairId) {
  return `R:${pairId}`;
}

export function pairIdFromItemId(itemId) {
  const text = String(itemId || "");
  if (text.startsWith("L:") || text.startsWith("R:")) return text.slice(2);
  return "";
}

function glossTooClose(a, b) {
  const left = tidy(a).toLowerCase();
  const right = tidy(b).toLowerCase();
  if (!left || !right || left === right) return true;
  return left.includes(right) || right.includes(left);
}

export function buildLessonMatchPairs(vocab, seed, count = 5) {
  const pool = [];
  const seenEn = new Set();
  const seenVi = [];
  for (const item of vocab || []) {
    const en = tidy(item?.en);
    const vi = tidy(item?.vi);
    if (!en || !vi) continue;
    if (seenEn.has(en.toLowerCase())) continue;
    if (seenVi.some((existing) => glossTooClose(existing, vi))) continue;
    seenEn.add(en.toLowerCase());
    seenVi.push(vi);
    pool.push({ en, vi });
  }
  if (pool.length < 4) return null;
  const size = Math.min(6, Math.max(4, Math.min(count, pool.length)));
  return shuffle(pool, seed)
    .slice(0, size)
    .map((item, index) => ({
      pairId: `pair-${index + 1}-${item.en.toLowerCase().replace(/[^a-z0-9]+/g, "")}`,
      en: item.en,
      vi: item.vi,
    }));
}

function speakKey(word) {
  return tidy(word)
    .toLowerCase()
    .replace(/[^a-z]/g, "");
}

function soundsClearlyDifferent(a, b) {
  const left = speakKey(a);
  const right = speakKey(b);
  if (left.length < 2 || right.length < 2 || left === right) return false;
  if (left.includes(right) || right.includes(left)) return false;
  if (left[0] === right[0]) return false;
  if (left.slice(-2) === right.slice(-2)) return false;
  return true;
}

export function pronunciationCode(word) {
  let sound = speakKey(word);
  if (!sound) return "";
  sound = sound
    .replace(/tion|sion|cion/g, "xn")
    .replace(/ght/g, "t")
    .replace(/ph/g, "f")
    .replace(/kn|gn/g, "n")
    .replace(/wr/g, "r")
    .replace(/wh/g, "w")
    .replace(/qu/g, "kw")
    .replace(/tch/g, "ch")
    .replace(/ck/g, "k")
    .replace(/ch|sh/g, "x")
    .replace(/th/g, "0")
    .replace(/ee|ea|ie|ei|ey/g, "i")
    .replace(/oo|ou|ew/g, "u")
    .replace(/ai|ay/g, "e")
    .replace(/oa|ow/g, "o")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/c/g, "k")
    .replace(/q/g, "k")
    .replace(/y/g, "i");
  sound = sound.replace(/[aeiou]+/g, "a");
  sound = sound.replace(/(.)\1+/g, "$1");
  return sound;
}

function editDistance(left, right) {
  const rows = Array.from({ length: left.length + 1 }, () => new Array(right.length + 1).fill(0));
  for (let i = 0; i <= left.length; i += 1) rows[i][0] = i;
  for (let j = 0; j <= right.length; j += 1) rows[0][j] = j;
  for (let i = 1; i <= left.length; i += 1) {
    for (let j = 1; j <= right.length; j += 1) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      rows[i][j] = Math.min(rows[i - 1][j] + 1, rows[i][j - 1] + 1, rows[i - 1][j - 1] + cost);
    }
  }
  return rows[left.length][right.length];
}

export function pronunciationDistance(a, b) {
  const leftWord = speakKey(a);
  const rightWord = speakKey(b);
  if (!leftWord || !rightWord || leftWord === rightWord) return 99;
  if (leftWord.includes(rightWord) || rightWord.includes(leftWord)) return 99;
  const left = pronunciationCode(a);
  const right = pronunciationCode(b);
  if (!left || !right) return 99;
  return editDistance(left, right);
}

function nearestSoundGroup(pool, size) {
  let best = [];
  for (const start of pool) {
    const group = [start];
    for (const candidate of pool) {
      if (candidate === start) continue;
      const close = group.every((member) => pronunciationDistance(member.en, candidate.en) <= 1);
      if (!close) continue;
      group.push(candidate);
      if (group.length === size) break;
    }
    if (group.length > best.length) best = group;
    if (best.length >= 4) break;
  }
  return best.length >= 4 ? best.slice(0, size) : [];
}

export function buildLessonAudioMatchPairs(vocab, seed, options = {}) {
  const pool = [];
  const seenEn = new Set();
  const seenVi = [];
  for (const item of vocab || []) {
    const en = tidy(item?.en);
    const vi = tidy(item?.vi);
    if (!en || !vi || !speakKey(en)) continue;
    if (seenEn.has(en.toLowerCase())) continue;
    if (seenVi.some((existing) => glossTooClose(existing, vi))) continue;
    seenEn.add(en.toLowerCase());
    seenVi.push(vi);
    pool.push({ en, vi });
  }
  const size = Math.min(6, Math.max(4, Number(options.count) || 5));
  const shuffled = shuffle(pool, seed);
  let picked = [];
  if (options.advanced) picked = nearestSoundGroup(shuffled, size);
  if (picked.length < 4) {
    picked = [];
    for (const item of shuffled) {
      if (picked.every((chosen) => soundsClearlyDifferent(chosen.en, item.en))) picked.push(item);
      if (picked.length === size) break;
    }
  }
  if (picked.length < 4) return null;
  return picked.map((item, index) => ({
    pairId: `sound-${index + 1}-${speakKey(item.en)}`,
    en: item.en,
    vi: item.vi,
  }));
}

export function audioCueLabel() {
  return "Nghe";
}

export function audioSelectLabel(selected, locked) {
  if (locked) return "Đã ghép";
  if (selected) return "Đang chọn";
  return "Chọn";
}

export const AUDIO_PLAYBACK_ERROR = "Không nghe được. Bấm Nghe để thử lại.";

export function afterAudioCue(matchState, playbackResult) {
  const via = playbackResult && playbackResult.via;
  const failed = !playbackResult || playbackResult.ok === false;
  return {
    state: matchState,
    hearError: failed && via !== "cancelled" ? AUDIO_PLAYBACK_ERROR : "",
    attempt: false,
    heart: false,
  };
}

export function columnOrder(pairs, seed) {
  const normalized = ensureMatchPairIds(pairs);
  const n = normalized.length;
  if (n < 2) {
    return {
      left: normalized.map((pair) => leftItemId(pair.pairId)),
      right: normalized.map((pair) => rightItemId(pair.pairId)),
    };
  }

  let s = hashSeed(seed);
  // 1. Shuffle left column
  let leftRes = shuffleWithState(
    normalized.map((pair) => leftItemId(pair.pairId)),
    s + 1
  );
  let left = leftRes.out;
  s = leftRes.state;

  // Ensure left is not in identical order to the original raw pairs
  let leftAttempts = 0;
  while (
    leftAttempts < 20 &&
    left.every((item, idx) => pairIdFromItemId(item) === normalized[idx].pairId)
  ) {
    s = nextRandom(s);
    leftRes = shuffleWithState(left, s);
    left = leftRes.out;
    s = leftRes.state;
    leftAttempts += 1;
  }

  // 2. Shuffle right column such that no item matches left at the same row (pure derangement)
  // and right is also not in raw catalog order when n > 2
  const baseRight = normalized.map((pair) => rightItemId(pair.pairId));
  let right = null;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    s = nextRandom(s);
    const rightRes = shuffleWithState(baseRight, s);
    const cand = rightRes.out;
    s = rightRes.state;
    const hasFixedPoint = cand.some(
      (item, idx) => pairIdFromItemId(item) === pairIdFromItemId(left[idx])
    );
    const isRawOrder =
      n > 2 && cand.every((item, idx) => pairIdFromItemId(item) === normalized[idx].pairId);
    if (!hasFixedPoint && !isRawOrder) {
      right = cand;
      break;
    }
  }

  // Fallback: guaranteed derangement via cyclic shift if random search exhausted
  if (!right) {
    const shift = 1 + (s % (n - 1));
    right = left.map((_, i) => rightItemId(pairIdFromItemId(left[(i + shift) % n])));
  }

  return { left, right };
}

export function initialMatchState() {
  return {
    leftId: null,
    rightId: null,
    locked: [],
    mistakes: 0,
    message: "",
    tone: "",
    done: false,
  };
}

function lockedSet(state) {
  return new Set(state.locked || []);
}

export function applyMatchSelection(state, pairs, side, itemId) {
  const current = state || initialMatchState();
  if (current.done) return current;
  const pairId = pairIdFromItemId(itemId);
  if (!pairId || lockedSet(current).has(pairId)) return current;
  const next = {
    ...current,
    leftId: side === "left" ? itemId : current.leftId,
    rightId: side === "right" ? itemId : current.rightId,
    message: "",
    tone: "",
    wrongLeft: null,
    wrongRight: null,
  };
  if (side === "left" && pairIdFromItemId(current.rightId) === pairId) {
    next.rightId = current.rightId;
  }
  if (!next.leftId || !next.rightId) {
    return { ...next, wrongLeft: null, wrongRight: null };
  }

  const leftPair = pairIdFromItemId(next.leftId);
  const rightPair = pairIdFromItemId(next.rightId);
  if (!leftPair || !rightPair || leftPair !== rightPair) {
    return {
      ...next,
      leftId: null,
      rightId: null,
      wrongLeft: next.leftId,
      wrongRight: next.rightId,
      mistakes: current.mistakes + 1,
      message: "Chưa đúng. Hãy chọn lại.",
      tone: "wrong",
    };
  }
  const locked = [...current.locked, leftPair];
  const finished = locked.length === (pairs || []).length;
  return {
    ...next,
    leftId: null,
    rightId: null,
    locked,
    message: finished ? "" : "Đã ghép.",
    tone: finished ? "done" : "correct",
    done: finished,
  };
}

export function matchAccuracy(pairCount, mistakeCount) {
  const pairs = Number(pairCount) || 0;
  const mistakes = Number(mistakeCount) || 0;
  const attempts = pairs + mistakes;
  if (!attempts) return 0;
  return Math.round((pairs / attempts) * 100);
}

export function matchSummary(pairCount, mistakeCount) {
  const pairs = Number(pairCount) || 0;
  const mistakes = Number(mistakeCount) || 0;
  const accuracy = matchAccuracy(pairs, mistakes);
  return `Đã ghép ${pairs}/${pairs} cặp. Số lần chọn sai: ${mistakes}. Độ chính xác: ${accuracy}%.`;
}

export function gradeMatchAnswer(exercise, answer) {
  const pairs = Array.isArray(exercise?.pairs) ? exercise.pairs : [];
  if (!answer || answer.completed !== true) {
    return { complete: false, accurate: false };
  }
  const matches = Array.isArray(answer.matches) ? answer.matches : [];
  const expected = new Set(pairs.map((pair) => pair.pairId));
  if (!expected.size || matches.length !== expected.size) {
    return { complete: false, accurate: false };
  }
  const seen = new Set();
  for (const match of matches) {
    const left = pairIdFromItemId(match?.leftItemId);
    const right = pairIdFromItemId(match?.rightItemId);
    if (!left || left !== right || !expected.has(left) || seen.has(left)) {
      return { complete: false, accurate: false };
    }
    seen.add(left);
  }
  const complete = seen.size === expected.size;
  const mistakes = Number(answer.mistakeCount);
  const accurate = complete && Number.isInteger(mistakes) && mistakes === 0;
  return { complete, accurate };
}
