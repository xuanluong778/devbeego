import pool from "@/lib/db";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import {
  getLessonExerciseByRef,
  siblingLessonIdsBeforeReview,
} from "@/lib/beego/learn/get-lesson-exercise";

const MIN_QUESTIONS = 5;
const MAX_QUESTIONS = 10;
const TARGET_QUESTIONS = 8;

function daysSince(dateVal) {
  if (!dateVal) return 30;
  const t = new Date(dateVal).getTime();
  if (!Number.isFinite(t)) return 30;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

function attachReviewMeta(exercise, sourceLessonId, sourceLessonType, sourceQuestionId) {
  return {
    ...exercise,
    id: `pr-${sourceLessonId}-${sourceQuestionId}`,
    reviewMeta: {
      sourceLessonId,
      sourceLessonType,
      sourceQuestionId,
    },
  };
}

/**
 * @param {number} userId
 * @param {string} reviewLessonId
 */
export async function buildPersonalizedReviewSession(userId, reviewLessonId) {
  await ensureLearnMasteryTables();

  const reviewId = String(reviewLessonId || "").trim();
  const baseLesson = getLessonContentById(reviewId);
  if (!baseLesson || baseLesson.type !== "review") {
    const err = new Error("Not a review lesson.");
    err.code = "NOT_REVIEW";
    throw err;
  }

  const [openRows] = await pool.query(
    `SELECT lesson_id, question_id, skill_key, exercise_type, wrong_count, last_wrong_at, status
     FROM user_learn_mistakes
     WHERE user_id = ? AND status = 'open'
     ORDER BY wrong_count DESC, last_wrong_at DESC
     LIMIT 40`,
    [userId]
  );

  const [skillRows] = await pool.query(
    `SELECT skill_key, mastery_score, mastery_level, last_practiced_at, wrong_count
     FROM user_learn_skill_mastery
     WHERE user_id = ?
     ORDER BY mastery_score ASC, wrong_count DESC
     LIMIT 20`,
    [userId]
  );

  const weakSkillSet = new Set(
    skillRows.filter((s) => Number(s.mastery_score) < 55).map((s) => s.skill_key)
  );

  const candidates = [];
  const seen = new Set();

  function pushCandidate(ref, priority, reason) {
    const key = `${ref.sourceLessonId}::${ref.sourceQuestionId}`;
    if (seen.has(key)) return;
    const loaded = getLessonExerciseByRef(ref.sourceLessonId, ref.sourceQuestionId);
    if (!loaded?.exercise) return;
    seen.add(key);
    candidates.push({
      ...loaded,
      priority,
      reason,
      skillKey: ref.skillKey || loaded.exercise.skillLabel,
    });
  }

  for (const row of openRows) {
    const wrong = Number(row.wrong_count) || 1;
    const stale = daysSince(row.last_wrong_at);
    const priority = 10000 + wrong * 50 + stale * 3;
    pushCandidate(
      {
        sourceLessonId: row.lesson_id,
        sourceQuestionId: row.question_id,
        skillKey: row.skill_key,
      },
      priority,
      "open_mistake"
    );
  }

  for (const skill of skillRows) {
    const score = Number(skill.mastery_score);
    if (score >= 70 && !weakSkillSet.has(skill.skill_key)) continue;
    const stale = daysSince(skill.last_practiced_at);
    const priority = 5000 + (100 - score) * 8 + stale * 2 + Number(skill.wrong_count || 0) * 5;
    const [mistakesForSkill] = await pool.query(
      `SELECT lesson_id, question_id, skill_key, wrong_count, status
       FROM user_learn_mistakes
       WHERE user_id = ? AND skill_key = ?
       ORDER BY status ASC, wrong_count DESC
       LIMIT 5`,
      [userId, skill.skill_key]
    );
    for (const m of mistakesForSkill) {
      const p = priority + (m.status === "open" ? 200 : 0) + Number(m.wrong_count || 0) * 10;
      pushCandidate(
        {
          sourceLessonId: m.lesson_id,
          sourceQuestionId: m.question_id,
          skillKey: m.skill_key,
        },
        p,
        "weak_skill"
      );
    }
  }

  const siblings = siblingLessonIdsBeforeReview(reviewId);
  for (const lid of siblings) {
    const lesson = getLessonContentById(lid);
    if (!lesson?.questions?.length) continue;
    for (const q of lesson.questions) {
      const staleBonus = 100;
      pushCandidate(
        {
          sourceLessonId: lid,
          sourceQuestionId: q.id,
          skillKey: lesson.type,
        },
        100 + staleBonus,
        "gate_fallback"
      );
    }
  }

  candidates.sort((a, b) => b.priority - a.priority);

  let selected = candidates.slice(0, MAX_QUESTIONS);
  if (selected.length < MIN_QUESTIONS) {
    const fallbackQs = baseLesson.questions || [];
    for (const q of fallbackQs) {
      if (selected.length >= MIN_QUESTIONS) break;
      const loaded = getLessonExerciseByRef(reviewId, q.id);
      if (!loaded) continue;
      const key = `${reviewId}::${q.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push({ ...loaded, priority: 0, reason: "catalog_review_fallback" });
    }
  }

  if (selected.length === 0) {
    return {
      reviewLessonId: reviewId,
      mode: "fallback",
      sessionId: null,
      questions: baseLesson.questions,
      selection: { open_mistakes: 0, weak_skills: skillRows.length, total: 0 },
    };
  }

  const questions = selected.slice(0, MAX_QUESTIONS).map((c) => {
    const sourceQuestionId = String(c.exercise.id);
    return attachReviewMeta(c.exercise, c.sourceLessonId, c.sourceLessonType, sourceQuestionId);
  });

  const hasPersonal =
    selected.some((c) => c.reason === "open_mistake" || c.reason === "weak_skill") ||
    openRows.length > 0 ||
    skillRows.some((s) => Number(s.mastery_score) < 55);

  return {
    reviewLessonId: reviewId,
    mode: hasPersonal ? "personalized" : "gate_curriculum",
    sessionId: `rev-${userId}-${reviewId}-${questions.length}`,
    questions,
    selection: {
      open_mistakes: openRows.length,
      weak_skills: skillRows.filter((s) => Number(s.mastery_score) < 55).length,
      total: questions.length,
      reasons: questions.map((q) => q.reviewMeta?.sourceLessonId),
    },
  };
}
