/** Learn-path skill buckets (extensible; not SRS vocabulary word_id). */

export const LEARN_SKILL_KEYS = [
  "vocabulary",
  "grammar",
  "sentence_patterns",
  "listening",
  "speaking",
  "comprehension",
];

const EXERCISE_SKILL = {
  vocabulary_choice: "vocabulary",
  multiple_choice: null,
  word_order: "sentence_patterns",
  fill_blank: null,
  listening_choice: "listening",
  listening_fill: "listening",
  listening_dictation: "listening",
  speaking: "speaking",
  pronunciation: "speaking",
  story_comprehension: "comprehension",
  matching_pairs: "vocabulary",
  translation: "sentence_patterns",
  context_cloze: "grammar",
  dialogue_response: "comprehension",
};

const LESSON_TYPE_SKILL = {
  vocabulary: "vocabulary",
  grammar: "grammar",
  sentence_patterns: "sentence_patterns",
  listening: "listening",
  speaking: "speaking",
  story: "comprehension",
  test: "vocabulary",
  review: "comprehension",
};

/**
 * @param {string} lessonType nodeType from lesson content
 * @param {string} exerciseType normalized exercise.type
 * @param {string} [skillLabel]
 */
export function resolveLearnSkillKey(lessonType, exerciseType, skillLabel = "") {
  const ex = String(exerciseType || "").trim();
  const mapped = EXERCISE_SKILL[ex];
  if (mapped) return mapped;

  const lt = String(lessonType || "").trim();
  const fromLesson = LESSON_TYPE_SKILL[lt];
  if (fromLesson) return fromLesson;

  const label = String(skillLabel || "").toLowerCase();
  if (label.includes("nghe") || label.includes("listening")) return "listening";
  if (label.includes("nói") || label.includes("speak")) return "speaking";
  if (label.includes("ngữ pháp") || label.includes("grammar")) return "grammar";
  if (label.includes("câu") || label.includes("pattern")) return "sentence_patterns";
  if (label.includes("từ") || label.includes("vocab")) return "vocabulary";

  return fromLesson || "vocabulary";
}
