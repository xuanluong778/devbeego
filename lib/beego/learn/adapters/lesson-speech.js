/** Lesson player speech capture — reuses browser-patient-speech (vocabulary engine). */
import {
  isSpeechRecognitionSupported,
  startPatientSpeechRecognition,
} from "@/lib/browser-patient-speech";

export { isSpeechRecognitionSupported };

let capturing = 0;

export function isLessonSpeechCapturing() {
  return capturing > 0;
}

export function startLessonSpeechCapture({ onResult, onError, lang = "en-US" } = {}) {
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

  const handle = startPatientSpeechRecognition({
    lang,
    utteranceMode: true,
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
      handle.stop?.();
    },
    abort() {
      release();
      handle.abort?.();
    },
  };
}
