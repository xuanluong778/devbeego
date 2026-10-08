import pool from "@/lib/db";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import {
  ALLOWED_DAILY_GOAL_OPTIONS,
  DEFAULT_DAILY_GOAL_XP,
  DEFAULT_LEARN_TIMEZONE,
  clampDailyGoalXp,
  resolveLearnTimezone,
  ymdInTimezone,
  yesterdayYmdInTimezone,
} from "@/lib/beego/learn/learn-daily-timezone";

let schemaReady = false;

export async function ensureLearnDailyGoalTables() {
  if (schemaReady) return;
  await ensureUserStatsTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_daily_settings (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      daily_goal_xp INT UNSIGNED NOT NULL DEFAULT 30,
      timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
      streak_freeze_ready TINYINT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_daily_progress (
      user_id BIGINT UNSIGNED NOT NULL,
      progress_date DATE NOT NULL,
      goal_xp INT UNSIGNED NOT NULL DEFAULT 30,
      xp_earned INT UNSIGNED NOT NULL DEFAULT 0,
      lessons_completed INT UNSIGNED NOT NULL DEFAULT 0,
      goal_completed_at DATETIME NULL,
      streak_applied TINYINT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, progress_date),
      KEY idx_uldp_user_completed (user_id, goal_completed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * @param {number} userId
 * @param {import('mysql2/promise').PoolConnection} [conn]
 */
export async function ensureDailySettingsRow(userId, conn = pool) {
  await ensureLearnDailyGoalTables();
  await conn.query(
    `INSERT IGNORE INTO user_learn_daily_settings (user_id, daily_goal_xp, timezone)
     VALUES (?, ?, ?)`,
    [userId, DEFAULT_DAILY_GOAL_XP, DEFAULT_LEARN_TIMEZONE]
  );
}

/**
 * @param {number} userId
 * @param {{ dailyGoalXp?: number, timezone?: string }} opts
 */
export async function updateLearnDailySettings(userId, opts = {}) {
  await ensureDailySettingsRow(userId);
  const goal = opts.dailyGoalXp != null ? clampDailyGoalXp(opts.dailyGoalXp) : null;
  const tz = opts.timezone != null ? resolveLearnTimezone(opts.timezone) : null;
  if (goal == null && tz == null) {
    return getLearnDailyMotivation(userId);
  }
  await pool.query(
    `UPDATE user_learn_daily_settings SET
       daily_goal_xp = COALESCE(?, daily_goal_xp),
       timezone = COALESCE(?, timezone),
       updated_at = CURRENT_TIMESTAMP
     WHERE user_id = ?`,
    [goal, tz, userId]
  );
  return getLearnDailyMotivation(userId);
}

/**
 * Build guest-facing motivation payload (no persist).
 */
export function getGuestDailyMotivation() {
  return {
    streak: 0,
    best_streak: 0,
    xp_today: 0,
    daily_goal_xp: DEFAULT_DAILY_GOAL_XP,
    daily_goal_progress_pct: 0,
    daily_goal_completed: false,
    daily_goal_just_completed: false,
    progress_date: ymdInTimezone(new Date(), DEFAULT_LEARN_TIMEZONE),
    timezone: DEFAULT_LEARN_TIMEZONE,
    goal_options: ALLOWED_DAILY_GOAL_OPTIONS,
    guest: true,
  };
}

/**
 * @param {number} userId
 */
export async function getLearnDailyMotivation(userId) {
  await ensureDailySettingsRow(userId);

  const [settingsRows] = await pool.query(
    `SELECT daily_goal_xp, timezone, streak_freeze_ready
     FROM user_learn_daily_settings WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const settings = settingsRows[0] || {
    daily_goal_xp: DEFAULT_DAILY_GOAL_XP,
    timezone: DEFAULT_LEARN_TIMEZONE,
    streak_freeze_ready: 0,
  };
  const tz = resolveLearnTimezone(settings.timezone);
  const today = ymdInTimezone(new Date(), tz);
  const goalXp = clampDailyGoalXp(settings.daily_goal_xp);

  const [statsRows] = await pool.query(
    `SELECT current_streak, best_streak, last_active_date
     FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const stats = statsRows[0] || {
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  };

  let last = stats.last_active_date;
  if (last instanceof Date) {
    last = ymdInTimezone(last, tz);
  } else if (last) {
    last = String(last).slice(0, 10);
  }

  let streak = Number(stats.current_streak || 0);
  const yday = yesterdayYmdInTimezone(new Date(), tz);
  // Soft display correction if user missed a day (without writing until next complete)
  if (last && last !== today && last !== yday && streak > 0) {
    streak = 0;
  }

  const [progRows] = await pool.query(
    `SELECT xp_earned, goal_xp, goal_completed_at, lessons_completed, streak_applied
     FROM user_learn_daily_progress
     WHERE user_id = ? AND progress_date = ?
     LIMIT 1`,
    [userId, today]
  );
  const prog = progRows[0] || null;
  const xpToday = Number(prog?.xp_earned || 0);
  const goal = prog ? clampDailyGoalXp(prog.goal_xp) : goalXp;
  const completed = Boolean(prog?.goal_completed_at);
  const pct = Math.max(0, Math.min(100, Math.round((xpToday / Math.max(1, goal)) * 100)));

  return {
    streak,
    best_streak: Number(stats.best_streak || 0),
    xp_today: xpToday,
    daily_goal_xp: goal,
    daily_goal_progress_pct: pct,
    daily_goal_completed: completed,
    daily_goal_just_completed: false,
    lessons_completed_today: Number(prog?.lessons_completed || 0),
    progress_date: today,
    timezone: tz,
    streak_freeze_ready: Number(settings.streak_freeze_ready || 0),
    goal_options: ALLOWED_DAILY_GOAL_OPTIONS,
    guest: false,
  };
}

/**
 * Apply XP toward daily goal + streak inside an open transaction (lesson complete).
 * Idempotent per calendar day for streak; goal_completed_at set once.
 *
 * @param {import('mysql2/promise').PoolConnection} conn
 * @param {number} userId
 * @param {{ xpAwarded: number, alreadyCompletedLesson?: boolean }} input
 */
export async function applyDailyGoalAndStreakInTx(conn, userId, input) {
  await ensureLearnDailyGoalTables();
  await ensureDailySettingsRow(userId, conn);

  const xpAwarded = Math.max(0, Math.round(Number(input.xpAwarded) || 0));
  if (xpAwarded <= 0) {
    return {
      streak_changed: false,
      daily_goal_just_completed: false,
      xp_today: 0,
      daily_goal_completed: false,
    };
  }

  const [settingsRows] = await conn.query(
    `SELECT daily_goal_xp, timezone FROM user_learn_daily_settings WHERE user_id = ? LIMIT 1 FOR UPDATE`,
    [userId]
  );
  const settings = settingsRows[0] || {
    daily_goal_xp: DEFAULT_DAILY_GOAL_XP,
    timezone: DEFAULT_LEARN_TIMEZONE,
  };
  const tz = resolveLearnTimezone(settings.timezone);
  const today = ymdInTimezone(new Date(), tz);
  const yday = yesterdayYmdInTimezone(new Date(), tz);
  const goalXp = clampDailyGoalXp(settings.daily_goal_xp);

  const [sRows] = await conn.query(
    `SELECT current_streak, best_streak, last_active_date
     FROM user_stats WHERE user_id = ? LIMIT 1 FOR UPDATE`,
    [userId]
  );
  const s = sRows[0] || {
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
  };

  let last = s.last_active_date;
  if (last instanceof Date) {
    last = ymdInTimezone(last, tz);
  } else if (last) {
    last = String(last).slice(0, 10);
  }

  let streak = Number(s.current_streak || 0);
  let streakChanged = false;
  if (last === today) {
    /* same day — keep streak */
  } else if (last === yday) {
    streak += 1;
    streakChanged = true;
  } else {
    streak = 1;
    streakChanged = true;
  }
  const best = Math.max(Number(s.best_streak || 0), streak);

  await conn.query(
    `INSERT INTO user_learn_daily_progress
       (user_id, progress_date, goal_xp, xp_earned, lessons_completed, streak_applied)
     VALUES (?, ?, ?, ?, 1, ?)
     ON DUPLICATE KEY UPDATE
       xp_earned = xp_earned + VALUES(xp_earned),
       lessons_completed = lessons_completed + 1,
       goal_xp = IF(goal_completed_at IS NULL, VALUES(goal_xp), goal_xp),
       streak_applied = GREATEST(streak_applied, VALUES(streak_applied)),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, today, goalXp, xpAwarded, streakChanged ? 1 : 0]
  );

  const [progRows] = await conn.query(
    `SELECT xp_earned, goal_xp, goal_completed_at
     FROM user_learn_daily_progress
     WHERE user_id = ? AND progress_date = ?
     LIMIT 1 FOR UPDATE`,
    [userId, today]
  );
  const prog = progRows[0];
  const xpToday = Number(prog?.xp_earned || 0);
  const goal = clampDailyGoalXp(prog?.goal_xp ?? goalXp);
  let justCompleted = false;
  let goalCompleted = Boolean(prog?.goal_completed_at);

  if (!goalCompleted && xpToday >= goal) {
    await conn.query(
      `UPDATE user_learn_daily_progress
       SET goal_completed_at = NOW(), updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND progress_date = ? AND goal_completed_at IS NULL`,
      [userId, today]
    );
    justCompleted = true;
    goalCompleted = true;
  }

  await conn.query(
    `UPDATE user_stats SET
       current_streak = ?,
       best_streak = ?,
       last_active_date = ?,
       last_answer_at = NOW()
     WHERE user_id = ?`,
    [streak, best, today, userId]
  );

  return {
    streak,
    best_streak: best,
    streak_changed: streakChanged,
    xp_today: xpToday,
    daily_goal_xp: goal,
    daily_goal_progress_pct: Math.max(0, Math.min(100, Math.round((xpToday / Math.max(1, goal)) * 100))),
    daily_goal_completed: goalCompleted,
    daily_goal_just_completed: justCompleted,
    progress_date: today,
    timezone: tz,
  };
}
