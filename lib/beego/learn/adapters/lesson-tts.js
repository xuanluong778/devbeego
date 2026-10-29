/** Lesson player TTS — reuses shared Beego audio (same as vocabulary tab engine). */
import { playBeegoAudio, stopBeegoAudio } from "@/lib/beego/audio-player";

export function playLessonTts({ text, url, lang = "en", rate, onProgress } = {}) {
  if (typeof window === "undefined") return Promise.resolve(false);
  return playBeegoAudio({
    url: url || undefined,
    text: text || "",
    lang,
    rate,
    onProgress,
  });
}

export function stopLessonTts() {
  stopBeegoAudio();
}
