/**
 * Listen-and-choose-picture options for Learn.
 * Uses the existing ARASAAC pictogram map only. No new image service and no generic placeholder.
 */

import {
  arasaacPictogramImageUrl,
  resolveWordPictogramId,
} from "@/lib/kids-vocabulary/word-pictogram-lookup";

const OPTION_IDS = ["a", "b", "c", "d"];
/** Pictograms whose drawing does not match the lesson meaning. */
const SKIP_PICTURE_WORDS = new Set([
  "team",
  "voice",
  "however",
  "old",
  "project",
  "break",
]);

function shuffle(arr, seed) {
  const out = [...arr];
  let s = Math.abs(Number(seed) || 1);
  for (let i = out.length - 1; i > 0; i -= 1) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Vocab items that each have one distinct existing pictogram.
 * @param {Array<{ en?: string, vi?: string }>} vocab
 */
export function listDistinctPictureVocab(vocab) {
  const seen = new Set();
  const out = [];
  for (const item of vocab || []) {
    const en = String(item?.en || "").trim();
    const vi = String(item?.vi || "").trim();
    if (!en || !vi || SKIP_PICTURE_WORDS.has(en.toLowerCase())) continue;
    const pictogramId = resolveWordPictogramId(en);
    if (!pictogramId || seen.has(pictogramId)) continue;
    const imageUrl = arasaacPictogramImageUrl(pictogramId);
    if (!imageUrl) continue;
    seen.add(pictogramId);
    out.push({ en, vi, pictogramId, imageUrl });
  }
  return out;
}

/**
 * One target word and three other pictures. Null when the bank cannot illustrate four different meanings.
 * @param {Array<{ en?: string, vi?: string }>} vocab
 * @param {number} seed
 * @param {number} targetIndex
 */
export function buildListenPictureOptions(vocab, seed, targetIndex = 0) {
  const pool = listDistinctPictureVocab(vocab);
  if (pool.length < 4) return null;
  const target = pool[Math.abs(Number(targetIndex) || 0) % pool.length];
  const rest = pool.filter((item) => item.pictogramId !== target.pictogramId && item.en !== target.en);
  if (rest.length < 3) return null;
  const start = Math.abs(Number(seed) || 0) % rest.length;
  const distractors = [];
  for (let k = 0; k < rest.length && distractors.length < 3; k += 1) {
    distractors.push(rest[(start + k) % rest.length]);
  }
  const bag = shuffle([{ ...target, correct: true }, ...distractors.map((item) => ({ ...item, correct: false }))], seed);
  const urls = new Set(bag.map((item) => item.imageUrl));
  if (urls.size !== bag.length) return null;
  const options = bag.map((item, index) => ({
    id: OPTION_IDS[index],
    text: item.en,
    meaningVi: item.vi,
    imageUrl: item.imageUrl,
  }));
  const correctAnswer = options[bag.findIndex((item) => item.correct)].id;
  return { options, correctAnswer, target };
}

export function isPictureListeningExercise(exercise) {
  return exercise?.extensions?.choicePresentation === "picture";
}
