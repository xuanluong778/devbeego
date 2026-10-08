/** Lesson player speech capture — reuses browser-patient-speech (vocabulary engine). */
import {
  isSpeechRecognitionSupported,
  startPatientSpeechRecognition,
} from "@/lib/browser-patient-speech";

export { isSpeechRecognitionSupported };

export function startLessonSpeechCapture({ onResult, onError, lang = "en-US" } = {}) {
  if (!isSpeechRecognitionSupported()) {
    onError?.({ code: "UNSUPPORTED", message: "Trình duyệt không hỗ trợ nhận giọng nói." });
    return { stop: () => {} };
  }

  return startPatientSpeechRecognition({
    lang,
    utteranceMode: true,
    onDone: (transcript) => onResult?.(transcript),
    onError: (code) => onError?.({ code, message: String(code || "speech_error") }),
  });
}
