import { DEFAULT_FIRST_LESSON_ID, LEARNING_PARTS } from "@/lib/beego/learning-path-catalog";
import { listAllLessonIds } from "@/lib/beego/learn/lesson-content-build";

export const PLACEMENT_MIN_QUESTIONS = 8;
export const PLACEMENT_MAX_QUESTIONS = 16;
export const PLACEMENT_START_DIFFICULTY = 2;

/** Deterministic level → first vocabulary lesson of that part. */
const LEVEL_START_LESSON = {
  A0: "p1-g1-n01",
  A1: "p3-g1-n01",
  "A1+": "p5-g1-n01",
  A2: "p6-g1-n01",
  "B1+": "p8-g1-n01",
};

const KNOWN_LESSONS = new Set(listAllLessonIds());

/**
 * @param {string} lessonId
 */
export function assertKnownLessonId(lessonId) {
  const id = String(lessonId || "").trim();
  if (KNOWN_LESSONS.has(id)) return id;
  return DEFAULT_FIRST_LESSON_ID;
}

/**
 * @param {number} score 0–100
 */
export function estimateLevelFromScore(score) {
  const s = Number(score) || 0;
  if (s < 25) return "A0";
  if (s < 45) return "A1";
  if (s < 65) return "A1+";
  if (s < 85) return "A2";
  return "B1+";
}

/**
 * @param {string} level
 */
export function recommendedLessonForLevel(level) {
  const mapped = LEVEL_START_LESSON[level] || DEFAULT_FIRST_LESSON_ID;
  return assertKnownLessonId(mapped);
}

/**
 * Soft max confidence from answer consistency + count.
 * @param {{ asked: number, correct: number, ability: number, streakConsistent: number }} m
 */
export function computePlacementConfidence(m) {
  const asked = Math.max(0, Number(m.asked) || 0);
  const ability = Number(m.ability) || 0;
  const streak = Number(m.streakConsistent) || 0;
  const coverage = Math.min(1, asked / PLACEMENT_MAX_QUESTIONS);
  const abilityFactor = Math.min(1, Math.abs(ability) / 4);
  const streakFactor = Math.min(1, streak / 4);
  return Math.round(Math.min(0.98, 0.35 * coverage + 0.4 * abilityFactor + 0.25 * streakFactor) * 1000) / 1000;
}

/**
 * @param {Array<{ difficulty: number, is_correct: boolean, skill_key: string }>} answers
 */
export function scorePlacementAnswers(answers) {
  let weightSum = 0;
  let earned = 0;
  const bySkill = {};

  for (const a of answers) {
    const d = Math.max(1, Math.min(4, Number(a.difficulty) || 2));
    const w = d;
    weightSum += w;
    if (a.is_correct) earned += w;
    const sk = a.skill_key || "vocabulary";
    if (!bySkill[sk]) bySkill[sk] = { correct: 0, total: 0 };
    bySkill[sk].total += 1;
    if (a.is_correct) bySkill[sk].correct += 1;
  }

  const placementScore =
    weightSum > 0 ? Math.round((earned / weightSum) * 1000) / 10 : 0;

  const skillAcc = Object.entries(bySkill).map(([skill, v]) => ({
    skill,
    accuracy: v.total ? Math.round((v.correct / v.total) * 100) : 0,
    total: v.total,
  }));
  skillAcc.sort((a, b) => b.accuracy - a.accuracy);
  const strengths = skillAcc.filter((s) => s.total >= 2 && s.accuracy >= 70).map((s) => s.skill);
  const weakSkills = skillAcc.filter((s) => s.total >= 2 && s.accuracy < 55).map((s) => s.skill);

  const estimatedLevel = estimateLevelFromScore(placementScore);
  const recommendedLessonId = recommendedLessonForLevel(estimatedLevel);

  return {
    placementScore,
    estimatedLevel,
    strengths: strengths.length ? strengths : skillAcc.slice(0, 1).map((s) => s.skill),
    weakSkills,
    recommendedLessonId,
    skillBreakdown: skillAcc,
  };
}

/**
 * Early-stop when confident enough after min questions.
 */
export function shouldEarlyStopPlacement({ asked, confidence, consecutiveSameDirection }) {
  if (asked < PLACEMENT_MIN_QUESTIONS) return false;
  if (asked >= PLACEMENT_MAX_QUESTIONS) return true;
  if (confidence >= 0.78 && consecutiveSameDirection >= 3) return true;
  if (confidence >= 0.88 && asked >= PLACEMENT_MIN_QUESTIONS + 2) return true;
  return false;
}

/**
 * Map placement to smart progression tier (not mastery).
 * @param {number} score
 * @param {string[]} weakSkills
 */
export function placementToProgressionTier(score, weakSkills = []) {
  if ((weakSkills || []).length >= 2 || score < 40) return "weak";
  if (score >= 75) return "strong";
  return "medium";
}

export function catalogLevels() {
  return LEARNING_PARTS.map((p) => p.level);
}
