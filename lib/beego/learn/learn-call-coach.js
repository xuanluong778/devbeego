/**
 * Pronunciation coaching from Azure word/phoneme scores only.
 * Never infers a sound error from a transcript or a text-similarity score.
 */

const MISPRONOUNCED = new Set(["mispronunciation", "mispronounce"]);
const RECOGNITION = new Set(["omission", "insertion", "unexpectedbreak", "missingbreak"]);
const MIN_WORD_ACCURACY = 70;
const MIN_PHONE_ACCURACY = 70;

/** Mouth/tongue cues keyed by IPA or SAPI-style phoneme. Generic filler is not used. */
const PHONEME_HINTS = Object.freeze({
  θ: "Lè lưỡi nhẹ giữa hai răng cửa, thổi hơi, không rung dây thanh.",
  th: "Lè lưỡi nhẹ giữa hai răng cửa, thổi hơi, không rung dây thanh.",
  ð: "Lè lưỡi giữa hai răng cửa, rung nhẹ dây thanh.",
  dh: "Lè lưỡi giữa hai răng cửa, rung nhẹ dây thanh.",
  ʃ: "Môi chu ra, lưỡi đưa lên sát vòm miệng, thổi hơi.",
  sh: "Môi chu ra, lưỡi đưa lên sát vòm miệng, thổi hơi.",
  ʒ: "Giống /ʃ/ nhưng rung dây thanh.",
  zh: "Giống /ʃ/ nhưng rung dây thanh.",
  tʃ: "Lưỡi chạm nướu rồi chu môi, như chữ ch trong cheese.",
  ch: "Lưỡi chạm nướu rồi chu môi, như chữ ch trong cheese.",
  dʒ: "Giống /tʃ/ nhưng rung dây thanh, như j trong job.",
  jh: "Giống /tʃ/ nhưng rung dây thanh, như j trong job.",
  r: "Lưỡi hơi cuộn về sau, không rung đầu lưỡi.",
  ɹ: "Lưỡi hơi cuộn về sau, không rung đầu lưỡi.",
  er: "Lưỡi hơi cuộn về sau, không rung đầu lưỡi.",
  l: "Đầu lưỡi chạm nướu ngay sau răng trên.",
  w: "Môi chu tròn rồi mở nhanh.",
  v: "Răng trên chạm nhẹ môi dưới, rung dây thanh.",
  f: "Răng trên chạm nhẹ môi dưới, thổi hơi, không rung.",
  æ: "Miệng mở rộng, lưỡi thấp và đưa ra trước.",
  ae: "Miệng mở rộng, lưỡi thấp và đưa ra trước.",
  ɪ: "Miệng hơi mở, lưỡi cao phía trước, âm ngắn.",
  ih: "Miệng hơi mở, lưỡi cao phía trước, âm ngắn.",
  i: "Miệng hẹp, môi dãn, lưỡi cao phía trước, âm dài.",
  iy: "Miệng hẹp, môi dãn, lưỡi cao phía trước, âm dài.",
  ʊ: "Môi hơi chu, lưỡi cao phía sau, âm ngắn.",
  uh: "Môi hơi chu, lưỡi cao phía sau, âm ngắn.",
  u: "Môi chu tròn, lưỡi cao phía sau, âm dài.",
  uw: "Môi chu tròn, lưỡi cao phía sau, âm dài.",
  ŋ: "Lưỡi chạm vòm miệng sau, khí đi qua mũi.",
  ng: "Lưỡi chạm vòm miệng sau, khí đi qua mũi.",
  eɪ: "Bắt đầu miệng mở vừa, rồi khép lại thành /ɪ/.",
  ey: "Bắt đầu miệng mở vừa, rồi khép lại thành /ɪ/.",
  aɪ: "Bắt đầu miệng mở, rồi khép thành /ɪ/.",
  ay: "Bắt đầu miệng mở, rồi khép thành /ɪ/.",
});

