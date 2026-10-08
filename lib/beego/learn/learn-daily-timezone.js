/** Timezone helpers for Learn daily goal / streak (Phase 8). */

export const DEFAULT_LEARN_TIMEZONE = "Asia/Ho_Chi_Minh";
export const DEFAULT_DAILY_GOAL_XP = 30;
export const ALLOWED_DAILY_GOAL_OPTIONS = [20, 30, 50, 80];

/**
 * @param {string|null|undefined} tz
 */
export function resolveLearnTimezone(tz) {
  const raw = String(tz || "").trim() || DEFAULT_LEARN_TIMEZONE;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: raw });
    return raw;
  } catch {
    return DEFAULT_LEARN_TIMEZONE;
  }
}

/**
 * Calendar YYYY-MM-DD in the given IANA timezone.
 * @param {Date} [date]
 * @param {string} [tz]
 */
export function ymdInTimezone(date = new Date(), tz = DEFAULT_LEARN_TIMEZONE) {
  const zone = resolveLearnTimezone(tz);
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: zone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const y = parts.find((p) => p.type === "year")?.value;
  const m = parts.find((p) => p.type === "month")?.value;
  const d = parts.find((p) => p.type === "day")?.value;
  return `${y}-${m}-${d}`;
}

/**
 * Yesterday YYYY-MM-DD relative to calendar date in timezone.
 * @param {Date} [date]
 * @param {string} [tz]
 */
export function yesterdayYmdInTimezone(date = new Date(), tz = DEFAULT_LEARN_TIMEZONE) {
  const today = ymdInTimezone(date, tz);
  const [y, m, d] = today.split("-").map(Number);
  const utcNoon = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  utcNoon.setUTCDate(utcNoon.getUTCDate() - 1);
  const yy = utcNoon.getUTCFullYear();
  const mm = String(utcNoon.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(utcNoon.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/**
 * @param {number} goalXp
 */
export function clampDailyGoalXp(goalXp) {
  const n = Math.round(Number(goalXp) || DEFAULT_DAILY_GOAL_XP);
  if (ALLOWED_DAILY_GOAL_OPTIONS.includes(n)) return n;
  return Math.max(10, Math.min(200, n));
}
