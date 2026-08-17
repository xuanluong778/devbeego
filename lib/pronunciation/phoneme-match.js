/** IPA phoneme helpers — chỉ dùng cho tab /pronunciation */

const MULTI_PHONEMES = [
  "tʃ",
  "dʒ",
  "oʊ",
  "əʊ",
  "aɪ",
  "ɔɪ",
  "aʊ",
  "eɪ",
  "ɪə",
  "eə",
  "ʊə",
  "uː",
  "iː",
  "ɑː",
  "ɔː",
  "ɜː",
  "ɜːr",
  "ər",
  "oʊr",
  "ɔːr",
  "iər",
  "ʊr",
  "ŋ",
  "θ",
  "ð",
  "ʃ",
  "ʒ",
  "æ",
  "ʌ",
  "ɪ",
  "ʊ",
  "ə",
  "ɛ",
  "ɑ",
  "ɔ",
  "ɒ",
  "e",
  "o",
  "a",
  "i",
  "u",
];

const K_ALIASES = new Set(["k"]);
const G_ALIASES = new Set(["ɡ", "g"]);

export function normalizeTargetPhoneme(target) {
  const raw = String(target || "").trim();
  const m = raw.match(/\/(.+?)\//);
  return (m ? m[1] : raw.replace(/\//g, "")).trim();
}

export function normalizeIpaBody(ipa) {
  return String(ipa || "")
    .replace(/^\/+|\/+$/g, "")
    .replace(/[ˈˌ.]/g, "")
    .trim();
}

export function tokenizeIpa(ipa) {
  let rest = normalizeIpaBody(ipa);
  const tokens = [];
  const sorted = [...MULTI_PHONEMES].sort((a, b) => b.length - a.length);

  while (rest.length > 0) {
    let matched = false;
    for (const piece of sorted) {
      if (rest.startsWith(piece)) {
        tokens.push(piece);
        rest = rest.slice(piece.length);
        matched = true;
        break;
      }
    }
    if (!matched) {
      tokens.push(rest[0]);
      rest = rest.slice(1);
    }
  }
  return tokens;
}

function aliasesForTarget(targetPhoneme) {
  const core = normalizeTargetPhoneme(targetPhoneme);
  if (core === "k") return K_ALIASES;
  if (core === "ɡ" || core === "g") return G_ALIASES;
  return new Set([core]);
}

/** Kiểm tra IPA có chứa target_phoneme (không dựa chữ cái orthography). */
export function ipaContainsTargetPhoneme(ipa, targetPhoneme) {
  const target = normalizeTargetPhoneme(targetPhoneme);
  if (!target || !ipa) return false;

  const aliases = aliasesForTarget(target);
  const tokens = tokenizeIpa(ipa);

  if (target === "k") {
    return tokens.some((t) => K_ALIASES.has(t));
  }
  if (target === "ɡ" || target === "g") {
    return tokens.some((t) => G_ALIASES.has(t));
  }

  return tokens.some((t) => aliases.has(t));
}

/**
 * @param {import("@/lib/ipa-practice-lessons").IpaPracticeLesson[]} [lessons]
 */
export function validatePronunciationLessons(lessons) {
  const errors = [];

  for (const lesson of lessons || []) {
    const lessonTarget = lesson.targetPhoneme || null;

    for (const word of lesson.words || []) {
      const expected = word.targetPhoneme || lessonTarget;
      if (!expected) continue;

      if (!ipaContainsTargetPhoneme(word.ipa, expected)) {
        errors.push({
          lessonId: lesson.id,
          lessonTitle: lesson.title,
          word: word.word,
          ipa: word.ipa,
          expected,
        });
      }

      if (lessonTarget && word.targetPhoneme && word.targetPhoneme !== lessonTarget) {
        const lessonCore = normalizeTargetPhoneme(lessonTarget);
        const wordCore = normalizeTargetPhoneme(word.targetPhoneme);
        if (lessonCore !== wordCore && !lesson.title.includes("/-/")) {
          errors.push({
            lessonId: lesson.id,
            lessonTitle: lesson.title,
            word: word.word,
            ipa: word.ipa,
            expected: lessonTarget,
            reason: "word_target_mismatch_lesson",
          });
        }
      }
    }
  }

  if (errors.length && typeof console !== "undefined") {
    console.warn(
      `[validatePronunciationLessons] ${errors.length} từ không khớp target_phoneme:`,
      errors
    );
  }

  return errors;
}

export function filterWordsByTargetPhoneme(words, lessonTarget) {
  return (words || []).filter((w) => {
    const expected = w.targetPhoneme || lessonTarget;
    if (!expected) return true;
    return ipaContainsTargetPhoneme(w.ipa, expected);
  });
}
