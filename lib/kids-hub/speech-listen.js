"use client";

import { startPatientSpeechRecognition } from "@/lib/browser-patient-speech";
import { primeMicrophone } from "@/lib/kids-vocabulary/speech-score-helpers";

/** Nghe một lượt ngắn cho game / AI teacher kids. */
export function listenKidEnglishOnce() {
  return new Promise(async (resolve, reject) => {
    const micOk = await primeMicrophone();
    if (!micOk) {
      reject(new Error("mic-denied"));
      return;
    }
    const ctrl = startPatientSpeechRecognition({
      utteranceMode: true,
      lang: "en-US",
      silenceMs: 2600,
      maxMs: 14000,
      noSpeechGraceMs: 3500,
      onDone: (text) => resolve(String(text || "").trim()),
      onError: (code) => reject(new Error(code || "speech-error")),
    });
    if (!ctrl) reject(new Error("unsupported"));
  });
}
