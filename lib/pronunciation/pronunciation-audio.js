/**
 * Audio helpers for /pronunciation — IPA is display-only, never sent to TTS.
 */

import { playBeegoAudio } from "@/lib/beego/audio-player";

/** @type {Record<string, string>} */
export const PHONEME_AUDIO_MAP = {
  "/eɪ/": "day",
  "/æ/": "cat",
  "/ɪ/": "ship",
  "/iː/": "sheep",
  "/k/": "cat",
  "/ɡ/": "gold",
  "/g/": "gold",
  "/θ/": "think",
  "/ð/": "this",
  "/ʃ/": "ship",
  "/tʃ/": "chair",
  "/dʒ/": "job",
  "/ŋ/": "sing",
  "/r/": "red",
  "/w/": "water",
  "/j/": "yes",
  "/m/": "moon",
  "/n/": "name",
  "/l/": "light",
  "/aɪ/": "time",
  "/ɔɪ/": "boy",
  "/v/": "very",
  "/f/": "fish",
  "/s/": "sun",
  "/z/": "zoo",
  "/ʒ/": "measure",
  "/ʊ/": "full",
  "/uː/": "food",
  "/ʌ/": "cup",
  "/t/": "tea",
  "/d/": "door",
  "/p/": "pen",
  "/b/": "big",
  "/h/": "hello",
};

export function normalizePhoneme(phoneme) {
  if (!phoneme) return "";
  const p = String(phoneme).trim();
  if (!p) return "";
  const inner = p.replace(/^\/+|\/+$/g, "");
  return inner ? `/${inner}/` : "";
}

/** @param {string} text */
export function looksLikeRawIpa(text) {
  const t = String(text || "").trim();
  if (!t) return false;
  return /^\/[^/]+\/$/.test(t);
}

/**
 * @param {string} phoneme
 * @returns {string | null}
 */
export function getPhonemeAudioFromMap(phoneme) {
  const key = normalizePhoneme(phoneme);
  if (!key) return null;
  return PHONEME_AUDIO_MAP[key] || null;
}

/**
 * @param {"phoneme" | "word" | "sentence"} type
 * @param {{ phonemeAudioText?: string, targetPhoneme?: string, words?: Array<{ word?: string, targetPhoneme?: string }> } | null | undefined} lesson
 * @param {{ word?: string, targetPhoneme?: string, example_sentence?: string, sampleSentence?: string } | null | undefined} wordItem
 * @returns {string}
 */
export function getPronunciationAudioText(type, lesson, wordItem) {
  const words = lesson?.words || [];

  if (type === "phoneme") {
    const target = normalizePhoneme(
      wordItem?.targetPhoneme || lesson?.targetPhoneme || extractPhonemeFromText(wordItem?.ipaFocus)
    );
    const lessonTarget = normalizePhoneme(lesson?.targetPhoneme);

    if (lesson?.phonemeAudioText && lessonTarget && (!target || target === lessonTarget)) {
      return lesson.phonemeAudioText;
    }

    const fromMap = getPhonemeAudioFromMap(target);
    if (fromMap) return fromMap;

    const matchWord = words.find((w) => normalizePhoneme(w.targetPhoneme) === target);
    if (matchWord?.word) return matchWord.word;

    if (lesson?.phonemeAudioText) return lesson.phonemeAudioText;

    return words[0]?.word || "";
  }

  if (type === "word") {
    return String(wordItem?.word || "").trim();
  }

  if (type === "sentence") {
    return String(wordItem?.example_sentence || wordItem?.sampleSentence || "").trim();
  }

  return "";
}

function extractPhonemeFromText(text) {
  const m = String(text || "").match(/\/[^/]+\//);
  return m ? m[0] : "";
}

/**
 * @param {string} text
 * @param {number} [rate]
 * @returns {boolean}
 */
export function speakPronunciationEnglish(text, rate = 0.88) {
  const cleaned = String(text || "").trim();
  if (!cleaned) return false;

  if (looksLikeRawIpa(cleaned)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[pronunciation-audio] blocked IPA TTS:", cleaned);
    }
    return false;
  }

  if (typeof window === "undefined") return false;

  // Prefer same-origin TTS (works on Capacitor Android); speechSynthesis as fallback inside player.
  void playBeegoAudio({ text: cleaned, lang: "en" });
  return true;
}
