import { scoreText, tokenizeWords } from "@/lib/client-pronunciation-eval";

const STOP = new Set(
  "a an the to of and or my your me let is am are i you we for in on at with new do does did be it this that".split(" ")
);

function expandSpeech(value) {
  return String(value || "")
    .replace(/\bi'm\b/gi, "i am")
    .replace(/\bwhat's\b/gi, "what is")
    .replace(/\blet's\b/gi, "let us")
    .replace(/\bit's\b/gi, "it is")
    .replace(/\bthat's\b/gi, "that is")
    .replace(/\bwon't\b/gi, "will not")
    .replace(/\bcan't\b/gi, "cannot")
    .replace(/\bshan't\b/gi, "shall not")
    .replace(/\b([a-z]+)n't\b/gi, "$1 not");
}

export function contentWords(text) {
  return tokenizeWords(expandSpeech(text)).filter((word) => !STOP.has(word) && word.length > 1);
}

export function focusWordsForSpeak(exercise, target) {
  const fromExt = exercise?.extensions?.focusWords;
  if (Array.isArray(fromExt) && fromExt.length) {
    const phrases = [];
    for (const item of fromExt) {
      const phrase = String(item || "").replace(/\s+/g, " ").trim();
      const key = phrase.toLowerCase();
      if (!phrase || phrases.some((row) => row.toLowerCase() === key)) continue;
      phrases.push(phrase);
    }
    return phrases;
  }
  return contentWords(target);
}

function phraseTokens(phrase) {
  return tokenizeWords(expandSpeech(phrase));
}

const GLUE_KEEP = new Set(["not", "to"]);

/** Content tokens of a focus phrase. Glue like "the" can sit between them in a real sentence. */
function requiredTokens(phrase) {
  const all = phraseTokens(phrase);
  const kept = all.filter((word) => !STOP.has(word) || GLUE_KEEP.has(word));
  return kept.length ? kept : all;
}

function findToken(spokenWords, token, from, to) {
  const end = Math.min(spokenWords.length, to);
  for (let i = from; i < end; i += 1) {
    if (tokenClose(spokenWords[i], token)) return i;
  }
  return -1;
}

/**
 * A focus item can be one word or a phrase. Words may have a short gap,
 * as in "show you around" for "show around".
 */
export function phraseHit(spokenWords, phrase) {
  const parts = requiredTokens(phrase);
  if (!parts.length || !spokenWords?.length) return false;
  if (parts.length === 1) return findToken(spokenWords, parts[0], 0, spokenWords.length) >= 0;
  for (let start = 0; start < spokenWords.length; start += 1) {
    if (!tokenClose(spokenWords[start], parts[0])) continue;
    let from = start + 1;
    let ok = true;
    for (let index = 1; index < parts.length; index += 1) {
      const at = findToken(spokenWords, parts[index], from, from + 4);
      if (at < 0) {
        ok = false;
        break;
      }
      from = at + 1;
    }
    if (ok) return true;
  }
  return false;
}

const INFLECTION = /^(s|es|ed|ing|er|est|d)$/;

function bareStem(word) {
  return String(word || "")
    .replace(/(tion|sion|ment|ness|ing|ed|es|ly|s)$/i, "")
    .replace(/e$/i, "");
}

function tokenClose(spoken, wanted) {
  if (!spoken || !wanted) return false;
  if (spoken === wanted) return true;
  if (spoken.length >= 4 && wanted.length >= 4 && scoreText(spoken, wanted) >= 85) return true;
  if (spoken.length < 3 || wanted.length < 3) return false;
  if (spoken.startsWith(wanted) && INFLECTION.test(spoken.slice(wanted.length))) return true;
  if (wanted.startsWith(spoken) && INFLECTION.test(wanted.slice(spoken.length))) return true;
  // provide → providing drops the final e.
  if (wanted.endsWith("e")) {
    const stem = wanted.slice(0, -1);
    if (stem.length >= 3 && spoken.startsWith(stem) && /^(ing|ed|er|est)$/.test(spoken.slice(stem.length))) return true;
  }
  if (spoken.endsWith("e")) {
    const stem = spoken.slice(0, -1);
    if (stem.length >= 3 && wanted.startsWith(stem) && /^(ing|ed|er|est)$/.test(wanted.slice(stem.length))) return true;
  }
  const left = bareStem(spoken);
  const right = bareStem(wanted);
  if (left.length >= 4 && (left === right || (Math.abs(left.length - right.length) <= 1 && (left.startsWith(right) || right.startsWith(left))))) {
    return true;
  }
  return false;
}

function bestWordScore(spokenWords, word) {
  let best = 0;
  for (const part of spokenWords) {
    if (tokenClose(part, word)) return 100;
    best = Math.max(best, scoreText(part, word));
  }
  return best;
}

function allowedChunk(exercise, practiceChunk) {
  const chunk = String(practiceChunk || "").trim();
  if (!chunk) return "";
  const chunks = Array.isArray(exercise?.extensions?.practiceChunks) ? exercise.extensions.practiceChunks : [];
  const found = chunks.find((item) => String(item || "").trim().toLowerCase() === chunk.toLowerCase());
  return found ? String(found).trim() : "";
}

export function reviewVariantText(exercise, variantId) {
  const id = String(variantId || "").trim();
  if (!id) return "";
  const variants = Array.isArray(exercise?.extensions?.reviewVariants) ? exercise.extensions.reviewVariants : [];
  const found = variants.find((item) => String(item?.id || "") === id && String(item?.text || "").trim());
  return found ? String(found.text).trim() : "";
}

/**
 * Text-match coaching for listen-and-repeat. This is not a pronunciation score.
 */
export function scoreRecognizedSpeech(exercise, transcript, { variantText = "", practiceChunk = "" } = {}) {
  const chunk = allowedChunk(exercise, practiceChunk);
  const target = chunk || String(variantText || exercise?.speakTarget || exercise?.extensions?.speakTarget || "").trim();
  const text = String(transcript || "").trim();
  const spokenWords = tokenizeWords(expandSpeech(text));
  const listed = chunk ? [chunk] : focusWordsForSpeak(exercise, target);
  const targetWords = tokenizeWords(expandSpeech(target));
  const present = listed.filter((phrase) => phraseHit(targetWords, phrase));
  const focus = !chunk && present.length ? present : listed;
  const recognitionScore = target ? scoreText(expandSpeech(text), expandSpeech(target)) : 0;
  const missing = [];
  const hit = [];
  for (const word of focus) {
    if (phraseHit(spokenWords, word)) hit.push(word);
    else missing.push(word);
  }
  const uncertain =
    !text ||
    spokenWords.length === 0 ||
    (targetWords.length >= 4 && spokenWords.length <= 1 && missing.length === focus.length);
  const min = Number(exercise?.minScore ?? exercise?.extensions?.minScore ?? 65);
  const focusOk = focus.length === 0 ? recognitionScore >= 80 : missing.length === 0;
  const passed = !uncertain && focusOk && recognitionScore >= (chunk ? 65 : min);
  let feedbackVi;
  if (uncertain) {
    feedbackVi = "Chưa nhận chắc lời nói. Hãy nói lại gần micro, chậm hơn. Đây chưa phải kết luận bạn phát âm sai.";
  } else if (!passed && missing.length) {
    feedbackVi = `Độ khớp lời nhận dạng: ${recognitionScore}%. Đây không phải điểm phát âm. Cần luyện: ${missing.join(", ")}.`;
  } else if (!passed) {
    feedbackVi = `Độ khớp lời nhận dạng: ${recognitionScore}%. Đây không phải điểm phát âm. Hãy nói đủ cụm: ${target}`;
  } else if (chunk) {
    feedbackVi = `Cụm ngắn đã khớp lời nhận dạng (${recognitionScore}%). Đây không phải điểm phát âm.`;
  } else {
    feedbackVi = `Độ khớp lời nhận dạng: ${recognitionScore}%. Đủ từ trọng tâm. Máy chưa chấm phát âm từng âm.`;
  }
  return {
    score: recognitionScore,
    passed,
    transcript: text,
    uncertain,
    notPronunciationAssessment: true,
    softPass: Boolean(passed),
    focusWords: focus,
    focusHit: hit,
    focusMissing: missing,
    practiceChunk: chunk,
    feedbackVi,
  };
}

function tidyLine(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function withPeriod(value) {
  const text = tidyLine(value).replace(/[.?!]+$/g, "");
  if (!text) return "";
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
}

/**
 * A review line that still contains the lesson phrases and is not the original sentence.
 */
export function reviewSentenceFor(model, phrases) {
  const list = [];
  for (const item of phrases || []) {
    const phrase = tidyLine(item);
    const key = phrase.toLowerCase();
    if (!phrase || list.some((row) => row.toLowerCase() === key)) continue;
    list.push(phrase);
  }
  const source = tidyLine(model);
  const spokenOk = (line) => {
    if (!line) return false;
    if (source && scoreText(expandSpeech(line), expandSpeech(source)) >= 65) return false;
    const spoken = tokenizeWords(expandSpeech(line));
    return list.every((phrase) => phraseHit(spoken, phrase));
  };
  const parts = source
    .replace(/[.?!]+$/g, "")
    .split(/\s*;\s*|\s*,\s+and\s+/i)
    .map((part) => tidyLine(part))
    .filter(Boolean);
  if (parts.length >= 2 && parts.every((part) => tokenizeWords(part).length >= 4)) {
    const reversed = withPeriod([...parts].reverse().join(". "));
    if (spokenOk(reversed)) return reversed;
  }
  const joined =
    list.length <= 1
      ? list[0] || ""
      : list.length === 2
        ? `${list[0]} and ${list[1]}`
        : `${list.slice(0, -1).join(", ")}, and ${list[list.length - 1]}`;
  const frames = joined
    ? [
        `Please use ${joined} in a new sentence`,
        `Today, make a new sentence with ${joined}`,
        `Say a different line that still uses ${joined}`,
        `This review line is new. It still needs ${joined}`,
      ]
    : [];
  for (const frame of frames) {
    const line = withPeriod(frame);
    if (spokenOk(line)) return line;
  }
  return withPeriod(frames[frames.length - 1] || "");
}

/** Several valid greetings, not one exact string. */
export function gradeGreetingProduction(answer) {
  const raw = answer && typeof answer === "object" ? answer.text ?? answer.value ?? "" : answer;
  const text = tokenizeWords(expandSpeech(raw)).join(" ");
  if (!text) return false;
  const words = text.split(" ").filter(Boolean);
  if (words.length < 2 || words.length > 30) return false;
  const greeting = /\b(hello|hi)\b/.test(text) || /\bnice to meet you\b/.test(text);
  const self =
    /\bintroduce\b/.test(text) ||
    /\bi am\b/.test(text) ||
    /\bmy name is\b/.test(text);
  return greeting && self;
}

/** Any sentence that uses every focus phrase of the lesson. Not one exact answer. */
export function gradeFocusProduction(answer, phrases) {
  const raw = answer && typeof answer === "object" ? answer.text ?? answer.value ?? "" : answer;
  const spoken = tokenizeWords(expandSpeech(raw));
  if (spoken.length < 4 || spoken.length > 40) return false;
  const need = [];
  for (const item of phrases || []) {
    const phrase = String(item || "").replace(/\s+/g, " ").trim();
    if (!phrase || need.some((row) => row.toLowerCase() === phrase.toLowerCase())) continue;
    need.push(phrase);
  }
  if (!need.length) return false;
  return need.every((phrase) => phraseHit(spoken, phrase));
}
