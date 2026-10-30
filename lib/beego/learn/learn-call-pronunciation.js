/**
 * Azure Pronunciation Assessment for Learn Call.
 * Scores real PCM audio (not text-only). The STT transcript is used as the
 * reference phrase so Azure can grade articulation of what the learner said.
 * Word/phoneme rows come from Azure detail JSON only.
 */

import { learnCallAzureWordScores, learnCallCoachItems } from "./learn-call-coach.js";

export const LEARN_CALL_PRON_PCM_MAX_BYTES = 16000 * 2 * 30; // ~30s mono PCM16
export const LEARN_CALL_PRON_TIMEOUT_MS = 4500;
export const LEARN_CALL_PRON_MIN_CHARS = 2;

export function createLearnPcmBuffer(maxBytes = LEARN_CALL_PRON_PCM_MAX_BYTES) {
  const chunks = [];
  let bytes = 0;
  return {
    append(data) {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (!buf.length) return false;
      if (bytes >= maxBytes) return false;
      const room = maxBytes - bytes;
      const piece = buf.length > room ? buf.subarray(0, room) : buf;
      chunks.push(piece);
      bytes += piece.length;
      return true;
    },
    clear() {
      chunks.length = 0;
      bytes = 0;
    },
    toBuffer() {
      if (!chunks.length) return Buffer.alloc(0);
      return Buffer.concat(chunks, bytes);
    },
    get byteLength() {
      return bytes;
    },
  };
}

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function normalizePronunciationResult(raw = {}) {
  const pronunciationScore = clampScore(raw.pronunciationScore);
  const words = learnCallAzureWordScores(raw.words || raw.detail || raw);
  if (pronunciationScore == null && !words.length) return null;
  return {
    pronunciationScore,
    accuracyScore: clampScore(raw.accuracyScore),
    fluencyScore: clampScore(raw.fluencyScore),
    completenessScore: clampScore(raw.completenessScore),
    prosodyScore: clampScore(raw.prosodyScore),
    words,
    coachItems: learnCallCoachItems(words),
    source: "azure",
  };
}

export function parseAzurePronunciationDetail(result, sdk) {
  if (!result) return [];
  try {
    const json = result.properties?.getProperty?.(sdk?.PropertyId?.SpeechServiceResponse_JsonResult);
    if (json) {
      const parsed = JSON.parse(String(json));
      const words = learnCallAzureWordScores(parsed);
      if (words.length) return words;
    }
  } catch (_e) {}
  try {
    const pa = sdk?.PronunciationAssessmentResult?.fromResult?.(result);
    const detail = pa?.detailResult;
    const words = learnCallAzureWordScores(detail);
    if (words.length) return words;
  } catch (_e) {}
  return [];
}

/**
 * Run Azure Pronunciation Assessment once on buffered PCM16 16kHz mono.
 * @returns {Promise<object|null>}
 */
