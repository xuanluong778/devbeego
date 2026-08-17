import { lookupCuratedImage } from "./curated-vocab-images.js";
import { resolveImageDisambiguation } from "./image-disambiguation.js";
import { isPlaceholderImageUrl } from "./placeholder-image.js";
import { isImageHidden, resolveEffectiveImageStyle } from "./image-styles.js";
import { buildStableVocabImageUrl } from "./stable-image-url.js";
import { resolveCartoonImageForRow } from "./cartoon-image-url.js";

function resolveRealPhotoUrl(row, searchWord) {
  const disambigRow = { ...row, word: searchWord };
  const curated = lookupCuratedImage(disambigRow);
  if (curated) return { image_url: curated, image_source: "curated_unsplash" };

  const existing = String(row?.image_url || "").trim();
  if (existing && !isPlaceholderImageUrl(existing) && existing.includes("wikimedia")) {
    return { image_url: existing, image_source: "wikimedia" };
  }

  return { image_url: buildStableVocabImageUrl(disambigRow), image_source: "beego_seed" };
}

/**
 * Resolve vocabulary image URL + source by style (no Google Images).
 * @param {object} row
 * @returns {{ image_url: string, image_source: string, image_style: string }}
 */
export function resolveVocabularyImage(row) {
  const style = resolveEffectiveImageStyle(row);

  if (isImageHidden(row) || style === "none") {
    return { image_url: "", image_source: "none", image_style: style };
  }

  const existing = String(row?.image_url || "").trim();
  const status = String(row?.image_status || "").toLowerCase();
  if (existing && status === "approved" && !isPlaceholderImageUrl(existing)) {
    return {
      image_url: existing,
      image_source: String(row?.image_source || "admin_upload"),
      image_style: style,
    };
  }

  const { searchWord } = resolveImageDisambiguation(row);

  if (style === "cartoon") {
    const cartoon = resolveCartoonImageForRow(row);
    if (cartoon.url) return { image_url: cartoon.url, image_source: cartoon.source, image_style: style };
    return { image_url: "", image_source: "none", image_style: style };
  }

  if (style === "real_photo") {
    return { ...resolveRealPhotoUrl(row, searchWord), image_style: style };
  }

  const cartoon = resolveCartoonImageForRow(row);
  if (cartoon.url) return { image_url: cartoon.url, image_source: cartoon.source, image_style: style };
  return { ...resolveRealPhotoUrl(row, searchWord), image_style: style };
}
