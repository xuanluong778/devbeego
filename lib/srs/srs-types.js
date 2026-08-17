/** SRS answer types & word status constants. */

export const SRS_STATUS = {
  NEW: "new",
  LEARNING: "learning",
  REVIEW: "review",
  WEAK: "weak",
  MASTERED: "mastered",
};

export const SRS_ANSWER_TYPES = {
  FORGOT: "forgot",
  HARD: "hard",
  NORMAL: "normal",
  EASY: "easy",
  MASTERED: "mastered",
};

/** Days until next review per answer type. */
export const SRS_INTERVAL_DAYS = {
  forgot: 0.25,
  hard: 1,
  normal: 3,
  easy: 7,
  mastered: 14,
};

export const DEFAULT_EASE_FACTOR = 2.5;

export function defaultProgressRow() {
  return {
    mastery_level: 0,
    mastery_score: 0,
    correct_count: 0,
    wrong_count: 0,
    correct_streak: 0,
    lapse_count: 0,
    interval_days: 0,
    ease_factor: DEFAULT_EASE_FACTOR,
    status: SRS_STATUS.NEW,
    last_answer_type: null,
    last_pronunciation_score: null,
  };
}

export function normalizeAnswerType(raw, isCorrectLegacy) {
  const t = String(raw || "").trim().toLowerCase();
  if (t === SRS_ANSWER_TYPES.FORGOT || t === "wrong" || t === "again") return SRS_ANSWER_TYPES.FORGOT;
  if (t === SRS_ANSWER_TYPES.HARD) return SRS_ANSWER_TYPES.HARD;
  if (t === SRS_ANSWER_TYPES.NORMAL) return SRS_ANSWER_TYPES.NORMAL;
  if (t === SRS_ANSWER_TYPES.EASY) return SRS_ANSWER_TYPES.EASY;
  if (t === SRS_ANSWER_TYPES.MASTERED || t === "very_easy") return SRS_ANSWER_TYPES.MASTERED;
  return isCorrectLegacy ? SRS_ANSWER_TYPES.NORMAL : SRS_ANSWER_TYPES.FORGOT;
}

export function resolveStudyStatusFromProgress(row) {
  if (!row) return "not_learned";
  const status = String(row.status || "").toLowerCase();
  if (status && Object.values(SRS_STATUS).includes(status)) {
    if (status === SRS_STATUS.NEW) return "not_learned";
    return status === SRS_STATUS.REVIEW ? "review" : status;
  }
  if (Number(row.mastery_level) >= 4 || Number(row.mastery_score) >= 85) return SRS_STATUS.MASTERED;
  if (Number(row.wrong_count) >= 2 || status === SRS_STATUS.WEAK) return SRS_STATUS.WEAK;
  if (row.next_review_at && new Date(row.next_review_at).getTime() <= Date.now()) return SRS_STATUS.REVIEW;
  if (row.has_progress === false) return "not_learned";
  return SRS_STATUS.LEARNING;
}
