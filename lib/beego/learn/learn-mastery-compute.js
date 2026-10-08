import {
  applyMasteryDecay,
  masteryPhaseFromMetrics,
  MASTERY_PHASE,
} from "@/lib/beego/learn/learn-mastery-phases";

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * Server-side mastery from real aggregates (never trust client score).
 * @param {{
 *   correctCount: number,
 *   wrongCount: number,
 *   recentAttempts: Array<{ is_correct: number, activity_stage?: string|null, difficulty?: string|null }>,
 *   openMistakeCount: number,
 *   lastPracticedAt?: Date|string|null,
 * }} input
 */
export function computeMasteryFromRealData(input) {
  const correct = Number(input.correctCount) || 0;
  const wrong = Number(input.wrongCount) || 0;
  const attempts = correct + wrong;
  const accuracyPct = attempts > 0 ? clamp(Math.round((correct / attempts) * 100), 0, 100) : 0;

  let recentCorrect = 0;
  let recoveryCorrect = 0;
  let recoveryTotal = 0;
  let challengeCorrect = 0;
  let challengeTotal = 0;
  let difficultyBonus = 0;

  for (const row of input.recentAttempts || []) {
    const ok = Number(row.is_correct) === 1;
    if (ok) recentCorrect += 1;
    const stage = String(row.activity_stage || "").toLowerCase();
    if (stage === "recovery") {
      recoveryTotal += 1;
      if (ok) recoveryCorrect += 1;
    }
    if (stage === "challenge") {
      challengeTotal += 1;
      if (ok) challengeCorrect += 1;
    }
    const diff = String(row.difficulty || "").toLowerCase();
    if (ok && diff === "hard") difficultyBonus += 1;
  }

  const recentTotal = (input.recentAttempts || []).length;
  const recentAcc = recentTotal > 0 ? (recentCorrect / recentTotal) * 100 : accuracyPct;

  let score = accuracyPct * 0.45 + recentAcc * 0.35;
  if (attempts >= 5) score += 5;
  if (recoveryTotal > 0 && recoveryCorrect / recoveryTotal >= 0.5) score += 8;
  if (challengeTotal > 0 && challengeCorrect / challengeTotal >= 0.5) score += 10;
  score += Math.min(8, difficultyBonus * 2);
  score -= Math.min(20, (Number(input.openMistakeCount) || 0) * 4);

  score = clamp(Math.round(score), 0, 100);
  score = applyMasteryDecay(score, input.lastPracticedAt);

  const phase = masteryPhaseFromMetrics(score, attempts, accuracyPct);

  return {
    mastery_score: score,
    mastery_level: phase === MASTERY_PHASE.MASTERED ? 5 : phase === MASTERY_PHASE.PRACTICING ? 3 : phase === MASTERY_PHASE.LEARNING ? 1 : 0,
    mastery_phase: phase,
    accuracy_pct: accuracyPct,
  };
}
