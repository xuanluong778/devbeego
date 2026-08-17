import { lookupCuratedImage } from "./curated-vocab-images.js";
import { resolveImageDisambiguation } from "./image-disambiguation.js";
import { explicitOpenmojiImageUrl } from "./explicit-emoji.js";
import { lookupVocabImageOverride } from "./vocab-image-overrides.js";
import { vocabPictogramImageUrl } from "./vocab-pictogram.js";

/** ARASAAC pictogram → OpenMoji tường minh (không hash ngẫu nhiên). */
export function buildCartoonImageFallbacks(word) {
  const chain = [];
  const picto = vocabPictogramImageUrl(word);
  const openmoji = explicitOpenmojiImageUrl(word);
  if (picto) chain.push(picto);
  if (openmoji && openmoji !== picto) chain.push(openmoji);
  return chain;
}

export function resolveCartoonImage(word) {
  const fallbacks = buildCartoonImageFallbacks(word);
  if (!fallbacks.length) return { url: "", source: "none" };
  const url = fallbacks[0];
  const source = url.includes("arasaac.org")
    ? "arasaac"
    : url.includes("unsplash.com")
    ? "curated_unsplash"
    : url.includes("wikimedia.org")
    ? "wikimedia"
    : "openmoji";
  return { url, source };
}

/**
 * Resolve ảnh cartoon đúng ngữ cảnh:
 * override → curated → ARASAAC (exact) → emoji tường minh → none
 */
export function resolveCartoonImageForRow(row) {
  const override = lookupVocabImageOverride(row);
  if (override?.url) return override;

  const curated = lookupCuratedImage(row);
  if (curated) return { url: curated, source: "curated_unsplash" };

  const { lookupWord, searchWord } = resolveImageDisambiguation(row);
  const candidates = [...new Set([lookupWord, searchWord, String(row?.word || "").trim()].filter(Boolean))];

  for (const candidate of candidates) {
    const resolved = resolveCartoonImage(candidate);
    if (resolved.url) return resolved;
  }

  return { url: "", source: "none" };
}
