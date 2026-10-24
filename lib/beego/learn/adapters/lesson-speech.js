/** Lesson player speech capture — reuses browser-patient-speech (vocabulary engine). */
import {
  isSpeechRecognitionSupported,
  startPatientSpeechRecognition,
} from "@/lib/browser-patient-speech";

export { isSpeechRecognitionSupported };

let capturing = 0;

/** Timing scaled so long listen-and-repeat lines are not cut mid-phrase. */
export function speechTimingForExpectedText(expectedText = "") {
  const words = String(expectedText || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean).length;
  // Pause between words / breath — longer targets need more patience.
  const silenceMs = words >= 12 ? 4800 : words >= 6 ? 4000 : words >= 3 ? 3400 : 2800;
  // ~1.5s/word + lead-in, capped.
  const maxMs = Math.min(75_000, Math.max(18_000, words * 1500 + 8000));
  const noSpeechGraceMs = words >= 6 ? 5000 : 4000;
  return { words, silenceMs, maxMs, noSpeechGraceMs };
}

export function isLessonSpeechCapturing() {
  return capturing > 0;
}

export function startLessonSpeechCapture({
  onResult,
  onError,
  onInterim,
  lang = "en-US",
  expectedText = "",
} = {}) {
  if (!isSpeechRecognitionSupported()) {
    onError?.({ code: "UNSUPPORTED", message: "Trình duyệt không hỗ trợ nhận giọng nói." });
    return { stop: () => {} };
  }

  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    capturing = Math.max(0, capturing - 1);
  };
  capturing += 1;

  const timing = speechTimingForExpectedText(expectedText);

  const handle = startPatientSpeechRecognition({
    lang,
    // Continuous + restart: do not cut off mid-sentence on short pauses.
    utteranceMode: false,
    silenceMs: timing.silenceMs,
    maxMs: timing.maxMs,
    noSpeechGraceMs: timing.noSpeechGraceMs,
    onInterim,
    onDone: (transcript) => {
      release();
      onResult?.(transcript);
    },
    onError: (code) => {
      release();
      onError?.({ code, message: String(code || "speech_error") });
    },
  });

  return {
    stop() {
      release();
      handle?.stop?.();
    },
    abort() {
      release();
      handle?.abort?.();
    },
  };
}
