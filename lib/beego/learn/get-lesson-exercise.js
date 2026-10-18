import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";

export const P1_QUESTION_ALIAS_MAP = {
  "p1-g1-n01-q1": "p1-g1-n01-a01",
  "p1-g1-n01-q2": "p1-g1-n01-a02",
  "p1-g1-n01-q3": "p1-g1-n01-a03",
  "p1-g1-n01-q4": "p1-g1-n01-a04",
  "p1-g1-n01-q5": "p1-g1-n01-a05",
  "p1-g1-n01-q6": "p1-g1-n01-a06",
  "p1-g1-n02-q1": "p1-g1-n02-a01",
  "p1-g1-n02-q2": "p1-g1-n02-a02",
  "p1-g1-n02-q3": "p1-g1-n02-a03",
  "p1-g1-n03-q1": "p1-g1-n03-a01",
  "p1-g1-n03-q2": "p1-g1-n03-a02",
  "p1-g1-n03-q3": "p1-g1-n03-a03",
};

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

  // Question alias mapping for Part 1 legacy revisions
  if (P1_QUESTION_ALIAS_MAP[qid]) {
    const mapped = tryLoad(lid, P1_QUESTION_ALIAS_MAP[qid]);
    if (mapped) return mapped;
  }

  // Heuristic alias: p1-g1-nXX-qY -> p1-g1-nXX-a0Y
  const qMatch = qid.match(/^(p1-g1-n\d+)-q([1-8])$/);
  if (qMatch) {
    const mappedId = `${qMatch[1]}-a0${qMatch[2]}`;
    const mapped = tryLoad(lid, mappedId);
    if (mapped) return mapped;
  }

  // mix-{hostLessonId}-{sourceQuestionId}-{stage}  e.g. mix-p1-g1-n01-p1-g1-n01-q1-warmup
  const mix = qid.match(/^mix-(p\d+-g\d+-n\d+)-(p\d+-g\d+-n\d+-(?:q\d+|a\d+))(?:-|$)/);
  if (mix) {
    const hit = tryLoad(mix[1], mix[2]) || tryLoad(lid, mix[2]);
    if (hit) return hit;
  }

  // pr-{sourceLessonId}-{sourceQuestionId}
  const pr = qid.match(/^pr-(p\d+-g\d+-n\d+)-(p\d+-g\d+-n\d+-(?:q\d+|a\d+))$/);
  if (pr) {
    const hit = tryLoad(pr[1], pr[2]);
    if (hit) return hit;
  }

  // If question was retired in p1g1-r4 (extra activities beyond 8 or obsolete test questions)
  if (lid.startsWith("p1-g1-") && (qid.match(/-a(?:09|10|11|12|13)$/) || qid.match(/-q(?:[9]|\d{2,})$/))) {
    return {
      exercise: null,
      retired: true,
      reason: "deprecated_in_r4",
      sourceLessonId: lid,
      sourceQuestionId: qid,
    };
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
