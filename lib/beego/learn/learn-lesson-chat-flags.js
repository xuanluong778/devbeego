/**
 * Feature flags + env config for Learn-scoped lesson chat.
 * Default OFF — must set LEARN_LESSON_CHAT_ENABLED=1 (or true/yes/on).
 */

function envFlagTrue(name) {
  const v = String(process.env[name] ?? "")
    .trim()
    .toLowerCase();
  return v === "1" || v === "true" || v === "yes" || v === "on";
}

export function isLearnLessonChatEnabled() {
  return envFlagTrue("LEARN_LESSON_CHAT_ENABLED");
}

/** Daily successful AI turns per user (Learn-only counter). Default 30. */
export function getLearnLessonChatDailyLimit() {
  const n = Number(process.env.LEARN_LESSON_CHAT_DAILY_LIMIT);
  if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  return 30;
}

/** OpenAI call timeout (ms). Default 25000. */
export function getLearnLessonChatTimeoutMs() {
  const n = Number(process.env.LEARN_LESSON_CHAT_TIMEOUT_MS);
  if (Number.isFinite(n) && n >= 3000 && n <= 120000) return Math.floor(n);
  return 25_000;
}

/** Burst rate limit window. */
export function getLearnLessonChatRateLimit() {
  return {
    windowMs: 60_000,
    max: Number(process.env.LEARN_LESSON_CHAT_RATE_MAX) > 0
      ? Math.floor(Number(process.env.LEARN_LESSON_CHAT_RATE_MAX))
      : 20,
  };
}
