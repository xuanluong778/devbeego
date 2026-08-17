/**
 * Tra pictogram ARASAAC an toàn cho từ vựng — chỉ exact match + override, không stem gây nhầm.
 */
import storyWordPictogram from "../kids-vocabulary/story-word-pictogram.generated.js";
import { arasaacPictogramImageUrl } from "../kids-vocabulary/word-pictogram-lookup.js";
import { BLOCKED_PICTOGRAM_IDS } from "./vocab-image-overrides.js";

/** @type {Record<string, number>} */
const VOCAB_PICTOGRAM_OVERRIDES = {
  evening: 26997,
  night: 26997,
  midnight: 26997,
};

function normalizeKey(word) {
  return String(word || "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ")
    .replace(/\?$/, "");
}

/**
 * @param {string} word
 * @returns {number | null}
 */
export function resolveVocabPictogramId(word) {
  const key = normalizeKey(word);
  if (!key) return null;

  if (VOCAB_PICTOGRAM_OVERRIDES[key]) return VOCAB_PICTOGRAM_OVERRIDES[key];

  const exact = storyWordPictogram[key];
  if (exact && !BLOCKED_PICTOGRAM_IDS.has(exact)) return exact;

  return null;
}

/**
 * @param {string} word
 * @returns {string}
 */
export function vocabPictogramImageUrl(word) {
  const id = resolveVocabPictogramId(word);
  return id ? arasaacPictogramImageUrl(id) : "";
}
