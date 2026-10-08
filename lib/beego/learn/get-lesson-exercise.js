import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";

/**
 * Load a single exercise from catalog by lessonId + questionId (curriculum-safe).
 * Resolves mix-/pr- ids via source hints or id heuristics.
 * @param {string} lessonId
 * @param {string} questionId
 * @param {{ sourceLessonId?: string, sourceQuestionId?: string }} [hints]
 * @returns {object|null}
 */
export function getLessonExerciseByRef(lessonId, questionId, hints = {}) {
  const tryLoad = (lid, qid) => {
    const lesson = getLessonContentById(lid);
    if (!lesson?.questions?.length) return null;
    const raw = lesson.questions.find((q) => String(q.id) === String(qid || "").trim());
    if (!raw) return null;
    return {
      exercise: normalizeExercise(raw),
      sourceLessonId: lesson.lessonId,
      sourceLessonType: lesson.type || lesson.activityType || "",
    };
  };

  const hintLesson = String(hints.sourceLessonId || "").trim();
  const hintQuestion = String(hints.sourceQuestionId || "").trim();
  if (hintLesson && hintQuestion) {
    const hit = tryLoad(hintLesson, hintQuestion);
    if (hit) return hit;
  }

  const lid = String(lessonId || "").trim();
  const qid = String(questionId || "").trim();
  const direct = tryLoad(lid, qid);
  if (direct) return direct;

  // mix-{hostLessonId}-{sourceQuestionId}-{stage}  e.g. mix-p1-g1-n01-p1-g1-n01-q1-warmup
  const mix = qid.match(/^mix-(p\d+-g\d+-n\d+)-(p\d+-g\d+-n\d+-q\d+)(?:-|$)/);
  if (mix) {
    const hit = tryLoad(mix[1], mix[2]) || tryLoad(lid, mix[2]);
    if (hit) return hit;
  }

  // pr-{sourceLessonId}-{sourceQuestionId}
  const pr = qid.match(/^pr-(p\d+-g\d+-n\d+)-(p\d+-g\d+-n\d+-q\d+)$/);
  if (pr) {
    const hit = tryLoad(pr[1], pr[2]);
    if (hit) return hit;
  }

  return null;
}

/**
 * Prior lesson ids in the same gate (n01 .. n-1) for a review node id.
 * @param {string} reviewLessonId e.g. p1-g1-n16
 */
export function siblingLessonIdsBeforeReview(reviewLessonId) {
  const m = String(reviewLessonId || "").match(/^(p\d+-g\d+)-n(\d+)$/);
  if (!m) return [];
  const prefix = m[1];
  const n = parseInt(m[2], 10);
  if (!Number.isFinite(n) || n <= 1) return [];
  const out = [];
  for (let i = 1; i < n; i += 1) {
    out.push(`${prefix}-n${String(i).padStart(2, "0")}`);
  }
  return out;
}
