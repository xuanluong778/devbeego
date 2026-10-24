/** Backward-compatible exercise type normalization (Phase 2 → Phase 3). */

import { ensureMatchPairIds } from "@/lib/beego/learn/match-pairs";

const LEGACY_TYPE_MAP = {
  translate_word_bank: "word_order",
  sentence_complete: "fill_blank",
  vocab_list: "story_comprehension",
};

export const SUPPORTED_EXERCISE_TYPES = new Set([
  "multiple_choice",
  "vocabulary_choice",
  "word_order",
  "fill_blank",
  "listening_choice",
  "listening_fill",
  "listening_dictation",
  "speaking",
  "pronunciation",
  "story_comprehension",
  "matching_pairs",
  "translation",
  "context_cloze",
  "dialogue_response",
  "passage_read",
]);

/**
 * @param {object} exercise
 */
export function normalizeExercise(exercise) {
  if (!exercise || typeof exercise !== "object") {
    return {
      id: "unknown",
      type: "unknown",
      prompt: "Unsupported exercise.",
      required: true,
    };
  }

  const rawType = String(exercise.type || "multiple_choice");
  const type = LEGACY_TYPE_MAP[rawType] || rawType;

  const listeningAudio = String(
    exercise.extensions?.gradingTarget ||
      exercise.extensions?.ttsText ||
      exercise.ttsText ||
      exercise.listenText ||
      exercise.extensions?.transcript ||
      exercise.extensions?.audioScript ||
      exercise.audioScript ||
      ""
  ).trim();

  const ttsText =
    listeningAudio ||
    (rawType.startsWith("listening")
      ? ""
      : String(exercise.speakTarget || exercise.extensions?.speakTarget || exercise.storyText || "").trim());

  let prompt = String(exercise.prompt || "");
  // word_order: đừng lộ mẫu Anh kiểu «Dùng mẫu "Hello, I am + tên"» trong đề
  if (type === "word_order") {
    prompt = prompt
      .replace(/^Dùng mẫu\s*«[^»]+»\s*\.?\s*/i, "")
      .replace(/^Dùng mẫu\s*"[^"]+"\s*\.?\s*/i, "")
      .replace(/^Use the pattern\s*[«"][^»"]+[»"]\s*\.?\s*/i, "")
      .trim();
    if (!prompt && exercise.extensions?.meaning) {
      prompt = `Sắp xếp thành câu: «${exercise.extensions.meaning}»`;
    }
  }

  const next = {
    ...exercise,
    type,
    prompt,
    required: exercise.required !== false,
    ttsText: ttsText || exercise.ttsText || "",
    listenText: listeningAudio || exercise.listenText || "",
    extensions: {
      ...(exercise.extensions || {}),
      ttsText: ttsText || exercise.extensions?.ttsText || "",
      gradingTarget:
        exercise.extensions?.gradingTarget ||
        (rawType.startsWith("listening") || type.startsWith("listening")
          ? ttsText
          : exercise.extensions?.gradingTarget),
      transcript: exercise.extensions?.transcript || listeningAudio || "",
    },
  };

  if (type === "matching_pairs") {
    next.pairs = ensureMatchPairIds(exercise.pairs);
  }

  return next;
}

/**
 * @param {object} lesson
 */
export function normalizeLessonActivities(lesson) {
  if (!lesson) return lesson;
  const questions = (lesson.questions || []).map(normalizeExercise);
  return {
    ...lesson,
    questions,
    activityType: lesson.type || lesson.activityType || "lesson",
  };
}
