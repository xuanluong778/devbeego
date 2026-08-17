import { evaluatePronunciation } from "@/lib/client-pronunciation-eval";

let azureTokenCache = null;

async function getAzureToken() {
  const cached = azureTokenCache;
  if (cached && Date.now() - cached.createdAt < 9 * 60 * 1000) return cached;
  const res = await fetch("/api/pronunciation/token", { cache: "no-store" });
  const json = await res.json();
  if (!res.ok || !json?.success || !json?.data?.token || !json?.data?.region) return null;
  azureTokenCache = {
    token: String(json.data.token),
    region: String(json.data.region),
    createdAt: Date.now(),
  };
  return azureTokenCache;
}

/** Azure Pronunciation Assessment (một lượt). Trả null nếu không dùng được. */
export async function assessPronunciationWithAzure(target, isSentence) {
  const auth = await getAzureToken();
  if (!auth || !target) return null;

  const sdk = await import("microsoft-cognitiveservices-speech-sdk");
  const speechConfig = sdk.SpeechConfig.fromAuthorizationToken(auth.token, auth.region);
  speechConfig.speechRecognitionLanguage = "en-US";
  const audioConfig = sdk.AudioConfig.fromDefaultMicrophoneInput();
  const recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
  const paConfig = new sdk.PronunciationAssessmentConfig(
    String(target),
    sdk.PronunciationAssessmentGradingSystem.HundredMark,
    sdk.PronunciationAssessmentGranularity.Phoneme,
    true
  );
  paConfig.enableProsodyAssessment = Boolean(isSentence);
  paConfig.applyTo(recognizer);

  return new Promise((resolve) => {
    recognizer.recognizeOnceAsync(
      (result) => {
        try {
          if (result.reason !== sdk.ResultReason.RecognizedSpeech) {
            recognizer.close();
            resolve(null);
            return;
          }
          const pa = sdk.PronunciationAssessmentResult.fromResult(result);
          const score = Math.max(0, Math.round(Number(pa?.pronunciationScore || 0)));
          const transcript = String(result?.text || "").trim();
          const local = evaluatePronunciation(transcript, target, { isSentence });
          recognizer.close();
          resolve({
            score,
            transcript,
            message: local.message,
            details: local.details,
            source: "azure",
          });
        } catch {
          recognizer.close();
          resolve(null);
        }
      },
      () => {
        recognizer.close();
        resolve(null);
      }
    );
  });
}
