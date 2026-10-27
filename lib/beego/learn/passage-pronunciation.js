/**
 * Score a WAV (PCM16 mono) with Azure Pronunciation Assessment.
 * Returns null scores when the service does not recognize speech — never a synthetic score.
 */
import { feedbackFromAzureWords } from "@/lib/beego/learn/passage-read";

export const PASSAGE_WAV_MAX_BYTES = 4_500_000;
export const PASSAGE_MIN_PCM_BYTES = 16_000; // ~0.5s at 16kHz 16-bit
export const PASSAGE_TARGET_RATE = 16000;
/** REST scores one shot up to 30s. Longer reads use the Speech SDK continuous mode. */
export const PASSAGE_REST_MAX_SECONDS = 30;
/** Stay under the site proxy (180s) so scoring can finish and return. */
export const PASSAGE_MAX_SECONDS = 90;

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

function spokenKey(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/[^a-z0-9']+/g, "");
}

export function passageReferenceWords(referenceText) {
  return String(referenceText || "")
    .split(/\s+/)
    .map(spokenKey)
    .filter(Boolean);
}

/** Longest-common-subsequence opcodes: equal, insert, delete. */
function diffOpcodes(left, right) {
  const n = left.length;
  const m = right.length;
  const dp = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = left[i] === right[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (left[i] === right[j]) {
      ops.push(["equal", i, i + 1, j, j + 1]);
      i += 1;
      j += 1;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push(["delete", i, i + 1, j, j]);
      i += 1;
    } else {
      ops.push(["insert", i, i, j, j + 1]);
      j += 1;
    }
  }
  while (i < n) {
    ops.push(["delete", i, i + 1, j, j]);
    i += 1;
  }
  while (j < m) {
    ops.push(["insert", i, i, j, j + 1]);
    j += 1;
  }
  const merged = [];
  for (const op of ops) {
    const prev = merged[merged.length - 1];
    if (prev && prev[0] === op[0] && prev[2] === op[1] && prev[4] === op[3]) {
      prev[2] = op[2];
      prev[4] = op[4];
    } else {
      merged.push(op);
    }
  }
  return merged;
}

function average(values) {
  const list = values.filter((n) => Number.isFinite(n));
  if (!list.length) return null;
  return list.reduce((sum, n) => sum + n, 0) / list.length;
}

/**
 * Combine continuous-mode segments the way Azure's long-audio sample does.
 * Segment PronScore is not used: each segment is scored against the whole passage.
 * Word accuracy, offsets, and prosody still come from Azure.
 */
export function aggregateContinuousAssessment({ referenceText, segments }) {
  const referenceTokens = String(referenceText || "")
    .split(/\s+/)
    .map((raw) => ({
      key: spokenKey(raw),
      word: raw.replace(/^[^A-Za-z0-9']+|[^A-Za-z0-9']+$/g, "") || spokenKey(raw),
    }))
    .filter((row) => row.key);
  const referenceWords = referenceTokens.map((row) => row.key);
  const heard = [];
  const prosodyScores = [];
  const fluencyScores = [];
  const displayParts = [];
  for (const segment of Array.isArray(segments) ? segments : []) {
    if (segment?.prosodyScore != null) prosodyScores.push(Number(segment.prosodyScore));
    if (segment?.fluencyScore != null) fluencyScores.push(Number(segment.fluencyScore));
    if (segment?.displayText) displayParts.push(String(segment.displayText).trim());
    for (const word of Array.isArray(segment?.words) ? segment.words : []) {
      if (!word?.word) continue;
      heard.push({
        word: String(word.word),
        error: String(word.error || "None"),
        accuracy: word.accuracy == null ? null : Number(word.accuracy),
        phonemes: Array.isArray(word.phonemes) ? word.phonemes : [],
        offset: Number.isFinite(Number(word.offset)) ? Number(word.offset) : null,
        duration: Number.isFinite(Number(word.duration)) ? Number(word.duration) : null,
      });
    }
  }
  if (!referenceWords.length || !heard.length) return null;

  const heardKeys = heard.map((word) => spokenKey(word.word));
  const finalWords = [];
  for (const [tag, i1, i2, j1, j2] of diffOpcodes(referenceWords, heardKeys)) {
    if (tag === "equal") {
      for (let j = j1; j < j2; j += 1) finalWords.push({ ...heard[j] });
    } else if (tag === "insert") {
      for (let j = j1; j < j2; j += 1) finalWords.push({ ...heard[j], error: "Insertion" });
    } else if (tag === "delete") {
      for (let i = i1; i < i2; i += 1) {
        finalWords.push({
          word: referenceTokens[i].word,
          error: "Omission",
          accuracy: null,
          phonemes: [],
          offset: null,
          duration: null,
        });
      }
    }
  }

  for (const word of finalWords) {
    if (word.error === "None" && word.accuracy != null && word.accuracy < 60) {
      word.error = "Mispronunciation";
    }
  }

  const accuracyScore = average(
    finalWords.filter((word) => word.error !== "Insertion" && word.error !== "Omission").map((word) => word.accuracy)
  );
  const contentCount = finalWords.filter((word) => word.error !== "Insertion").length;
  const clearCount = finalWords.filter((word) => word.error === "None").length;
  const completenessScore = contentCount > 0 ? Math.min(100, (clearCount / contentCount) * 100) : null;

  const timed = heard.filter((word) => word.offset != null && word.duration != null);
  let fluencyScore = null;
  if (timed.length) {
    const start = timed[0].offset;
    const last = timed[timed.length - 1];
    const span = last.offset + last.duration - start;
    const goodTicks = timed.reduce((sum, word) => {
      if (word.error !== "None") return sum;
      return sum + word.duration + 100000;
    }, 0);
    if (span > 0) fluencyScore = Math.min(100, (goodTicks / span) * 100);
  }
  if (fluencyScore == null) fluencyScore = average(fluencyScores);

  const prosodyScore = average(prosodyScores);
  const parts = [accuracyScore, fluencyScore, completenessScore].filter((n) => n != null);
  if (prosodyScore != null) parts.push(prosodyScore);
  if (accuracyScore == null || fluencyScore == null || completenessScore == null) return null;
  const sorted = [...parts].sort((a, b) => a - b);
  const pronunciationScore = prosodyScore != null && sorted.length === 4
    ? sorted[0] * 0.4 + sorted[1] * 0.2 + sorted[2] * 0.2 + sorted[3] * 0.2
    : sorted[0] * 0.6 + sorted[1] * 0.2 + sorted[2] * 0.2;

  return {
    pronunciationScore: clampScore(pronunciationScore),
    accuracyScore: clampScore(accuracyScore),
    fluencyScore: clampScore(fluencyScore),
    completenessScore: clampScore(completenessScore),
    prosodyScore: clampScore(prosodyScore),
    words: finalWords.map((word) => ({
      word: word.word,
      error: word.error,
      accuracy: word.accuracy == null ? null : clampScore(word.accuracy),
      phonemes: word.phonemes,
    })),
    displayText: displayParts.join(" ").trim(),
    source: "azure",
  };
}

function readSegmentWords(detail) {
  const best = Array.isArray(detail?.NBest) ? detail.NBest[0] : null;
  if (!best) return null;
  const parsed = readAzureDetail(detail);
  if (!parsed) return null;
  const rawWords = Array.isArray(best.Words) ? best.Words : [];
  parsed.words = parsed.words.map((word, index) => {
    const raw = rawWords[index] || {};
    return {
      ...word,
      offset: Number(raw.Offset),
      duration: Number(raw.Duration),
    };
  });
  return parsed;
}

function assessPassageWavContinuous({ pcm, reference, speechKey, speechRegion }) {
  const timeoutMs = 150000;
  return import("microsoft-cognitiveservices-speech-sdk").then((sdk) => new Promise((resolve) => {
    let settled = false;
    let recognizer = null;
    let pushStream = null;
    const segments = [];
    let failMessage = "";
    const finish = (value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { recognizer?.close?.(); } catch (_e) { /* already closed */ }
      try { pushStream?.close?.(); } catch (_e) { /* already closed */ }
      resolve(value);
    };
    const timer = setTimeout(() => {
      finish({ ok: false, code: "PRONUNCIATION_TIMEOUT", message: "Dịch vụ chấm phát âm không phản hồi." });
    }, timeoutMs);
    try {
      const format = sdk.AudioStreamFormat.getWaveFormatPCM(PASSAGE_TARGET_RATE, 16, 1);
      pushStream = sdk.AudioInputStream.createPushStream(format);
      const audioConfig = sdk.AudioConfig.fromStreamInput(pushStream);
      const speechConfig = sdk.SpeechConfig.fromSubscription(speechKey, speechRegion);
      speechConfig.speechRecognitionLanguage = "en-US";
      if (sdk.PropertyId?.Speech_SegmentationSilenceTimeoutMs != null) {
        speechConfig.setProperty(sdk.PropertyId.Speech_SegmentationSilenceTimeoutMs, "2500");
      }
      recognizer = new sdk.SpeechRecognizer(speechConfig, audioConfig);
      const paConfig = new sdk.PronunciationAssessmentConfig(
        reference,
        sdk.PronunciationAssessmentGradingSystem.HundredMark,
        sdk.PronunciationAssessmentGranularity.Phoneme,
        true
      );
      paConfig.phonemeAlphabet = "IPA";
      paConfig.enableProsodyAssessment = passageReferenceWords(reference).length >= 6;
      paConfig.applyTo(recognizer);

      recognizer.recognized = (_sender, event) => {
        try {
          if (event?.result?.reason !== sdk.ResultReason.RecognizedSpeech) return;
          const jsonText = event.result.properties?.getProperty?.(sdk.PropertyId.SpeechServiceResponse_JsonResult);
          const detail = jsonText ? readSegmentWords(JSON.parse(jsonText)) : null;
          if (detail) segments.push(detail);
        } catch (_e) { /* skip a bad segment */ }
      };
      recognizer.canceled = (_sender, event) => {
        if (event?.reason === sdk.CancellationReason.Error) {
          failMessage = String(event.errorDetails || "");
        }
      };
      recognizer.sessionStopped = () => {
        const scores = aggregateContinuousAssessment({ referenceText: reference, segments });
        const heardLetters = String(scores?.displayText || "").replace(/[^a-z]/gi, "");
        if (!scores || scores.pronunciationScore == null || heardLetters.length < 2) {
          finish({
            ok: false,
            code: failMessage ? "PRONUNCIATION_FAILED" : "NO_SPEECH",
            message: failMessage
              ? "Azure không chấm được bản ghi này."
              : "Azure không nhận ra lời đọc. Hãy đọc to, gần micro, rồi ghi lại.",
          });
          return;
        }
        scores.feedbackVi = feedbackFromAzureWords(scores.words);
        finish({ ok: true, scores });
      };

      recognizer.startContinuousRecognitionAsync(
        () => {
          try {
            const audio = pcm.buffer.slice(pcm.byteOffset, pcm.byteOffset + pcm.byteLength);
            pushStream.write(audio);
            pushStream.close();
            pushStream = null;
          } catch (_e) {
            finish({ ok: false, code: "PRONUNCIATION_FAILED", message: "Azure không chấm được bản ghi này." });
          }
        },
        () => finish({ ok: false, code: "PRONUNCIATION_FAILED", message: "Azure không chấm được bản ghi này." })
      );
    } catch (_e) {
      finish({ ok: false, code: "PRONUNCIATION_FAILED", message: "Azure không chấm được bản ghi này." });
    }
  }));
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
      message: "Mỗi lần chấm tối đa 90 giây. Hãy đọc lại đoạn này.",
    };
  }
  if (seconds > PASSAGE_REST_MAX_SECONDS) {
    return assessPassageWavContinuous({ pcm, reference, speechKey: key, speechRegion: region });
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
