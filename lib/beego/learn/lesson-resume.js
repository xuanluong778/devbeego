/** Resume position from attempts already stored for this lesson. */

export function sourceQuestionId(question) {
  return String(
    question?.activityMeta?.sourceQuestionId ||
      question?.reviewMeta?.sourceQuestionId ||
      question?.id ||
      ""
  );
}

/**
 * @param {object[]} questions
 * @param {string[]} answeredIds
 * @returns {number} index to open, or questions.length when every question was submitted
 */
export function resumeStartIndex(questions, answeredIds) {
  const answered = new Set((answeredIds || []).map((id) => String(id)));
  const index = (questions || []).findIndex((question) => !answered.has(sourceQuestionId(question)));
  if (index < 0) return (questions || []).length;
  return index;
}
