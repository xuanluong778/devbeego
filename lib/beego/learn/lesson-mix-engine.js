import crypto from "node:crypto";
import { getMasteryContextForLesson } from "@/lib/beego/learn/smart-progression";
import { MASTERY_PHASE } from "@/lib/beego/learn/learn-mastery-phases";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";
import { getLessonExerciseByRef } from "@/lib/beego/learn/get-lesson-exercise";
import {
  STAGE_ORDER,
  defaultStageForExercise,
  inferExerciseDifficulty,
} from "@/lib/beego/learn/lesson-mix-stages";
import { normalizeExercise } from "@/lib/beego/learn/normalize-lesson-exercises";
import { isIntegratedLesson } from "@/lib/beego/learn/integrated-lesson";
import { P1_CONTENT_REVISION } from "@/lib/beego/learn/p1-g1-plan";

const MIN_ACTIVITIES = 5;
const MAX_ACTIVITIES = 10;

function attachActivityMeta(exercise, lesson, stage, difficulty, skillKey) {
  const sourceQuestionId = String(exercise.id);
  const meta = {
    stage,
    difficulty,
    required: exercise.required !== false,
    skillKey,
    sourceLessonId: lesson.lessonId,
    sourceQuestionId,
    sourceLessonType: lesson.type || lesson.activityType || "",
  };
  return {
    ...exercise,
    id: `mix-${lesson.lessonId}-${sourceQuestionId}-${stage}`,
    activityMeta: meta,
    reviewMeta: {
      sourceLessonId: meta.sourceLessonId,
      sourceLessonType: meta.sourceLessonType,
      sourceQuestionId: meta.sourceQuestionId,
    },
  };
}

function sortByStageAndId(a, b) {
  const sa = STAGE_ORDER[a.activityMeta?.stage] ?? 35;
  const sb = STAGE_ORDER[b.activityMeta?.stage] ?? 35;
  if (sa !== sb) return sa - sb;
  return String(a.activityMeta?.sourceQuestionId).localeCompare(String(b.activityMeta?.sourceQuestionId));
}

/**
 * @param {object} lesson normalized lesson content
 * @param {{ masteryBySkill?: Map<string, number>, phaseBySkill?: Map<string, string>, openMistakes?: Array, smartProgression?: object|null, userId?: number|null }} ctx
 */
