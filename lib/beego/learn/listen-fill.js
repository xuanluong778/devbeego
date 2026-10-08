/**
 * Listen-and-choose-the-missing-word.
 * The spoken line, the gapped sentence, the blank index, and the answer stay separate.
 * A repeated word is blanked by index, not by replacing every copy.
 */

import { pronunciationDistance } from "@/lib/beego/learn/match-pairs";

const FUNCTION_WORDS = new Set([
  "a", "an", "the", "is", "am", "are", "was", "were", "be", "to", "of", "in", "on", "at",
  "my", "your", "his", "her", "our", "their", "i", "you", "we", "he", "she", "it",
  "do", "does", "did", "can", "could", "would", "will", "and", "or", "but", "for", "with",
  "this", "that", "there", "here",
]);

export const LISTEN_FILL_SLOW_RATE = 0.72;
export const LISTEN_FILL_PLAYBACK_ERROR = "Không nghe được. Bấm Nghe để thử lại.";

export function listenTokens(line) {
  return String(line || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

export function isFunctionWord(word) {
  const key = String(word || "")
    .toLowerCase()
    .replace(/[^a-z']/g, "");
  return FUNCTION_WORDS.has(key);
}

export function gapSentence(tokens, index) {
  return (tokens || []).map((token, i) => (i === index ? "___" : token)).join(" ");
}

export function chooseGapIndex(tokens, seed) {
  const content = [];
  (tokens || []).forEach((token, index) => {
    if (!isFunctionWord(token)) content.push(index);
  });
  const pool = content.length ? content : (tokens || []).map((_, index) => index);
  if (!pool.length) return -1;
  return pool[Math.abs(Number(seed) || 0) % pool.length];
}

function norm(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function lengthBand(word) {
  return Math.max(1, Math.round(String(word || "").length * 0.35));
}

export function lengthsTooRevealing(correct, options) {
  const band = lengthBand(correct);
  return (options || []).some((option) => Math.abs(String(option).length - String(correct).length) > band);
}

function meaningFor(line, gapWord, phrases, vocab) {
  const spoken = norm(line);
  const phrase = (phrases || []).find((item) => norm(item?.en) === spoken);
  if (phrase?.vi) return String(phrase.vi).trim();
  const word = (vocab || []).find((item) => norm(item?.en) === norm(gapWord));
  return word?.vi ? String(word.vi).trim() : "";
}

function candidateWords(vocab, listening, blocked) {
  const out = [];
  const seen = new Set();
  const push = (word) => {
    const text = String(word || "").trim();
    const key = text.toLowerCase();
    if (!text || text.includes(" ") || blocked.has(key) || seen.has(key) || isFunctionWord(text)) return;
    seen.add(key);
    out.push(text);
  };
  for (const item of vocab || []) push(item?.en);
  for (const line of listening || []) {
    for (const token of listenTokens(line)) push(token);
  }
  return out;
}

function pickDistractors(target, words) {
  const band = lengthBand(target);
  const ranked = [...words].sort((a, b) => {
    const sound = pronunciationDistance(a, target) - pronunciationDistance(b, target);
    if (sound) return sound;
    return Math.abs(a.length - target.length) - Math.abs(b.length - target.length);
  });
  const picked = [];
  const take = (limit) => {
    for (const word of ranked) {
      if (picked.some((item) => item.toLowerCase() === word.toLowerCase())) continue;
      if (Math.abs(word.length - target.length) > limit) continue;
      picked.push(word);
      if (picked.length === 3) return;
    }
  };
  take(band);
  take(band * 2);
  return picked.slice(0, 3);
}

export function buildListenFill(line, { vocab, listening, phrases, seed } = {}) {
  const tokens = listenTokens(line);
  const gapIndex = chooseGapIndex(tokens, seed);
  if (gapIndex < 0) return null;
  const gapWord = tokens[gapIndex];
  const blocked = new Set(tokens.map((token) => token.toLowerCase()));
  const distractors = pickDistractors(gapWord, candidateWords(vocab, listening, blocked));
  if (distractors.length < 3) return null;
  const meaning = meaningFor(line, gapWord, phrases, vocab);
  const transcript = tokens.join(" ");
  return {
    tokens,
    gapIndex,
    gapWord,
    displaySentence: gapSentence(tokens, gapIndex),
    transcript,
    distractors,
    meaning,
    explanation: meaning ? `«${gapWord}» nghĩa là ${meaning}` : `Từ còn thiếu là «${gapWord}».`,
  };
}

export function listenFillPlaybackIssue(result) {
  if (result && result.via === "cancelled") return "";
  if (!result || result.ok === false) return LISTEN_FILL_PLAYBACK_ERROR;
  return "";
}
