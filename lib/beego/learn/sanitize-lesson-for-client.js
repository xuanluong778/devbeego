/**
 * Strip answer keys / grading secrets from lesson payloads sent to clients.
 * Full content remains server-side for grading via getLessonExerciseByRef.
 */

const STRIP_QUESTION_KEYS = new Set([
  "correctAnswer",
  "correct_answer",
  "correctOptionId",
  "answer",
  "answers",
  "acceptedAnswers",
  "acceptedText",
  "correctTokens",
  "explanation",
  "answerKey",
  "answer_key",
  "grader",
  "grading",
  "solution",
  "sampleAnswer",
]);

/**
 * @param {object} question
 * @returns {object}
 */
export function sanitizeQuestionForClient(question) {
  if (!question || typeof question !== "object") return question;
  const out = { ...question };
  for (const k of STRIP_QUESTION_KEYS) {
    if (k in out) delete out[k];
  }
  if (out.type === "story_comprehension") delete out.storyVi;
  // Nested legacy bags
  if (out.extensions && typeof out.extensions === "object") {
    const ext = { ...out.extensions };
    for (const k of STRIP_QUESTION_KEYS) {
      if (k in ext) delete ext[k];
    }
    // Open speaking: keep client-safe hint + focus chips (not exact answer keys).
    if (
      out.type === "speaking" ||
      out.type === "pronunciation" ||
      String(question?.extensions?.gradingMode || "") === "communicative_rubric"
    ) {
      if (question.extensions?.speakingHint) ext.speakingHint = String(question.extensions.speakingHint);
      if (Array.isArray(question.extensions?.focusWords)) {
        ext.focusWords = question.extensions.focusWords.map((w) => String(w || "").trim()).filter(Boolean);
      }
      if (Array.isArray(question.extensions?.canDoCriteria)) {
        ext.canDoCriteria = question.extensions.canDoCriteria.map((c) => String(c || "").trim()).filter(Boolean);
      }
      ext.sampleIsNotExactAnswer = true;
    }
    if (out.type === "story_comprehension") delete ext.storyVi;
    out.extensions = ext;
  }
  if (out.activityMeta && typeof out.activityMeta === "object") {
    const meta = { ...out.activityMeta };
    for (const k of STRIP_QUESTION_KEYS) {
      if (k in meta) delete meta[k];
    }
    out.activityMeta = meta;
  }
  if (out.reviewMeta && typeof out.reviewMeta === "object") {
    const meta = { ...out.reviewMeta };
    for (const k of STRIP_QUESTION_KEYS) {
      if (k in meta) delete meta[k];
    }
    out.reviewMeta = meta;
  }
  return out;
}

/**
 * @param {object} lesson
 * @returns {object|null}
 */
export function sanitizeLessonForClient(lesson) {
  if (!lesson) return null;
  const copy = JSON.parse(JSON.stringify(lesson));
  if (Array.isArray(copy.questions)) {
    copy.questions = copy.questions.map(sanitizeQuestionForClient);
  }
  // Never expose internal bank / selection that may embed answers
  if (copy.reviewSession?.selection) {
    copy.reviewSession = {
      ...copy.reviewSession,
      selection: undefined,
    };
    delete copy.reviewSession.selection;
  }
  return copy;
}

/**
 * Quick leak detector for tests / audits.
 * @param {unknown} payload
 * @returns {string[]}
 */
export function findAnswerLeaks(payload) {
  const leaks = [];
  const json = JSON.stringify(payload);
  if (!json) return leaks;
  if (/"correctAnswer"\s*:/.test(json)) leaks.push("correctAnswer");
  if (/"correct_answer"\s*:/.test(json)) leaks.push("correct_answer");
  if (/"answerKey"\s*:/.test(json)) leaks.push("answerKey");
  return leaks;
}
