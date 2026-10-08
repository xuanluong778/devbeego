/**
 * Listen and type the sentence.
 * Grading is exact after a small normalization.
 * The word diff only explains the result.
 */

const CONTRACTIONS = {
  "don't": "do not",
  "doesn't": "does not",
  "didn't": "did not",
  "can't": "can not",
  cannot: "can not",
  "won't": "will not",
  "i'm": "i am",
  "it's": "it is",
  "that's": "that is",
  "what's": "what is",
  "you're": "you are",
  "we're": "we are",
  "they're": "they are",
  "he's": "he is",
  "she's": "she is",
  "isn't": "is not",
  "aren't": "are not",
  "wasn't": "was not",
  "weren't": "were not",
  "i've": "i have",
  "you've": "you have",
  "i'll": "i will",
  "we'll": "we will",
  "let's": "let us",
};

export function canonicalListenText(raw) {
  const text = String(raw || "")
    .replace(/[’‘]/g, "'")
    .toLowerCase()
    .replace(/[“”]/g, " ")
    .replace(/[.!,?;:]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text
    .split(" ")
    .filter(Boolean)
    .map((token) => CONTRACTIONS[token] || token)
    .join(" ");
}

export function gradeListenDictation(expected, given) {
  const left = canonicalListenText(expected);
  const right = canonicalListenText(given);
  if (!left || !right) return false;
  return left === right;
}

export function dictationTokenDiff(expectedRaw, givenRaw) {
  const expected = canonicalListenText(expectedRaw).split(" ").filter(Boolean);
  const given = canonicalListenText(givenRaw).split(" ").filter(Boolean);
  const n = expected.length;
  const m = given.length;
  const cost = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 0; i <= n; i += 1) cost[i][0] = i;
  for (let j = 0; j <= m; j += 1) cost[0][j] = j;
  for (let i = 1; i <= n; i += 1) {
    for (let j = 1; j <= m; j += 1) {
      const replace = cost[i - 1][j - 1] + (expected[i - 1] === given[j - 1] ? 0 : 1);
      cost[i][j] = Math.min(cost[i - 1][j] + 1, cost[i][j - 1] + 1, replace);
    }
  }
  const marks = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && expected[i - 1] === given[j - 1] && cost[i][j] === cost[i - 1][j - 1]) {
      marks.push({ kind: "ok", text: expected[i - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && cost[i][j] === cost[i - 1][j - 1] + 1) {
      marks.push({ kind: "wrong", text: expected[i - 1], written: given[j - 1] });
      i -= 1;
      j -= 1;
    } else if (i > 0 && cost[i][j] === cost[i - 1][j] + 1) {
      marks.push({ kind: "missing", text: expected[i - 1] });
      i -= 1;
    } else {
      marks.push({ kind: "extra", text: given[j - 1] });
      j -= 1;
    }
  }
  return marks.reverse();
}

export function dictationMarkLabel(mark) {
  if (!mark) return "";
  if (mark.kind === "missing") return `${mark.text} (thiếu)`;
  if (mark.kind === "extra") return `${mark.text} (thừa)`;
  if (mark.kind === "wrong") return `${mark.text} (sai, bạn viết ${mark.written})`;
  return mark.text;
}

export function shouldSubmitDictation({ key, isComposing, value } = {}) {
  if (key !== "Enter" || isComposing) return false;
  return String(value || "").trim().length > 0;
}

export function dictationRecordsAttempt(kind) {
  return kind === "first";
}

export function meaningForTranscript(line, phrases) {
  const key = canonicalListenText(line);
  const found = (phrases || []).find((item) => canonicalListenText(item?.en) === key);
  return found?.vi ? String(found.vi).trim() : "";
}

export function buildListenDictation(line, { meaning = "", partNumber = 1 } = {}) {
  const transcript = String(line || "").replace(/\s+/g, " ").trim();
  if (!transcript) return null;
  const words = transcript.split(" ").filter(Boolean);
  return {
    transcript,
    meaning: String(meaning || "").trim(),
    hintMode: Number(partNumber) <= 4 ? "count" : "none",
    wordCount: words.length,
  };
}
