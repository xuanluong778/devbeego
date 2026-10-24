/**
 * Score a WAV (PCM16 mono) with Azure Pronunciation Assessment.
 * Returns null scores when the service does not recognize speech — never a synthetic score.
 */
import { feedbackFromAzureWords } from "@/lib/beego/learn/passage-read";

export const PASSAGE_WAV_MAX_BYTES = 4_500_000;
export const PASSAGE_MIN_PCM_BYTES = 16_000; // ~0.5s at 16kHz 16-bit
export const PASSAGE_TARGET_RATE = 16000;
/** Azure pronunciation assessment on one request accepts at most 30 seconds. */
export const PASSAGE_MAX_SECONDS = 30;

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function parseWavPcm16(buffer) {
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  if (buf.length < 44 || buf.toString("ascii", 0, 4) !== "RIFF" || buf.toString("ascii", 8, 12) !== "WAVE") {
    const err = new Error("Audio phải là WAV.");
    err.code = "AUDIO_FORMAT";
    throw err;
  }
  let offset = 12;
  let sampleRate = 0;
  let channels = 0;
  let bits = 0;
  let data = null;
  while (offset + 8 <= buf.length) {
    const id = buf.toString("ascii", offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (id === "fmt ") {
      channels = buf.readUInt16LE(start + 2);
      sampleRate = buf.readUInt32LE(start + 4);
      bits = buf.readUInt16LE(start + 14);
    } else if (id === "data") {
      data = buf.subarray(start, Math.min(buf.length, start + size));
    }
    offset = start + size + (size % 2);
  }
  if (!data || channels !== 1 || bits !== 16 || sampleRate !== PASSAGE_TARGET_RATE) {
    const err = new Error("WAV phải là PCM 16-bit, mono, 16000 Hz.");
    err.code = "AUDIO_FORMAT";
    throw err;
  }
  if (data.length < PASSAGE_MIN_PCM_BYTES) {
    const err = new Error("Bản ghi quá ngắn.");
    err.code = "AUDIO_TOO_SHORT";
    throw err;
  }
  if (data.length > PASSAGE_WAV_MAX_BYTES) {
    const err = new Error("Bản ghi vượt quá dung lượng cho phép.");
    err.code = "AUDIO_TOO_LARGE";
    throw err;
  }
  return data;
}

function readAzureDetail(data) {
  const best = Array.isArray(data?.NBest) ? data.NBest[0] : null;
  if (!best) return null;
  const pa = best.PronunciationAssessment || {};
  const words = (Array.isArray(best.Words) ? best.Words : []).map((row) => {
    const nested = row?.PronunciationAssessment || {};
    return {
      word: String(row?.Word || "").trim(),
      error: String(nested.ErrorType || row?.ErrorType || "None"),
      accuracy: clampScore(nested.AccuracyScore ?? row?.AccuracyScore),
      phonemes: (Array.isArray(row?.Phonemes) ? row.Phonemes : []).map((phone) => {
        const phoneScore = phone?.PronunciationAssessment || {};
        return {
          phoneme: String(phone?.Phoneme || "").trim(),
          accuracy: clampScore(phoneScore.AccuracyScore ?? phone?.AccuracyScore),
        };
      }).filter((phone) => phone.phoneme),
    };
  }).filter((row) => row.word);
  return {
    pronunciationScore: clampScore(pa.PronScore ?? best.PronScore),
    accuracyScore: clampScore(pa.AccuracyScore ?? best.AccuracyScore),
    fluencyScore: clampScore(pa.FluencyScore ?? best.FluencyScore),
    completenessScore: clampScore(pa.CompletenessScore ?? best.CompletenessScore),
    prosodyScore: clampScore(pa.ProsodyScore ?? best.ProsodyScore),
    displayText: String(best.Display || best.Lexical || data?.DisplayText || "").trim(),
    words,
  };
}

/**
 * @returns {Promise<{ok:true, scores:object}|{ok:false, code:string, message:string}>}
 */
export async function assessPassageWav({ wavBuffer, referenceText, speechKey, speechRegion }) {
  const key = String(speechKey || "").trim();
  const region = String(speechRegion || "").trim();
  const reference = String(referenceText || "").trim();
  if (!key || !region) {
    return { ok: false, code: "PRONUNCIATION_UNCONFIGURED", message: "Chưa cấu hình Azure Speech trên server." };
  }
  if (!reference) {
    return { ok: false, code: "REFERENCE_MISSING", message: "Bài đọc không có đoạn văn." };
  }
  let pcm;
  try {
    pcm = parseWavPcm16(wavBuffer);
  } catch (error) {
    return { ok: false, code: error.code || "AUDIO_FORMAT", message: error.message || "Audio không hợp lệ." };
  }
  const seconds = pcm.length / 2 / PASSAGE_TARGET_RATE;
  if (seconds > PASSAGE_MAX_SECONDS) {
    return {
      ok: false,
      code: "AUDIO_TOO_LONG",
      message: "Azure chấm một lần tối đa 30 giây. Hãy đọc lại đoạn này.",
    };
  }

  const params = {
    ReferenceText: reference,
    GradingSystem: "HundredMark",
    Granularity: "Phoneme",
    Dimension: "Comprehensive",
    PhonemeAlphabet: "IPA",
    EnableMiscue: true,
    EnableProsodyAssessment: reference.split(/\s+/).filter(Boolean).length >= 6,
  };
  const header = Buffer.from(JSON.stringify(params), "utf8").toString("base64");
  const url = `https://${region}.stt.speech.microsoft.com/speech/recognition/conversation/cognitiveservices/v1?language=en-US&format=detailed`;
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": key,
        "Content-Type": "audio/wav; codecs=audio/pcm; samplerate=16000",
        Accept: "application/json",
        "Pronunciation-Assessment": header,
      },
      body: wavBuffer,
      signal: AbortSignal.timeout(45000),
    });
  } catch {
    return { ok: false, code: "PRONUNCIATION_TIMEOUT", message: "Dịch vụ chấm phát âm không phản hồi." };
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok || !data) {
    return { ok: false, code: "PRONUNCIATION_FAILED", message: "Azure không chấm được bản ghi này." };
  }
  const detail = readAzureDetail(data);
  const heardLetters = String(detail?.displayText || data.DisplayText || "").replace(/[^a-z]/gi, "");
  const status = String(data.RecognitionStatus || "");
  if (status !== "Success" || heardLetters.length < 2 || !detail) {
    return {
      ok: false,
      code: "NO_SPEECH",
      message: "Azure không nhận ra lời đọc. Hãy đọc to, gần micro, rồi ghi lại.",
    };
  }
  if (detail.pronunciationScore == null) {
    return { ok: false, code: "NO_SCORE", message: "Azure không trả điểm phát âm cho bản ghi này." };
  }
  const scores = {
    pronunciationScore: detail.pronunciationScore,
    accuracyScore: detail.accuracyScore,
    fluencyScore: detail.fluencyScore,
    completenessScore: detail.completenessScore,
    prosodyScore: detail.prosodyScore,
    words: detail.words,
    source: "azure",
  };
  scores.feedbackVi = feedbackFromAzureWords(scores.words);
  return { ok: true, scores };
}