export function assessLearnCallPcm({
  sdk,
  speechKey,
  speechRegion,
  pcmBuffer,
  referenceText,
  language = "en-US",
  timeoutMs = LEARN_CALL_PRON_TIMEOUT_MS,
} = {}) {
  const key = String(speechKey || "").trim();
  const region = String(speechRegion || "").trim();
  const reference = String(referenceText || "").trim();
  const pcm = Buffer.isBuffer(pcmBuffer) ? pcmBuffer : Buffer.from(pcmBuffer || []);

  if (!sdk || !key || !region || !reference || reference.length < LEARN_CALL_PRON_MIN_CHARS) return Promise.resolve(null);
  if (pcm.byteLength < 3200) return Promise.resolve(null); // <100ms at 16kHz PCM16

  return new Promise((resolve) => {
    let settled = false;
    let recognizer = null;
    let pushStream = null;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        recognizer?.close?.();
      } catch (_e) {}
      try {
        pushStream?.close?.();
      } catch (_e) {}
      resolve(value);
    };
    const timer = setTimeout(() => finish(null), Math.max(1000, Number(timeoutMs) || LEARN_CALL_PRON_TIMEOUT_MS));

    try {
      const format = sdk.AudioStreamFormat.getWaveFormatPCM(16000, 16, 1);
      pushStream = sdk.AudioInputStream.createPushStream(format);
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const speechConfig = sdk.SpeechConfig.fromSubscription(key, region);
      speechConfig.speechRecognitionLanguage = language;
      recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      const paConfig = new sdk.PronunciationAssessmentConfig(
        reference,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      if (typeof paConfig.enableProsodyAssessment === "boolean" || "enableProsodyAssessment" in paConfig) {
        paConfig.enableProsodyAssessment = reference.split(/\s+/).length >= 3;
      }
      paConfig.applyTo(recognizer);

      const ab = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
      pushStream.write(ab);
      pushStream.close();
      pushStream = null;

      recognizer.recognizeOnceAsync(
        (result) => {
          try {
            if (result?.reason !== sdk.ResultReason.RecognizedSpeech) {
              finish(null);
              return;
            }
            const pa = sdk.PronunciationAssessmentResult.fromResult(result);
            finish(
              normalizePronunciationResult({
                pronunciationScore: pa?.pronunciationScore,
                accuracyScore: pa?.accuracyScore,
                fluencyScore: pa?.fluencyScore,
                completenessScore: pa?.completenessScore,
                prosodyScore: pa?.prosodyScore,
                words: parseAzurePronunciationDetail(result, sdk),
              })
            );
          } catch (_e) {
            finish(null);
          }
        },
        () => finish(null)
      );
    } catch (_e) {
      finish(null);
    }
  });
}

/** Aggregate per-turn Azure scores for the end-of-call summary. */
export function aggregateLearnCallPronunciation(memory = []) {
  const turns = Array.isArray(memory) ? memory : [];
  const scored = [];
  for (const item of turns) {
    if (item?.role !== "user") continue;
    const score = clampScore(item?.pronunciationScore);
    if (score == null) continue;
    scored.push({
      pronunciationScore: score,
      accuracyScore: clampScore(item?.accuracyScore),
      fluencyScore: clampScore(item?.fluencyScore),
      completenessScore: clampScore(item?.completenessScore),
      prosodyScore: clampScore(item?.prosodyScore),
      text: String(item?.content || "").trim(),
      coachItems: Array.isArray(item?.coachItems) ? item.coachItems.slice(0, 2) : [],
    });
  }

  if (!scored.length) {
    return {
      score: null,
      pronunciation: "Chưa đánh giá",
      pronunciationNote:
        "Chưa có điểm phát âm Azure cho cuộc gọi này (chưa nói đủ rõ hoặc dịch vụ chưa trả điểm).",
      pronunciationSamples: [],
      pronunciationCount: 0,
    };
  }

  const avg = (key) => {
    const values = scored.map((row) => row[key]).filter((n) => n != null);
    if (!values.length) return null;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  };

  const pronunciationScore = avg("pronunciationScore");
  const accuracyScore = avg("accuracyScore");
  const fluencyScore = avg("fluencyScore");
  const completenessScore = avg("completenessScore");
  const parts = [];
  if (accuracyScore != null) parts.push(`độ chính xác ${accuracyScore}`);
  if (fluencyScore != null) parts.push(`độ trôi chảy ${fluencyScore}`);
  if (completenessScore != null) parts.push(`độ đầy đủ ${completenessScore}`);
  const weakWords = [];
  for (const row of scored) {
    for (const item of row.coachItems || []) {
      if (item?.word && !weakWords.some((w) => w.word === item.word)) weakWords.push(item);
    }
  }

  return {
    score: pronunciationScore,
    pronunciation: `${pronunciationScore}/100`,
    pronunciationNote:
      scored.length === 1
        ? `Điểm Azure Pronunciation Assessment từ micro${parts.length ? ` (${parts.join(", ")})` : ""}.`
        : `Trung bình ${scored.length} lượt nói — Azure Pronunciation Assessment từ micro${parts.length ? ` (${parts.join(", ")})` : ""}.`,
    pronunciationSamples: scored,
    pronunciationCount: scored.length,
    accuracyScore,
    fluencyScore,
    completenessScore,
    weakWords: weakWords.slice(0, 2),
  };
}
