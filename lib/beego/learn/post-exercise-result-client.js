/**
 * POST /api/learn/exercise-result — records mastery/mistake (no XP/Honey).
 */

/**
 * @param {{
 *   attemptKey: string,
 *   lessonId: string,
 *   questionId: string,
 *   lessonType?: string,
 *   exerciseType: string,
 *   skillLabel?: string,
 *   isCorrect: boolean,
 *   answer?: unknown,
 *   activityStage?: string,
 *   difficulty?: string,
 * }} payload
 */
export async function postLearnExerciseResult(payload) {
  const attemptKey = String(payload.attemptKey || "").trim();
  const lessonId = String(payload.lessonId || "").trim();
  const questionId = String(payload.questionId || "").trim();
  if (!attemptKey || !lessonId || !questionId) {
    return { ok: false, status: 400, message: "Missing attempt or question." };
  }

  const body = {
    attempt_key: attemptKey,
    attemptKey,
    lesson_id: lessonId,
    lessonId,
    question_id: questionId,
    questionId,
    lesson_type: payload.lessonType || "",
    lessonType: payload.lessonType || "",
    exercise_type: payload.exerciseType || "unknown",
    exerciseType: payload.exerciseType || "unknown",
    skill_label: payload.skillLabel || "",
    skillLabel: payload.skillLabel || "",
    // is_correct ignored by server when answer present — kept for backward compat only
    is_correct: Boolean(payload.isCorrect),
    isCorrect: Boolean(payload.isCorrect),
    answer: payload.answer,
    activity_stage: payload.activityStage || "",
    activityStage: payload.activityStage || "",
    difficulty: payload.difficulty || "",
    replay: Boolean(payload.replay),
  };

  const assessmentSessionId = String(
    payload.assessmentSessionId || payload.assessment_session_id || ""
  ).trim();
  if (assessmentSessionId) {
    body.assessment_session_id = assessmentSessionId;
    body.assessmentSessionId = assessmentSessionId;
  }

  const res = await fetch("/api/learn/exercise-result", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.status === 401) {
    return { ok: false, status: 401, guest: true };
  }

  if (!res.ok || !json?.success) {
    return {
      ok: false,
      status: res.status,
      message: json?.message || "Could not record exercise result.",
      code: json?.code,
    };
  }

  return { ok: true, data: json.data || {} };
}
