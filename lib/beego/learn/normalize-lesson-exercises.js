/** Backward-compatible exercise type normalization (Phase 2 → Phase 3). */

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

  const ttsText =
    exercise.extensions?.gradingTarget ||
    exercise.extensions?.ttsText ||
    exercise.ttsText ||
    (rawType.startsWith("listening")
      ? ""
      : exercise.speakTarget || exercise.storyText || "");

  return {
    ...exercise,
    type,
    required: exercise.required !== false,
    extensions: {
      ...(exercise.extensions || {}),
      ttsText: ttsText || exercise.extensions?.ttsText || "",
      gradingTarget:
        exercise.extensions?.gradingTarget ||
        (rawType.startsWith("listening") ? ttsText : exercise.extensions?.gradingTarget),
    },
  };
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
