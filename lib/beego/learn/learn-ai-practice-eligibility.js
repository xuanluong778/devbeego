/** Lesson types where optional AI practice is useful. Test/boss stays exercise-only. */
const SUITABLE_TYPES = new Set([
  "vocabulary",
  "sentence_patterns",
  "grammar",
  "listening",
  "speaking",
  "story",
  "review",
]);

export function isLessonSuitableForAiPractice(lesson) {
  const type = String(lesson?.type || lesson?.nodeType || lesson?.activityType || "").trim();
  return SUITABLE_TYPES.has(type);
}
