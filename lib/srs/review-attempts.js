import pool from "@/lib/db";
import crypto from "node:crypto";

let ready = false;

export async function ensureReviewAttemptsTable() {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_review_attempts (
      attempt_id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      word_id BIGINT UNSIGNED NOT NULL,
      expires_at DATETIME NOT NULL,
      used_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ura_user_word (user_id, word_id),
      KEY idx_ura_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ready = true;
}

export async function issueReviewAttempt(userId, wordId, ttlMinutes = 30) {
  await ensureReviewAttemptsTable();
  const attemptId = crypto.randomBytes(24).toString("hex");
  const expires = new Date(Date.now() + ttlMinutes * 60 * 1000);
  await pool.query(
    `INSERT INTO user_review_attempts (attempt_id, user_id, word_id, expires_at)
     VALUES (?, ?, ?, ?)`,
    [attemptId, userId, wordId, expires]
  );
  return { attempt_id: attemptId, expires_at: expires.toISOString() };
}

/**
 * @returns {Promise<'ok'|'missing'|'expired'|'used'|'word_mismatch'>}
 */
export async function consumeReviewAttempt(userId, wordId, attemptId, conn = pool) {
  await ensureReviewAttemptsTable();
  const [rows] = await conn.query(
    `SELECT attempt_id, word_id, expires_at, used_at
     FROM user_review_attempts
     WHERE attempt_id = ? AND user_id = ?
     LIMIT 1
     FOR UPDATE`,
    [attemptId, userId]
  );
  const row = rows?.[0];
  if (!row) return "missing";
  if (row.used_at) return "used";
  if (Number(row.word_id) !== Number(wordId)) return "word_mismatch";
  if (new Date(row.expires_at).getTime() < Date.now()) return "expired";
  await conn.query(`UPDATE user_review_attempts SET used_at = NOW() WHERE attempt_id = ?`, [attemptId]);
  return "ok";
}
