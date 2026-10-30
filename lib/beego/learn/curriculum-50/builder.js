/**
 * Map curriculum-50 lesson parts (+ gate exam) onto LessonPlayer exercise shapes.
 * Preserves source prompts, options, IPA, answers; does not invent filler content.
 */
import { ensureMatchPairIds } from "@/lib/beego/learn/match-pairs";
import {
  CURRICULUM_50_NODE_REWARDS,
  CURRICULUM_50_QUESTIONS_PER_LESSON,
  CURRICULUM_50_REVISION,
  curriculum50ExamId,
  nodeTypeForCurriculumRole,
} from "./constants.js";
import { getCurriculum50LessonRaw } from "./loader.js";
import { buildLessonPassage } from "@/lib/beego/learn/passage-read";
import { reviewSentenceFor } from "@/lib/beego/learn/speech-coach";

function tidy(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/** Focus vocab from matching_pairs (role=focus) or from prompt “từ/cụm: a, b, c”. */
function extractFocusWords(partOrItem, fallbackPairsPart = null) {
  const fromPairs = (part) =>
    (Array.isArray(part?.pairs) ? part.pairs : [])
      .filter((pair) => String(pair?.role || "").toLowerCase() === "focus")
      .map((pair) => tidy(pair.en || pair.text || ""))
      .filter(Boolean);

  let words = fromPairs(partOrItem);
  if (!words.length && fallbackPairsPart) words = fromPairs(fallbackPairsPart);

  if (!words.length) {
    const prompt = tidy(
      partOrItem?.prompt || partOrItem?.instruction || (typeof partOrItem === "string" ? partOrItem : "")
    );
    const match = prompt.match(/từ\/cụm:\s*([^.]+)/i) || prompt.match(/từ khóa:\s*([^.]+)/i);
    if (match?.[1]) {
      words = match[1]
        .split(/[,;，、]/)
        .map((w) => tidy(w).replace(/^["“]|["”]$/g, ""))
        .filter(Boolean);
    }
  }
  // Dedupe case-insensitive, keep first casing
  const seen = new Set();
  return words.filter((w) => {
    const key = w.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function rewardForNodeIndex(nodeIndex) {
  return (
    CURRICULUM_50_NODE_REWARDS.find((item) => item.nodeIndex === nodeIndex) ||
    CURRICULUM_50_NODE_REWARDS[0]
  );
}

function stampRevision(question) {
  const extensions = { ...(question.extensions || {}), contentRevision: CURRICULUM_50_REVISION };
  return { ...question, extensions, contentRevision: CURRICULUM_50_REVISION };
}

function choiceOptions(options) {
  if (!Array.isArray(options)) return [];
  return options.map((opt, index) => {
    if (opt && typeof opt === "object") {
      return {
        id: String(opt.id || String.fromCharCode(65 + index)),
        text: tidy(opt.text ?? opt.label ?? opt.value ?? ""),
      };
    }
    return { id: String.fromCharCode(65 + index), text: tidy(opt) };
  });
}

/** Audio match: 5 pairs when bank allows (focus first, then support/other). */
const MATCH_PAIRS_TARGET = 5;

function buildMatchingPairs(part, { focusOnly = true, maxPairs = MATCH_PAIRS_TARGET } = {}) {
  const rawPairs = Array.isArray(part.pairs) ? part.pairs : [];
  const focus = rawPairs.filter((pair) => String(pair?.role || "").toLowerCase() === "focus");
  const other = rawPairs.filter((pair) => String(pair?.role || "").toLowerCase() !== "focus");
  let source;
  if (focusOnly) {
    source = [...focus];
    for (const pair of other) {
      if (source.length >= maxPairs) break;
      source.push(pair);
    }
    if (source.length < 2) source = rawPairs.slice(0, maxPairs);
  } else {
    source = rawPairs.slice(0, maxPairs);
  }
  source = source.slice(0, Math.max(2, maxPairs));
  const pairs = ensureMatchPairIds(
    source.map((pair) => ({
      pairId: pair.id,
      en: pair.en,
      vi: pair.vi,
      role: pair.role,
    }))
  );
  return stampRevision({
    id: part.id,
    type: "matching_pairs",
    skillLabel: "Nghe và ghép nghĩa",
    prompt: "Nhấn vào các cặp tương ứng",
    pairs,
    explanation: "Nghe tiếng Anh bên trái, chọn nghĩa tiếng Việt đúng bên phải.",
    required: true,
    sourcePart: part.id,
    extensions: {
      contentRevision: CURRICULUM_50_REVISION,
      audioMatch: true,
      rightShowsVi: true,
    },
  });
}

/**
 * Chào lần đầu only: short greeting lines before the long introduction.
 * Other lessons keep selectTwelveQuestions.
 */
function firstGreetingQuestions(parts, ipaByText, meta) {
  const byOrder = new Map();
  for (const part of parts || []) byOrder.set(Number(part.order) || 0, part);
  const take = (order) => byOrder.get(order);
  const out = [];
  const p1 = take(1);
  if (p1) out.push(buildMatchingPairs(p1, { focusOnly: true }));

  const p2 = take(2);
  const enItem = (p2?.items || [])[0];
  if (enItem) out.push(buildMultipleChoiceItem(enItem, p2, "Anh → Việt"));
  const p3 = take(3);
  const viItem = (p3?.items || [])[0];
  if (viItem) out.push(buildMultipleChoiceItem(viItem, p3, "Việt → Anh"));

  const p4 = take(4) || { id: "g01l01-part04" };
  const resolveIpa = (item) => {
    const own = tidy(item?.ipa || "");
    if (own) return own;
    const key = tidy(item?.referenceText || item?.text || "").toLowerCase();
    return key ? ipaByText.get(key) || "" : "";
  };
  const shorts = [
    {
      id: "g01l01-say-hello",
      prompt: "Đọc cụm ngắn: chào và nói tên.",
      text: "Hello. I'm Linh.",
      vi: "Xin chào. Mình là Linh.",
      focus: ["hello"],
    },
    {
      id: "g01l01-ask-name",
      prompt: "Đọc câu hỏi ngắn.",
      text: "What's your name?",
      vi: "Bạn tên là gì?",
      focus: ["name"],
    },
    {
      id: "g01l01-nice-meet",
      prompt: "Đọc cụm ngắn: vui được gặp.",
      text: "Nice to meet you.",
      vi: "Rất vui được gặp bạn.",
      focus: ["nice", "meet"],
    },
  ];
  for (const row of shorts) {
    out.push(
      buildSpeakItem(
        {
          id: row.id,
          prompt: row.prompt,
          referenceText: row.text,
          text: row.text,
          translation: row.vi,
          hiddenTextUntilHint: false,
        },
        p4,
        { gradingMode: "word_match", required: true, focusWords: row.focus }
      )
    );
  }

  const long =
    (p4.items || []).find((item) => tidy(item.referenceText || item.text || "").split(/\s+/).length >= 4) ||
    (p4.items || [])[0];
  if (long) {
    out.push(
      buildSpeakItem(long, p4, {
        gradingMode: "word_match",
        required: true,
        ipaFallback: resolveIpa(long),
        focusWords: ["hello", "introduce", "classmate"],
        practiceChunks: ["Hello.", "introduce myself", "new classmate"],
        reviewVariants: [
          {
            id: "g01l01-intro-review",
            text: "Hello. Let me introduce myself to a classmate.",
            prompt: "Ôn bằng câu mới. Vẫn dùng hello, introduce và classmate.",
          },
        ],
      })
    );
  }

  const p8 = take(8);
  const orderItem = (p8?.items || [])[0];
  if (orderItem) out.push(buildWordOrderItem(orderItem, p8));

  out.push(
    stampRevision({
      id: "g01l01-write-hello",
      type: "translation",
      skillLabel: "Tự viết lời chào",
      prompt: "Viết 1 hoặc 2 câu tiếng Anh để chào và giới thiệu mình với bạn mới.",
      required: true,
      sourcePart: p4.id,
      extensions: {
        contentRevision: CURRICULUM_50_REVISION,
        inputMode: "text",
        translationDirection: "vi-to-en",
        productionKind: "greeting",
        offerAiDialogue: true,
        sourceText: "Chào bạn mới và nói bạn là ai. Có thể dùng Hello, I'm… hoặc Let me introduce myself.",
        context: "Nhiều cách nói đều đúng. Không cần chép một câu mẫu.",
      },
    })
  );

  const p7 = take(7);
  const listenItem = (p7?.items || [])[0];
  if (listenItem && p7) {
    const built = buildListeningChoiceItem(listenItem, p7, p7.audioScript || p7.transcript || "");
    built.prompt = "Nghe tình huống. Ý nào đúng?";
    out.push(built);
  }

  const passage = buildLessonPassage(parts, meta);
  if (passage.referenceText && passage.sentences.every((row) => row.ipa && !(row.missingIpa || []).length)) {
    const lessonKey = tidy(meta.lessonId || "g01l01");
    out.push(
      stampRevision({
        id: `${lessonKey}-passage`,
        type: "passage_read",
        skillLabel: "Đọc đoạn văn – Chấm phát âm",
        prompt: "Nghe mẫu Anh–Mỹ, rồi đọc cả đoạn. Bấm Dừng khi đọc xong.",
        required: true,
        sourcePart: p4.id,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          passageSentences: passage.sentences.map(({ text, vi, ipa, tokens }) => ({ text, vi, ipa, tokens })),
          referenceText: passage.referenceText,
          focusWords: passage.focusWords,
          ipaAccent: passage.ipaAccent,
          ipaSource: passage.ipaSource,
          pronunciationSource: "azure",
          passPronunciation: 60,
        },
      })
    );
  }

  out.push(
    stampRevision({
      id: "g01l01-passage-check",
      type: "multiple_choice",
      skillLabel: "Hiểu đoạn đọc",
      prompt: "Trong đoạn vừa đọc, Linh làm gì ở lớp mới?",
      options: [
        { id: "A", text: "Linh chào và tự giới thiệu với bạn cùng lớp." },
        { id: "B", text: "Linh hỏi đường đến thư viện." },
        { id: "C", text: "Linh chỉ nói tên giáo viên." },
        { id: "D", text: "Linh rời lớp ngay khi vào cửa." },
      ],
      correctAnswer: "A",
      explanation: "Đoạn kể Linh đứng ở cửa lớp, chào, giới thiệu mình, rồi được mời ngồi.",
      required: true,
      sourcePart: "g01l01-passage",
    })
  );

  return out.slice(0, CURRICULUM_50_QUESTIONS_PER_LESSON);
}

function focusPhrasesForLesson(parts, meta) {
  const fromMeta = (Array.isArray(meta.focusWords) ? meta.focusWords : []).map(tidy).filter(Boolean);
  const part1 = (parts || []).find((part) => Number(part.order) === 1);
  const phrases = fromMeta.length ? fromMeta : extractFocusWords(part1);
  const seen = new Set();
  const out = [];
  for (const phrase of phrases) {
    const key = phrase.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(phrase);
    if (out.length >= 3) break;
  }
  return out;
}

function meaningForPhrase(parts, phrase) {
  const part = (parts || []).find((item) => Number(item.order) === 1);
  const found = (part?.pairs || []).find((pair) => tidy(pair.en).toLowerCase() === tidy(phrase).toLowerCase());
  return tidy(found?.vi || "");
}

function normalizedLoose(value) {
  return tidy(value)
    .toLowerCase()
    .replace(/[^a-z0-9' ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Same lesson shape as Chào lần đầu, using this lesson's own phrases and sentence.
 * Prep (match, meaning, word order) stays. Short phrases come before the long line.
 */
function coachedLessonQuestions(parts, ipaByText, meta = {}) {
  const byOrder = new Map();
  for (const part of parts || []) byOrder.set(Number(part.order) || 0, part);
  const take = (order) => byOrder.get(order);
  const lessonId = tidy(meta.lessonId || take(4)?.id || take(1)?.id || "lesson").replace(/-part\d+.*$/i, "");
  const phrases = focusPhrasesForLesson(parts, meta);
  const out = [];

  const p1 = take(1);
  if (p1) out.push(buildMatchingPairs(p1, { focusOnly: true }));

  const p2 = take(2);
  const enItem = (p2?.items || [])[0];
  if (enItem) out.push(buildMultipleChoiceItem(enItem, p2, "Anh → Việt"));
  const p3 = take(3);
  const viItem = (p3?.items || [])[0];
  if (viItem) out.push(buildMultipleChoiceItem(viItem, p3, "Việt → Anh"));

  const p4 = take(4) || { id: `${lessonId}-part04`, title: "Luyện nói" };
  const resolveIpa = (item) => {
    const own = tidy(item?.ipa || "");
    if (own) return own;
    const key = tidy(item?.referenceText || item?.text || item?.audioScript || "").toLowerCase();
    return key ? ipaByText.get(key) || "" : "";
  };
  for (const [index, phrase] of phrases.entries()) {
    out.push(
      buildSpeakItem(
        {
          id: `${lessonId}-chunk-${String(index + 1).padStart(2, "0")}`,
          prompt: `Đọc cụm ngắn: ${phrase}.`,
          referenceText: phrase,
          text: phrase,
          translation: meaningForPhrase(parts, phrase),
          hiddenTextUntilHint: false,
        },
        p4,
        { gradingMode: "word_match", required: true, focusWords: [phrase] }
      )
    );
  }

  const long =
    (p4.items || []).find((item) => tidy(item.referenceText || item.text || "").split(/\s+/).length >= 4) ||
    (p4.items || [])[0];
  const longText = tidy(long?.referenceText || long?.text || "");
  if (long && longText) {
    const reviewText = phrases.length ? reviewSentenceFor(longText, phrases) : "";
    out.push(
      buildSpeakItem(long, p4, {
        gradingMode: "word_match",
        required: true,
        ipaFallback: resolveIpa(long),
        focusWords: phrases,
        focusPairsPart: p1,
        practiceChunks: phrases,
        reviewVariants: reviewText
          ? [
              {
                id: `${lessonId}-review-line`,
                text: reviewText,
                prompt: `Ôn bằng câu mới. Vẫn dùng ${phrases.join(", ")}.`,
              },
            ]
          : [],
      })
    );
  }

  const p8 = take(8);
  const orderItem = (p8?.items || [])[0];
  if (orderItem) out.push(buildWordOrderItem(orderItem, p8));

  if (phrases.length) {
    out.push(
      stampRevision({
        id: `${lessonId}-write-focus`,
        type: "translation",
        skillLabel: "Tự viết câu",
        prompt: `Viết 1 hoặc 2 câu tiếng Anh. Dùng đủ: ${phrases.join(", ")}. Có thể đổi một chi tiết so với câu mẫu.`,
        required: true,
        sourcePart: p4.id,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          inputMode: "text",
          translationDirection: "vi-to-en",
          productionKind: "focus_phrases",
          focusWords: phrases,
          offerAiDialogue: true,
          sourceText: `Dùng ${phrases.join(", ")} trong câu của bạn.`,
          context: "Nhiều cách nói đều đúng nếu có đủ từ trọng tâm.",
        },
      })
    );
  }

  const p7 = take(7);
  const listenItem = (p7?.items || [])[0];
  if (listenItem && p7) {
    const built = buildListeningChoiceItem(listenItem, p7, p7.audioScript || p7.transcript || "");
    const needle = normalizedLoose(longText);
    const visible = normalizedLoose(
      `${built.prompt} ${(built.options || []).map((opt) => opt.text).join(" ")}`
    );
    if (needle.split(" ").length >= 4 && visible.includes(needle)) {
      built.prompt = "Nghe tình huống. Ý nào đúng?";
    }
    out.push(built);
  }

  const passage = buildLessonPassage(parts, meta);
  const passageReady =
    passage.referenceText && passage.sentences.every((row) => row.ipa && !(row.missingIpa || []).length);
  if (passageReady) {
    out.push(
      stampRevision({
        id: `${lessonId}-passage`,
        type: "passage_read",
        skillLabel: "Đọc đoạn văn – Chấm phát âm",
        prompt: "Nghe mẫu Anh–Mỹ, rồi đọc cả đoạn. Bấm Dừng khi đọc xong.",
        required: true,
        sourcePart: p4.id || lessonId,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          passageSentences: passage.sentences.map(({ text, vi, ipa, tokens }) => ({ text, vi, ipa, tokens })),
          referenceText: passage.referenceText,
          focusWords: passage.focusWords,
          ipaAccent: passage.ipaAccent,
          ipaSource: passage.ipaSource,
          pronunciationSource: "azure",
          passPronunciation: 60,
        },
      })
    );
  }

  if (passageReady && listenItem) {
    const options = choiceOptions(listenItem.options);
    const correct = String(listenItem.correctOptionId || "");
    if (options.length >= 2 && options.some((opt) => opt.id === correct)) {
      out.push(
        stampRevision({
          id: `${lessonId}-passage-check`,
          type: "multiple_choice",
          skillLabel: "Hiểu đoạn đọc",
          prompt: "Trong đoạn vừa đọc, ý nào đúng?",
          options,
          correctAnswer: correct,
          explanation: listenItem.explanation || "Chọn ý đúng với câu trọng tâm của đoạn.",
          required: true,
          sourcePart: `${lessonId}-passage`,
        })
      );
    }
  }

  if (out.length > CURRICULUM_50_QUESTIONS_PER_LESSON) {
    const tail = [];
    while (out.length && (out[out.length - 1].type === "multiple_choice" || out[out.length - 1].type === "passage_read") && tail.length < 2) {
      const last = out[out.length - 1];
      if (last.id === `${lessonId}-passage` || last.id === `${lessonId}-passage-check`) tail.unshift(out.pop());
      else break;
    }
    out.length = Math.max(0, CURRICULUM_50_QUESTIONS_PER_LESSON - tail.length);
    out.push(...tail);
  }
  return out;
}

/**
 * Pick exactly 12 activities. Chào lần đầu keeps its hand-built lines.
 * Every other lesson uses the same coaching shape with its own phrases.
 */
function selectTwelveQuestions(parts, ipaByText, meta = {}) {
  if (tidy(meta.lessonId) === "g01l01") {
    return firstGreetingQuestions(parts, ipaByText, meta);
  }
  return coachedLessonQuestions(parts, ipaByText, meta);
}

function buildMultipleChoiceItem(item, part, skillLabel) {
  const options = choiceOptions(item.options);
  return stampRevision({
    id: item.id,
    type: "multiple_choice",
    skillLabel: skillLabel || part.title || "Trắc nghiệm",
    prompt: item.prompt,
    options,
    correctAnswer: String(item.correctOptionId || ""),
    explanation: item.explanation || "",
    required: true,
    sourcePart: part.id,
  });
}

function buildFillBlankItem(item, part) {
  // Curriculum fill_blank ships as MCQ with options — reuse multiple_choice UI + grading.
  return stampRevision({
    ...buildMultipleChoiceItem(item, part, "Điền từ"),
    type: "multiple_choice",
    skillLabel: "Điền từ còn thiếu",
  });
}

function buildListeningChoiceItem(item, part, audioScript) {
  const options = choiceOptions(item.options);
  const audio = tidy(
    item.audioScript || item.listenText || audioScript || part.audioScript || part.transcript || ""
  );
  return stampRevision({
    id: item.id,
    type: "listening_choice",
    skillLabel: part.title || "Nghe hiểu",
    prompt: item.prompt,
    options,
    correctAnswer: String(item.correctOptionId || ""),
    explanation: item.explanation || "",
    listenText: audio,
    ttsText: audio,
    meaningVi: tidy(item.translation || item.meaningVi || part.transcriptVi || ""),
    required: true,
    sourcePart: part.id,
    extensions: {
      contentRevision: CURRICULUM_50_REVISION,
      listeningMode: "comprehension",
      hideTextInitially: true,
      ttsText: audio,
      gradingTarget: audio,
      transcript: audio,
      transcriptVi: tidy(item.translation || part.transcriptVi || ""),
    },
  });
}

function buildWordOrderItem(item, part) {
  const tokens = Array.isArray(item.correctTokens)
    ? item.correctTokens.map((t) => String(t))
    : [];
  const accepted = [];
  if (tokens.length) accepted.push(tokens);
  for (const text of item.acceptedText || []) {
    const words = tidy(text).split(" ").filter(Boolean);
    if (words.length) accepted.push(words);
  }
  return stampRevision({
    id: item.id,
    type: "word_order",
    skillLabel: part.title || "Sắp xếp từ",
    prompt: item.prompt,
    correctAnswer: tokens,
    acceptedAnswers: accepted,
    wordBank: Array.isArray(item.wordBank) ? item.wordBank.map(String) : tokens,
    explanation: item.explanation || "",
    required: true,
    sourcePart: part.id,
    extensions: {
      contentRevision: CURRICULUM_50_REVISION,
      modelSentence: tidy((item.acceptedText && item.acceptedText[0]) || tokens.join(" ")),
      ignoreCasePunctuation: true,
    },
  });
}

function buildDialogueItem(item, part) {
  const options = choiceOptions(item.options);
  return stampRevision({
    id: item.id,
    type: "dialogue_response",
    skillLabel: part.title || "Hội thoại",
    prompt: item.prompt,
    options,
    correctAnswer: String(item.correctOptionId || ""),
    explanation: item.explanation || "",
    required: true,
    sourcePart: part.id,
  });
}

function buildSpeakItem(
  item,
  part,
  { gradingMode, required = true, ipaFallback = "", focusWords = [], focusPairsPart = null, practiceChunks = [], reviewVariants = [] } = {}
) {
  const target =
    tidy(item.referenceText || item.text || item.audioScript || item.sampleAnswer || "") ||
    tidy(item.prompt);
  const mode = gradingMode || item.gradingMode || "word_match";
  const isRubric = mode === "communicative_rubric";
  const ipa = tidy(item.ipa || ipaFallback || "");
  const focus =
    (Array.isArray(focusWords) && focusWords.length
      ? focusWords.map(tidy).filter(Boolean)
      : null) || extractFocusWords(item, focusPairsPart || part);
  const sampleRaw = tidy(item.sampleAnswer || "");
  // Client-safe hint (sampleAnswer itself is stripped by sanitize as answer-key).
  const speakingHint = isRubric
    ? sampleRaw.replace(/^Câu khởi đầu để phát triển tiếp:\s*/i, "").trim() || sampleRaw
    : "";
  // Listen/read-aloud: hide text+IPA until learner taps Hiện (curriculum default).
  const hiddenTextUntilHint = isRubric
    ? false
    : item.hiddenTextUntilHint !== false;
  return stampRevision({
    id: item.id,
    type: "speaking",
    skillLabel: part.title || "Luyện nói",
    prompt: item.prompt || part.instruction || "Đọc / nói theo mẫu.",
    speakTarget: isRubric ? "" : target,
    meaningVi: tidy(item.translation || ""),
    ipa,
    hiddenTextUntilHint,
    explanation: item.explanation || "",
    required: isRubric ? false : required,
    minScore: isRubric ? 70 : 65,
    sourcePart: part.id,
    extensions: {
      contentRevision: CURRICULUM_50_REVISION,
      speakTarget: isRubric ? "" : target,
      gradingMode: mode,
      canDoCriteria: item.canDoCriteria || [],
      sampleAnswer: sampleRaw,
      speakingHint,
      focusWords: focus,
      practiceChunks: practiceChunks.map(tidy).filter(Boolean),
      reviewVariants: (reviewVariants || [])
        .map((variant) => ({
          id: tidy(variant?.id),
          text: tidy(variant?.text),
          prompt: tidy(variant?.prompt),
        }))
        .filter((variant) => variant.id && variant.text),
      sampleIsNotExactAnswer: isRubric || Boolean(item.sampleIsNotExactAnswer),
      wordMatchOnly: mode === "word_match_reference_only",
      // Word-match is recognition only — never claim phonetic quality.
      notPronunciationAssessment: mode === "word_match" || mode === "word_match_reference_only" || isRubric,
      pendingTeacherReview: isRubric,
      hiddenTextUntilHint,
      ipa,
      translation: tidy(item.translation || ""),
      minScore: isRubric ? 70 : 65,
    },
  });
}

function questionsFromPart(part, ipaByText = new Map()) {
  const type = String(part?.type || "");
  const resolveIpa = (item) => {
    const own = tidy(item?.ipa || "");
    if (own) return own;
    const key = tidy(item?.referenceText || item?.text || item?.audioScript || "").toLowerCase();
    return key ? ipaByText.get(key) || "" : "";
  };

  if (type === "matching_pairs") return [buildMatchingPairs(part)];

  if (type === "multiple_choice") {
    return (part.items || []).map((item) => buildMultipleChoiceItem(item, part));
  }
  if (type === "fill_blank") {
    return (part.items || []).map((item) => buildFillBlankItem(item, part));
  }
  if (type === "dialogue_response") {
    return (part.items || []).map((item) => buildDialogueItem(item, part));
  }
  if (type === "word_order") {
    return (part.items || []).map((item) => buildWordOrderItem(item, part));
  }
  if (type === "listening_comprehension") {
    const script = part.audioScript || part.transcript || "";
    return (part.items || []).map((item) => buildListeningChoiceItem(item, part, script));
  }
  if (type === "read_aloud" || type === "listen_repeat") {
    return (part.items || []).map((item) =>
      buildSpeakItem(item, part, {
        gradingMode: "word_match",
        required: true,
        ipaFallback: resolveIpa(item),
      })
    );
  }
  if (type === "listen_read_score") {
    return (part.items || []).map((item) =>
      buildSpeakItem(item, part, {
        gradingMode: "word_match_reference_only",
        required: true,
        ipaFallback: resolveIpa(item),
      })
    );
  }
  if (type === "personal_response") {
    return (part.items || []).map((item) =>
      buildSpeakItem(item, part, { gradingMode: "communicative_rubric", required: false })
    );
  }
  return [];
}

function buildExamQuestions(raw) {
  const exam = raw.exam || {};
  const questions = [];
  for (const [index, item] of (exam.questions || []).entries()) {
    const options = choiceOptions(item.options);
    const answerIndex = Number(item.answer);
    const correct =
      Number.isFinite(answerIndex) && options[answerIndex]
        ? options[answerIndex].id
        : "";
    const section = String(item.section || "").toUpperCase();
    const isListen = section === "L";
    const audio = isListen
      ? tidy((exam.listening || [])[Number(item.track) || 0] || exam.listening?.[0] || "")
      : "";
    questions.push(
      stampRevision({
        id: `${curriculum50ExamId(raw.gateNumber)}-q${String(index + 1).padStart(2, "0")}`,
        type: isListen ? "listening_choice" : "multiple_choice",
        skillLabel: isListen ? "Thi nghe" : "Thi đọc",
        prompt: item.prompt,
        options,
        correctAnswer: correct,
        explanation: item.explanation || "",
        listenText: audio,
        ttsText: audio,
        required: true,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          examSection: section || (isListen ? "L" : "R"),
          hideTextInitially: isListen,
          listeningMode: isListen ? "comprehension" : undefined,
          ttsText: audio,
          gradingTarget: audio,
          transcript: audio,
        },
      })
    );
  }

  if (exam.speaking) {
    questions.push(
      stampRevision({
        id: `${curriculum50ExamId(raw.gateNumber)}-speaking`,
        type: "speaking",
        skillLabel: "Thi nói (chờ giáo viên)",
        prompt: String(exam.speaking),
        speakTarget: "",
        required: false,
        minScore: 101,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          gradingMode: "communicative_rubric",
          pendingTeacherReview: true,
          notPronunciationAssessment: true,
          speakSeconds: exam.speakSeconds || 45,
          canDoCriteria: [
            "Nội dung phù hợp chủ đề cửa",
            "Dùng từ/cụm trọng tâm của ít nhất ba bài",
            "Có chi tiết riêng và trả lời được câu hỏi tiếp",
          ],
        },
      })
    );
  }

  if (exam.writing) {
    questions.push(
      stampRevision({
        id: `${curriculum50ExamId(raw.gateNumber)}-writing`,
        type: "speaking",
        skillLabel: "Thi viết (chờ giáo viên)",
        prompt: String(exam.writing),
        speakTarget: "",
        required: false,
        minScore: 101,
        extensions: {
          contentRevision: CURRICULUM_50_REVISION,
          gradingMode: "communicative_rubric",
          pendingTeacherReview: true,
          inputHint: "writing",
          minWords: exam.minWords || 25,
          maxWords: exam.maxWords || 80,
          canDoCriteria: [
            "Nối được ít nhất ba chủ đề bài trong cửa",
            "Dùng đủ cụm trọng tâm theo yêu cầu",
            "Có chi tiết mới và lý do phù hợp",
          ],
        },
      })
    );
  }

  return questions;
}

/**
 * @param {string} lessonId
 * @returns {object|null}
 */
export function buildCurriculum50Lesson(lessonId) {
  const raw = getCurriculum50LessonRaw(lessonId);
  if (!raw) return null;

  if (raw.kind === "exam") {
    const reward = rewardForNodeIndex(17);
    const questions = buildExamQuestions(raw);
    return {
      lessonId: tidy(lessonId),
      title: `Thi vượt cửa: ${raw.gateTitle}`,
      objective: `Phiếu luyện tập cửa «${raw.gateTitle}». Nghe/đọc chấm tự động; nói/viết chờ giáo viên theo rubric.`,
      type: "test",
      level: raw.level,
      estimatedMinutes: reward.duration,
      xpReward: reward.xpReward,
      honeyReward: reward.honeyReward,
      lives: 3,
      gateNumber: raw.gateNumber,
      partNumber: raw.gateNumber,
      topicTitle: raw.gateTitle,
      curriculumSchema: raw.schema,
      contentRevision: CURRICULUM_50_REVISION,
      contentSource: "curriculum-50",
      completionRules: {
        minScorePercent: 70,
        minQuestionsAnswered: Math.max(1, questions.filter((q) => q.required).length),
        allowCompleteOnFinish: true,
        requireTeacherForSpeakingWriting: true,
      },
      questions,
    };
  }

  const lesson = raw.lesson;
  const lessonNumber = Number(String(lesson.lessonId).slice(-2)) || 1;
  const reward = rewardForNodeIndex(lessonNumber);
  /** Map EN text → IPA from model sentences + any part that already ships IPA. */
  const ipaByText = new Map();
  for (const model of lesson.modelSentences || []) {
    const key = tidy(model?.en || "").toLowerCase();
    const ipa = tidy(model?.ipa || "");
    if (key && ipa) ipaByText.set(key, ipa);
  }
  for (const part of lesson.parts || []) {
    for (const item of part.items || []) {
      const key = tidy(item?.referenceText || item?.text || item?.audioScript || "").toLowerCase();
      const ipa = tidy(item?.ipa || "");
      if (key && ipa && !ipaByText.has(key)) ipaByText.set(key, ipa);
    }
  }
  const model = Array.isArray(lesson.modelSentences) ? lesson.modelSentences[0] : null;
  const focusVocabulary = Array.isArray(lesson.focusVocabulary)
    ? lesson.focusVocabulary.filter((item) => item && (item.en || item.vi))
    : [];
  const questions = selectTwelveQuestions(lesson.parts || [], ipaByText, {
    lessonId: lesson.lessonId,
    lessonTitle: lesson.title,
    goal: lesson.goal,
    gateNumber: raw.gateNumber,
    gateTitle: raw.gateTitle,
    level: raw.level,
    lessonNumber,
    model: model ? { en: model.en, vi: model.vi } : null,
    focusWords: focusVocabulary.map((item) => item.en).filter(Boolean),
  });

  return {
    lessonId: lesson.lessonId,
    title: lesson.title,
    objective: lesson.goal || `Luyện 12 câu với từ trọng tâm giáo trình: ${raw.gateTitle}.`,
    type: nodeTypeForCurriculumRole(lesson.role),
    role: lesson.role || "learn",
    level: raw.level,
    estimatedMinutes: Math.min(reward.duration, 15),
    xpReward: reward.xpReward,
    honeyReward: reward.honeyReward,
    lives: 3,
    gateNumber: raw.gateNumber,
    partNumber: raw.gateNumber,
    topicTitle: raw.gateTitle,
    modelSentence: model
      ? { en: model.en, vi: model.vi, ipa: model.ipa, ipaSource: model.ipaSource }
      : null,
    focusVocabulary,
    reviewVocabulary: [],
    curriculumSchema: raw.schema,
    contentRevision: CURRICULUM_50_REVISION,
    contentSource: "curriculum-50",
    completionRules: {
      minScorePercent: 0,
      minQuestionsAnswered: Math.max(1, questions.filter((q) => q.required !== false).length),
      allowCompleteOnFinish: true,
    },
    questions,
  };
}
