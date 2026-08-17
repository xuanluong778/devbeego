import { buildCartoonImageFallbacks, resolveCartoonImageForRow } from "@/lib/vocabulary/cartoon-image-url";
import { resolveImageDisambiguation } from "@/lib/vocabulary/image-disambiguation";
import { resolveVocabularyImage } from "@/lib/vocabulary/image-resolver";
import { isImageHidden, resolveEffectiveImageStyle } from "@/lib/vocabulary/image-styles";
import { isPlaceholderImageUrl } from "@/lib/vocabulary/placeholder-image";
import { isUnreliableImageUrl } from "@/lib/vocabulary/stable-image-url";
import { lookupCuratedImage, lookupTopicFallbackImage } from "@/lib/vocabulary/curated-vocab-images";

function buildCartoonFallbacks(item) {
  const { lookupWord, searchWord } = resolveImageDisambiguation(item);
  for (const candidate of [lookupWord, searchWord, item?.word]) {
    const chain = buildCartoonImageFallbacks(String(candidate || "").trim());
    if (chain.length) return chain;
  }
  return [];
}

/**
 * @returns {{ src: string, approved: boolean, showImage: boolean, fallbacks: string[] }}
 */
export function resolveCardImage(item) {
  if (isImageHidden(item)) {
    return { src: "", approved: false, showImage: false, fallbacks: [] };
  }

  const status = String(item?.image_status || "").toLowerCase();
  const url = String(item?.image_url || "").trim();
  const style = resolveEffectiveImageStyle(item);
  const { searchWord } = resolveImageDisambiguation(item);

  if (url && status === "approved" && !isUnreliableImageUrl(url)) {
    return { src: url, approved: true, showImage: true, fallbacks: [] };
  }

  if (url && status !== "rejected" && status !== "hidden" && !isUnreliableImageUrl(url)) {
    return {
      src: url,
      approved: false,
      showImage: true,
      fallbacks: style === "cartoon" ? buildCartoonFallbacks(item) : [],
    };
  }

  const curated = lookupCuratedImage({ ...item, word: searchWord });
  if (curated) {
    return { src: curated, approved: false, showImage: true, fallbacks: [] };
  }

  if (style === "cartoon") {
    const fallbacks = buildCartoonFallbacks(item);
    if (fallbacks.length) {
      return { src: fallbacks[0], approved: false, showImage: true, fallbacks: fallbacks.slice(1) };
    }
  }

  const topicFallback = lookupTopicFallbackImage(item);
  if (topicFallback && style !== "real_photo") {
    return { src: topicFallback, approved: false, showImage: true, fallbacks: [] };
  }

  const resolved = resolveVocabularyImage(item);
  if (resolved.image_url && !isPlaceholderImageUrl(resolved.image_url)) {
    return {
      src: resolved.image_url,
      approved: false,
      showImage: true,
      fallbacks: style === "cartoon" ? buildCartoonFallbacks(item) : [],
    };
  }

  return { src: "", approved: false, showImage: false, fallbacks: [] };
}
