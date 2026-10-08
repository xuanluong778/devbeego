/** Lesson mix stage labels (Phase 6). */

export const MIX_STAGES = [
  "warmup",
  "learn",
  "practice",
  "skill_activity",
  "recovery",
  "challenge",
];

const SKILL_TYPES = new Set([
  "listening_choice",
  "listening_fill",
  "listening_dictation",
  "speaking",
  "pronunciation",
]);

const PRACTICE_TYPES = new Set([
  "word_order",
  "fill_blank",
  "translate_word_bank",
  "sentence_complete",
  "matching_pairs",
  "translation",
  "context_cloze",
  "dialogue_response",
]);

/**
 * @param {object} exercise
 * @param {string} lessonType
 */
export function inferExerciseDifficulty(exercise, lessonType) {
  const t = String(exercise?.type || "");
  if (exercise?.required === true && (t === "speaking" || t === "word_order")) return "hard";
  if (SKILL_TYPES.has(t)) return "medium";
  if (PRACTICE_TYPES.has(t)) return "medium";
  if (t === "vocabulary_choice") return "easy";
  return "medium";
}

/**
 * Default stage bucket before adaptive ordering.
 * @param {object} exercise
 * @param {string} lessonType
 * @param {number} indexInLesson
 */
export function defaultStageForExercise(exercise, lessonType, indexInLesson) {
  const t = String(exercise?.type || "");
  const lt = String(lessonType || "");

  if (indexInLesson === 0 && (t === "multiple_choice" || t === "vocabulary_choice")) {
    return "warmup";
  }
  if (t === "vocabulary_choice" || (lt === "grammar" && t === "multiple_choice" && indexInLesson <= 1)) {
    return "learn";
  }
  if (SKILL_TYPES.has(t)) {
    return "skill_activity";
  }
  if (PRACTICE_TYPES.has(t) || t === "multiple_choice") {
    return "practice";
  }
  if (t === "story_comprehension") {
    return lt === "story" ? "skill_activity" : "practice";
  }
  return "practice";
}

export const STAGE_ORDER = {
  warmup: 10,
  learn: 20,
  practice: 30,
  skill_activity: 40,
  recovery: 45,
  challenge: 50,
};
