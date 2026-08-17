import {
  SRS_ANSWER_TYPES,
  SRS_STATUS,
  SRS_INTERVAL_DAYS,
  DEFAULT_EASE_FACTOR,
} from "./srs-types.js";

function addDays(date, days) {
  const ms = Number(days) * 24 * 60 * 60 * 1000;
  return new Date(date.getTime() + ms);
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

function clampLevel(n) {
  const x = Number.isFinite(n) ? Math.floor(n) : 0;
  return clamp(x, 0, 5);
}

export function masteryScoreFromLevel(level) {
  const map = { 0: 10, 1: 30, 2: 50, 3: 65, 4: 85, 5: 100 };
  return map[clampLevel(level)] ?? 10;
}

/**
 * Apply SRS rating from vocabulary study session.
 */
export function applySrsRating(progress, answerType, options = {}) {
  const now = new Date();
  const type = String(answerType || SRS_ANSWER_TYPES.NORMAL).toLowerCase();

  const prevScore = Number(progress?.mastery_score ?? masteryScoreFromLevel(progress?.mastery_level ?? 0));
  const correctCount = Number(progress?.correct_count ?? progress?.correct_streak ?? 0) || 0;
  const wrongCount = Number(progress?.wrong_count ?? 0) || 0;
  const correctStreak = Number(progress?.correct_streak ?? 0) || 0;
  const lapseCount = Number(progress?.lapse_count ?? 0) || 0;
  let easeFactor = Number(progress?.ease_factor ?? DEFAULT_EASE_FACTOR) || DEFAULT_EASE_FACTOR;
  let intervalDays = Number(progress?.interval_days ?? 0) || 0;

  let masteryScore = prevScore;
  let nextCorrectCount = correctCount;
  let nextWrongCount = wrongCount;
  let nextStreak = correctStreak;
  let nextLapse = lapseCount;
  let status = SRS_STATUS.LEARNING;
  let masteryLevel = clampLevel(progress?.mastery_level ?? 0);

  const pronScore = options.pronunciationScore != null ? Number(options.pronunciationScore) : null;

  if (type === SRS_ANSWER_TYPES.FORGOT) {
    masteryScore = clamp(prevScore - 20, 0, 100);
    nextWrongCount = wrongCount + 1;
    nextStreak = 0;
    nextLapse = lapseCount + 1;
    status = SRS_STATUS.WEAK;
    intervalDays = SRS_INTERVAL_DAYS.forgot;
    easeFactor = clamp(easeFactor - 0.15, 1.3, 3.0);
    masteryLevel = 0;
  } else if (type === SRS_ANSWER_TYPES.HARD) {
    masteryScore = clamp(prevScore + 5, 0, 100);
    nextCorrectCount = correctCount + 1;
    nextStreak = 0;
    status = SRS_STATUS.REVIEW;
    intervalDays = SRS_INTERVAL_DAYS.hard;
    easeFactor = clamp(easeFactor - 0.05, 1.3, 3.0);
    masteryLevel = clampLevel(Math.max(1, masteryLevel));
  } else if (type === SRS_ANSWER_TYPES.NORMAL) {
    masteryScore = clamp(prevScore + 10, 0, 100);
    nextCorrectCount = correctCount + 1;
    nextStreak = correctStreak + 1;
    status = SRS_STATUS.LEARNING;
    intervalDays = SRS_INTERVAL_DAYS.normal;
    masteryLevel = clampLevel(masteryLevel + 1);
  } else if (type === SRS_ANSWER_TYPES.EASY) {
    masteryScore = clamp(prevScore + 15, 0, 100);
    nextCorrectCount = correctCount + 1;
    nextStreak = correctStreak + 1;
    easeFactor = clamp(easeFactor + 0.1, 1.3, 3.0);
    intervalDays = SRS_INTERVAL_DAYS.easy;
    if (nextStreak >= 2 && masteryScore >= 70) {
      status = SRS_STATUS.MASTERED;
      intervalDays = SRS_INTERVAL_DAYS.mastered;
      masteryLevel = clampLevel(Math.max(4, masteryLevel + 1));
    } else {
      status = SRS_STATUS.LEARNING;
      masteryLevel = clampLevel(masteryLevel + 1);
    }
  } else if (type === SRS_ANSWER_TYPES.MASTERED) {
    masteryScore = clamp(Math.max(prevScore + 20, 85), 0, 100);
    nextCorrectCount = correctCount + 1;
    nextStreak = correctStreak + 1;
    status = SRS_STATUS.MASTERED;
    intervalDays = Math.max(SRS_INTERVAL_DAYS.mastered, intervalDays * easeFactor);
    easeFactor = clamp(easeFactor + 0.15, 1.3, 3.0);
    masteryLevel = 5;
  }

  if (pronScore != null && pronScore >= 80 && type !== SRS_ANSWER_TYPES.FORGOT) {
    masteryScore = clamp(masteryScore + 3, 0, 100);
  }

  return {
    mastery_score: masteryScore,
    mastery_level: masteryLevel,
    correct_count: nextCorrectCount,
    wrong_count: nextWrongCount,
    correct_streak: nextStreak,
    lapse_count: nextLapse,
    last_reviewed_at: now,
    next_review_at: addDays(now, intervalDays),
    interval_days: Math.round(intervalDays * 100) / 100,
    ease_factor: Math.round(easeFactor * 100) / 100,
    last_answer_type: type,
    last_pronunciation_score: pronScore,
    status,
  };
}

/** @deprecated Use applySrsRating with answer_type. */
export function updateSRS(progress, isCorrect) {
  return applySrsRating(progress, isCorrect ? SRS_ANSWER_TYPES.NORMAL : SRS_ANSWER_TYPES.FORGOT);
}