export function buildLessonMixFromContent(lesson, ctx = {}) {
  const masteryBySkill = ctx.masteryBySkill || new Map();
  const phaseBySkill = ctx.phaseBySkill || new Map();
  const openMistakes = ctx.openMistakes || [];
  const smartProgression = ctx.smartProgression || null;
  const lessonId = lesson.lessonId;
  const lessonType = lesson.type || "";
  const rawQuestions = (lesson.questions || []).map(normalizeExercise);

  if (isIntegratedLesson({ questions: rawQuestions })) {
    const questions = rawQuestions.map((exercise, index) =>
      attachActivityMeta(
        exercise,
        lesson,
        index === rawQuestions.length - 1 ? "challenge" : "practice",
        "medium",
        resolveLearnSkillKey(lessonType, exercise.type, exercise.skillLabel)
      )
    );
    const fingerprint = crypto
      .createHash("sha256")
      .update(
        JSON.stringify({
          contentBank: String(lessonId).startsWith("p1-g1-") ? P1_CONTENT_REVISION : "v6-translation-language",
          lessonId,
          ids: questions.map((question) => question.activityMeta.sourceQuestionId),
          pairs: questions.map((question) =>
            (question.pairs || []).map((pair) => `${pair.pairId}|${pair.en}|${pair.vi}`).join(",")
          ),
        })
      )
      .digest("hex")
      .slice(0, 64);
    return {
      questions,
      mixFingerprint: fingerprint,
      mixMeta: {
        mode: "integrated",
        primarySkill: resolveLearnSkillKey(lessonType, rawQuestions[0]?.type || "", rawQuestions[0]?.skillLabel),
        stages: questions.map((question) => question.activityMeta.stage),
      },
    };
  }

  const primarySkill = resolveLearnSkillKey(lessonType, rawQuestions[0]?.type || "", rawQuestions[0]?.skillLabel);
  const primaryPhase = phaseBySkill.get(primarySkill) || MASTERY_PHASE.NEW;
  const primaryMastery = Number(masteryBySkill.get(primarySkill) ?? 0);
  const isNewUser = masteryBySkill.size === 0 || primaryPhase === MASTERY_PHASE.NEW;
  const tier = smartProgression?.progression_tier || null;
  const isWeak =
    tier === "weak" ||
    primaryPhase === MASTERY_PHASE.NEW ||
    primaryPhase === MASTERY_PHASE.LEARNING ||
    primaryMastery < 45;
  const isStrong =
    tier === "strong" ||
    primaryPhase === MASTERY_PHASE.MASTERED ||
    primaryMastery >= 75;

  const buckets = {
    warmup: [],
    learn: [],
    practice: [],
    skill_activity: [],
    recovery: [],
    challenge: [],
  };

  rawQuestions.forEach((ex, idx) => {
    let stage = defaultStageForExercise(ex, lessonType, idx);
    let difficulty = inferExerciseDifficulty(ex, lessonType);
    const skillKey = resolveLearnSkillKey(lessonType, ex.type, ex.skillLabel);

    if (isStrong && stage === "warmup" && idx > 0) {
      stage = "practice";
      difficulty = "medium";
    }
    if (isWeak && (stage === "warmup" || stage === "learn")) {
      difficulty = "easy";
    }
    if (isStrong && stage === "practice" && difficulty === "easy") {
      stage = "practice";
      difficulty = "hard";
    }

    buckets[stage]?.push(attachActivityMeta(ex, lesson, stage, difficulty, skillKey));
  });

  for (const m of openMistakes) {
    if (String(m.lesson_id) !== String(lessonId) && String(m.skill_key) !== primarySkill) continue;
    const loaded = getLessonExerciseByRef(m.lesson_id, m.question_id);
    if (!loaded?.exercise) continue;
    const ex = normalizeExercise(loaded.exercise);
    const skillKey = resolveLearnSkillKey(loaded.sourceLessonType, ex.type, ex.skillLabel);
    buckets.recovery.push(
      attachActivityMeta(ex, { lessonId: loaded.sourceLessonId, type: loaded.sourceLessonType }, "recovery", "medium", skillKey)
    );
  }

  if (!buckets.warmup.length && buckets.learn.length) {
    buckets.warmup.push(buckets.learn.shift());
  }
  const challengeCandidates = [...buckets.practice, ...buckets.skill_activity, ...buckets.learn];
  challengeCandidates.sort((a, b) => {
    const da = a.activityMeta?.difficulty === "hard" ? 1 : 0;
    const db = b.activityMeta?.difficulty === "hard" ? 1 : 0;
    return db - da;
  });
  if (challengeCandidates.length) {
    const ch = { ...challengeCandidates[0], activityMeta: { ...challengeCandidates[0].activityMeta } };
    ch.activityMeta.stage = "challenge";
    ch.activityMeta.required = true;
    ch.activityMeta.difficulty = isStrong ? "hard" : "medium";
    buckets.challenge = [ch];
  }

  const recoveryBoost = Number(smartProgression?.recovery_priority || 50);
  const challengeBoost = Number(smartProgression?.challenge_priority || 50);
  const limits = {
    warmup: isStrong ? 1 : 1,
    learn: isWeak ? 2 : isStrong ? 1 : 2,
    practice: isWeak ? Math.min(4, 2 + Math.floor(recoveryBoost / 40)) : isStrong ? 2 : 3,
    skill_activity: lessonType === "listening" || lessonType === "speaking" ? (isStrong ? 2 : 1) : isStrong ? 1 : 1,
    recovery: isWeak || openMistakes.length ? Math.min(3, 1 + Math.floor(recoveryBoost / 35)) : 1,
    challenge: isStrong ? Math.min(2, 1 + Math.floor(challengeBoost / 50)) : 1,
  };

  const selected = [];
  const seen = new Set();
  function take(stage, max) {
    const list = buckets[stage] || [];
    let n = 0;
    for (const item of list) {
      if (n >= max) break;
      const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(item);
      n += 1;
    }
  }

  take("warmup", limits.warmup);
  take("learn", limits.learn);
  take("recovery", limits.recovery);
  take("practice", limits.practice);
  take("skill_activity", limits.skill_activity);

  for (const item of buckets.challenge) {
    const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    selected.push(item);
    break;
  }
  if (!selected.some((q) => q.activityMeta?.stage === "challenge")) {
    for (const item of challengeCandidates) {
      const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
      if (seen.has(key)) continue;
      const ch = { ...item, activityMeta: { ...item.activityMeta, stage: "challenge", required: true } };
      seen.add(key);
      selected.push(ch);
      break;
    }
  }

  const effectiveMin = Math.min(MIN_ACTIVITIES, rawQuestions.length + (buckets.recovery?.length || 0));
  if (selected.length < effectiveMin) {
    for (const stage of ["practice", "learn", "skill_activity", "warmup"]) {
      for (const item of buckets[stage] || []) {
        if (selected.length >= effectiveMin) break;
        const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(item);
      }
    }
  }

  // Prefer a full 10-activity mix when the lesson bank is large enough
  const targetCount = Math.min(MAX_ACTIVITIES, Math.max(effectiveMin, rawQuestions.length));
  if (selected.length < targetCount) {
    for (const stage of ["practice", "learn", "skill_activity", "warmup", "recovery", "challenge"]) {
      for (const item of buckets[stage] || []) {
        if (selected.length >= targetCount) break;
        const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
        if (seen.has(key)) continue;
        seen.add(key);
        selected.push(item);
      }
    }
  }

  // Also pull any remaining raw (already bucketed) by re-walking all buckets
  if (selected.length < Math.min(MAX_ACTIVITIES, rawQuestions.length)) {
    const all = Object.values(buckets).flat();
    for (const item of all) {
      if (selected.length >= Math.min(MAX_ACTIVITIES, rawQuestions.length)) break;
      const key = `${item.activityMeta.sourceLessonId}::${item.activityMeta.sourceQuestionId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      selected.push(item);
    }
  }

  selected.sort(sortByStageAndId);
  let questions = selected.slice(0, MAX_ACTIVITIES);
  if (openMistakes.length) {
    for (const m of openMistakes) {
      const qid = String(m.question_id || "");
      const loaded = getLessonExerciseByRef(m.lesson_id, qid);
      if (!loaded?.exercise) continue;
      const ex = normalizeExercise(loaded.exercise);
      const skillKey = resolveLearnSkillKey(loaded.sourceLessonType, ex.type, ex.skillLabel);
      const idx = questions.findIndex((q) => q.activityMeta?.sourceQuestionId === qid);
      if (idx >= 0) {
        questions[idx] = attachActivityMeta(
          ex,
          { lessonId: loaded.sourceLessonId, type: loaded.sourceLessonType },
          "recovery",
          "medium",
          skillKey
        );
      } else if (questions.length < MAX_ACTIVITIES) {
        questions.push(
          attachActivityMeta(
            ex,
            { lessonId: loaded.sourceLessonId, type: loaded.sourceLessonType },
            "recovery",
            "medium",
            skillKey
          )
        );
      }
    }
    questions.sort(sortByStageAndId);
    questions = questions.slice(0, MAX_ACTIVITIES);
  }
  if (!questions.some((q) => q.activityMeta?.stage === "challenge") && questions.length) {
    const target =
      [...questions].reverse().find((q) => q.activityMeta?.stage !== "recovery") ||
      questions[questions.length - 1];
    target.activityMeta = {
      ...target.activityMeta,
      stage: "challenge",
      required: true,
      difficulty: isStrong ? "hard" : target.activityMeta.difficulty,
    };
    questions.sort(sortByStageAndId);
  }

  const fingerprint = crypto
    .createHash("sha256")
    .update(
      JSON.stringify({
        contentBank: "v3",
        lessonId,
        ids: questions.map((q) => `${q.activityMeta.sourceQuestionId}:${q.activityMeta.stage}`),
        mode: isNewUser ? "standard" : isWeak ? "weak" : isStrong ? "strong" : "adaptive",
      })
    )
    .digest("hex")
    .slice(0, 64);

  return {
    questions,
    mixFingerprint: fingerprint,
    mixMeta: {
      mode: isNewUser ? "standard" : "adaptive",
      primarySkill,
      primaryMastery,
      primaryPhase,
      progressionTier: tier,
      stages: questions.map((q) => q.activityMeta.stage),
    },
  };
}

/**
 * @param {number|null} userId
 * @param {object} lesson
 */
export async function buildAdaptiveLessonMix(userId, lesson) {
  if (!userId) {
    return buildLessonMixFromContent(lesson, {});
  }

  const lessonType = lesson.type || "";
  const ctx = await getMasteryContextForLesson(userId, lesson.lessonId, lessonType);
  return buildLessonMixFromContent(lesson, {
    masteryBySkill: ctx.masteryBySkill,
    phaseBySkill: ctx.phaseBySkill,
    openMistakes: ctx.openMistakes,
    smartProgression: ctx.smartProgression,
    userId,
  });
}
