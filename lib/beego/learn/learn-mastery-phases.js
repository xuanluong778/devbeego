/** Learn-tab mastery phases (Phase 7) — not SRS word mastery. */

export const MASTERY_PHASE = {
  NEW: "NEW",
  LEARNING: "LEARNING",
  PRACTICING: "PRACTICING",
  MASTERED: "MASTERED",
};

/**
 * @param {number} score 0–100
 * @param {number} attempts
 * @param {number} accuracyPct 0–100
 */
export function masteryPhaseFromMetrics(score, attempts, accuracyPct) {
  const s = Number(score) || 0;
  const a = Number(attempts) || 0;
  const acc = Number(accuracyPct) || 0;
  if (a === 0) return MASTERY_PHASE.NEW;
  if (a < 4 || s < 25) return MASTERY_PHASE.LEARNING;
  if (s >= 85 && acc >= 80 && a >= 8) return MASTERY_PHASE.MASTERED;
  if (s >= 55 || acc >= 65) return MASTERY_PHASE.PRACTICING;
  return MASTERY_PHASE.LEARNING;
}

/**
 * Decay score when idle (days since last practice).
 * @param {number} score
 * @param {Date|string|null} lastPracticedAt
 */
export function applyMasteryDecay(score, lastPracticedAt) {
  let s = Number(score) || 0;
  if (!lastPracticedAt) return s;
  const t = new Date(lastPracticedAt).getTime();
  if (!Number.isFinite(t)) return s;
  const days = Math.max(0, Math.floor((Date.now() - t) / 86400000));
  if (days <= 7) return s;
  const weeks = Math.floor((days - 7) / 7);
  const drop = Math.min(25, weeks * 3);
  return Math.max(0, s - drop);
}

export function progressionTierFromPhase(phase, openMistakeCount = 0) {
  if (openMistakeCount > 0 || phase === MASTERY_PHASE.NEW || phase === MASTERY_PHASE.LEARNING) {
    return "weak";
  }
  if (phase === MASTERY_PHASE.MASTERED) return "strong";
  return "medium";
}
