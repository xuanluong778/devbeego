import { resolveWordEmojiHex } from "./word-emoji-lookup";
import { kidWordPictogramImageUrl } from "./word-pictogram-lookup";

const OPENMOJI_CDN = "https://cdn.jsdelivr.net/npm/openmoji@14.0.0/color/svg";
const TWEMOJI_CDN = "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/svg";

/** OpenMoji màu — hoạt hình hơn Twemoji phẳng. */
export function kidWordOpenmojiImageUrl(word) {
  const hex = resolveWordEmojiHex(word).toUpperCase();
  return `${OPENMOJI_CDN}/${hex}.svg`;
}

export function kidWordTwemojiImageUrl(word) {
  const hex = resolveWordEmojiHex(word);
  return `${TWEMOJI_CDN}/${hex}.svg`;
}

/**
 * Ảnh minh hoạ từ vựng: ARASAAC pictogram (ưu tiên) → OpenMoji màu.
 */
export function kidWordImageUrl(word) {
  return kidWordPictogramImageUrl(word) || kidWordOpenmojiImageUrl(word);
}
export function kidWordAudioUrl(text) {
  const t = String(text || "").replace(/\s+/g, " ").trim();
  if (!t) return "";
  const q = new URLSearchParams({ text: t.slice(0, 180), lang: "en" });
  return `/api/tts/speak?${q.toString()}`;
}

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