function clampScore(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function errorType(raw) {
  return String(raw || "None").trim().toLowerCase();
}

function phonemeKey(raw) {
  return String(raw || "")
    .trim()
    .replace(/^\/+|\/+$/g, "")
    .toLowerCase();
}

export function learnCallPhonemeHint(phoneme) {
  const key = phonemeKey(phoneme);
  if (!key) return "";
  return PHONEME_HINTS[key] || PHONEME_HINTS[key.replace(/ː/g, "")] || "";
}

function wordRow(raw = {}) {
  const word = String(raw.word || raw.Word || "").trim();
  if (!word || /^[.,!?]+$/.test(word)) return null;
  const pa = raw.PronunciationAssessment || raw.pronunciationAssessment || raw;
  const accuracy = clampScore(pa.AccuracyScore ?? pa.accuracyScore ?? raw.accuracyScore);
  const type = errorType(pa.ErrorType ?? pa.errorType ?? raw.errorType);
  const phonemes = Array.isArray(raw.Phonemes || raw.phonemes)
    ? (raw.Phonemes || raw.phonemes)
        .map((item) => {
          const phone = String(item?.Phoneme || item?.phoneme || "").trim();
          const pAcc = clampScore(
            item?.PronunciationAssessment?.AccuracyScore ?? item?.accuracyScore ?? item?.PronunciationAssessment?.accuracyScore
          );
          if (!phone || pAcc == null) return null;
          return { phoneme: phone, accuracyScore: pAcc };
        })
        .filter(Boolean)
    : [];
  const weakest = [...phonemes].sort((a, b) => a.accuracyScore - b.accuracyScore)[0] || null;
  return {
    word,
    accuracyScore: accuracy,
    errorType: type || "none",
    phonemes,
    weakestPhoneme: weakest,
  };
}

/** Flatten Azure JSON or SDK detailResult into word rows. Missing detail means no coaching. */
export function learnCallAzureWordScores(raw) {
  if (!raw) return [];
  let words = [];
  if (Array.isArray(raw)) words = raw;
  else if (Array.isArray(raw.Words)) words = raw.Words;
  else if (Array.isArray(raw.words)) words = raw.words;
  else if (Array.isArray(raw?.NBest?.[0]?.Words)) words = raw.NBest[0].Words;
  else if (Array.isArray(raw?.nBest?.[0]?.words)) words = raw.nBest[0].words;
  else if (Array.isArray(raw?.detailResult?.Words)) words = raw.detailResult.Words;
  return words.map(wordRow).filter(Boolean);
}

/**
 * Classify one Azure word. Text-only comparison never produces a pronunciation error.
 * @returns {"pronunciation"|"recognition"|"insufficient"|""}
 */
export function learnCallPronunciationKind(word) {
  if (!word?.word) return "";
  const type = errorType(word.errorType);
  if (RECOGNITION.has(type)) return "recognition";
  if (word.accuracyScore == null && !word.phonemes?.length) return "insufficient";
  if (MISPRONOUNCED.has(type) && word.weakestPhoneme && word.weakestPhoneme.accuracyScore < MIN_PHONE_ACCURACY) {
    return "pronunciation";
  }
  if (MISPRONOUNCED.has(type) && word.accuracyScore != null && word.accuracyScore < MIN_WORD_ACCURACY && word.phonemes?.length) {
    return "pronunciation";
  }
  if (!word.phonemes?.length && (word.accuracyScore == null || word.accuracyScore < MIN_WORD_ACCURACY)) {
    return "insufficient";
  }
  return "";
}

/** At most two coachable words, each with a phoneme-backed hint. */
export function learnCallCoachItems(words, { max = 2 } = {}) {
  const rows = (Array.isArray(words) ? words : [])
    .map((word) => ({ ...word, kind: learnCallPronunciationKind(word) }))
    .filter((word) => word.kind === "pronunciation")
    .sort((a, b) => (a.accuracyScore ?? 100) - (b.accuracyScore ?? 100))
    .slice(0, Math.max(1, Math.min(2, Number(max) || 2)));
  return rows.map((word) => {
    const phoneme = word.weakestPhoneme?.phoneme || "";
    const hint = learnCallPhonemeHint(phoneme);
    return {
      word: word.word,
      accuracyScore: word.accuracyScore,
      phoneme,
      phonemeAccuracy: word.weakestPhoneme?.accuracyScore ?? null,
      hintVi: hint || (phoneme ? `Nghe mẫu và nhắc lại âm /${phoneme}/ trong từ ${word.word}.` : ""),
      sampleText: word.word,
      kind: "pronunciation",
      evidence: "azure_phoneme",
    };
  }).filter((item) => item.phoneme);
}

export function learnCallCoachMessage(words) {
  const items = learnCallCoachItems(words);
  if (items.length) {
    return { type: "pronunciation_coach", items, evidence: "azure_phoneme" };
  }
  const rows = Array.isArray(words) ? words : [];
  if (!rows.length) {
    return { type: "pronunciation_coach", items: [], reason: "insufficient", notice: "Mình chưa nghe rõ, bạn thử lại nhé" };
  }
  if (rows.some((word) => learnCallPronunciationKind(word) === "recognition")) {
    return { type: "pronunciation_coach", items: [], reason: "recognition", notice: "Mình chưa nghe rõ, bạn thử lại nhé" };
  }
  return null;
}
