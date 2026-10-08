/**
 * Learn-only daily quota — never touches pooled Luyện nói usage.
 *
 * DAILY_LIMIT counts successful AI turns that were reserved.
 * - Reserve atomically before calling AI.
 * - Refund on AI timeout/failure (no completed turn).
 * - Idempotent replay of completed client_request_id does not reserve again.
 */

import pool from "@/lib/db";
import { getLearnLessonChatDailyLimit } from "@/lib/beego/learn/learn-lesson-chat-flags";
import { DEFAULT_LEARN_TIMEZONE, ymdInTimezone } from "@/lib/beego/learn/learn-daily-timezone";

let schemaReady = false;

export async function ensureLearnLessonChatUsageTable() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_lesson_chat_usage_daily (
      user_id BIGINT UNSIGNED NOT NULL,
      usage_date DATE NOT NULL,
      request_count INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, usage_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

export function getLearnLessonChatUsageDate() {
  return ymdInTimezone(new Date(), DEFAULT_LEARN_TIMEZONE);
}

/**
 * Read-only snapshot (for GET responses).
 */
export async function assertLearnLessonChatQuota(userId) {
  await ensureLearnLessonChatUsageTable();
  const dailyLimit = getLearnLessonChatDailyLimit();
  const usageDate = getLearnLessonChatUsageDate();

  if (dailyLimit <= 0) {
    return {
      ok: false,
      status: 403,
      code: "LEARN_CHAT_QUOTA_DISABLED",
      message: "Learn lesson chat daily limit is 0.",
      usageToday: 0,
      dailyLimit,
      usageDate,
    };
  }

  const [rows] = await pool.query(
    `SELECT request_count FROM learn_lesson_chat_usage_daily
     WHERE user_id = ? AND usage_date = ? LIMIT 1`,
    [userId, usageDate]
  );
  const usageToday = Number(rows[0]?.request_count || 0);

  if (usageToday >= dailyLimit) {
    return {
      ok: false,
      status: 429,
      code: "LEARN_CHAT_DAILY_LIMIT",
      message: "Daily Learn conversation limit reached. Try again tomorrow.",
      usageToday,
      dailyLimit,
      usageDate,
    };
  }

  return { ok: true, usageToday, dailyLimit, usageDate };
}

/**
 * Atomically reserve one daily slot. Safe under concurrency.
 * @returns {{ ok: true, usageToday: number, dailyLimit: number, usageDate: string } | { ok: false, ... }}
 */
export async function tryReserveLearnLessonChatQuota(userId) {
  await ensureLearnLessonChatUsageTable();
  const dailyLimit = getLearnLessonChatDailyLimit();
  const usageDate = getLearnLessonChatUsageDate();

  if (dailyLimit <= 0) {
    return {
      ok: false,
      status: 403,
      code: "LEARN_CHAT_QUOTA_DISABLED",
      message: "Learn lesson chat daily limit is 0.",
      usageToday: 0,
      dailyLimit,
      usageDate,
    };
  }

  // Ensure row exists
  await pool.query(
    `INSERT IGNORE INTO learn_lesson_chat_usage_daily (user_id, usage_date, request_count)
     VALUES (?, ?, 0)`,
    [userId, usageDate]
  );

  const [result] = await pool.query(
    `UPDATE learn_lesson_chat_usage_daily
     SET request_count = request_count + 1
     WHERE user_id = ? AND usage_date = ? AND request_count < ?`,
    [userId, usageDate, dailyLimit]
  );

  if (!result.affectedRows) {
    const [rows] = await pool.query(
      `SELECT request_count FROM learn_lesson_chat_usage_daily
       WHERE user_id = ? AND usage_date = ? LIMIT 1`,
      [userId, usageDate]
    );
    return {
      ok: false,
      status: 429,
      code: "LEARN_CHAT_DAILY_LIMIT",
      message: "Daily Learn conversation limit reached. Try again tomorrow.",
      usageToday: Number(rows[0]?.request_count || dailyLimit),
      dailyLimit,
      usageDate,
    };
  }

  const [rows] = await pool.query(
    `SELECT request_count FROM learn_lesson_chat_usage_daily
     WHERE user_id = ? AND usage_date = ? LIMIT 1`,
    [userId, usageDate]
  );

  return {
    ok: true,
    usageToday: Number(rows[0]?.request_count || 0),
    dailyLimit,
    usageDate,
  };
}

/**
 * Refund one reserved slot after AI timeout/failure (no completed turn).
 */
export async function refundLearnLessonChatQuota(userId, usageDate) {
  await ensureLearnLessonChatUsageTable();
  const day = usageDate || getLearnLessonChatUsageDate();
  await pool.query(
    `UPDATE learn_lesson_chat_usage_daily
     SET request_count = IF(request_count > 0, request_count - 1, 0)
     WHERE user_id = ? AND usage_date = ?`,
    [userId, day]
  );
}

/** @deprecated use tryReserveLearnLessonChatQuota — kept for older call sites */
export async function recordLearnLessonChatUsageSuccess(userId, usageDate) {
  await ensureLearnLessonChatUsageTable();
  await pool.query(
    `INSERT INTO learn_lesson_chat_usage_daily (user_id, usage_date, request_count)
     VALUES (?, ?, 1)
     ON DUPLICATE KEY UPDATE request_count = request_count + 1`,
    [userId, usageDate]
  );
}
