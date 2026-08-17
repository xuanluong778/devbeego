import pool from "@/lib/db";
import { masteryScoreFromLevel } from "./update-srs.js";
import { defaultProgressRow as defaultSrsProgressRow } from "./srs-types.js";

let ensured = false;

const COLUMN_MIGRATIONS = [
  "ADD COLUMN mastery_score TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER mastery_level",
  "ADD COLUMN correct_count INT NOT NULL DEFAULT 0 AFTER correct_streak",
  "ADD COLUMN lapse_count INT NOT NULL DEFAULT 0 AFTER wrong_count",
  "ADD COLUMN interval_days DECIMAL(6,2) NOT NULL DEFAULT 0 AFTER next_review_at",
  "ADD COLUMN ease_factor DECIMAL(4,2) NOT NULL DEFAULT 2.50 AFTER interval_days",
  "ADD COLUMN last_answer_type VARCHAR(20) NULL AFTER ease_factor",
  "ADD COLUMN last_pronunciation_score TINYINT UNSIGNED NULL AFTER last_answer_type",
  "ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'new' AFTER last_pronunciation_score",
];

export const PROGRESS_SELECT_FIELDS = `
  word_id,
  mastery_level,
  mastery_score,
  correct_count,
  wrong_count,
  correct_streak,
  lapse_count,
  last_reviewed_at,
  next_review_at,
  interval_days,
  ease_factor,
  last_answer_type,
  last_pronunciation_score,
  status
`.trim();

async function addColumnIfMissing(sql: string): Promise<void> {
  try {
    await pool.query(`ALTER TABLE user_word_progress ${sql}`);
  } catch {
    /* column exists or insufficient privileges */
  }
}

async function backfillProgressFromLegacy(): Promise<void> {
  try {
    await pool.query(`
      UPDATE user_word_progress
      SET
        correct_count = CASE WHEN correct_count = 0 AND correct_streak > 0 THEN correct_streak ELSE correct_count END,
        mastery_score = CASE
          WHEN mastery_score = 0 AND mastery_level > 0 THEN
            CASE mastery_level
              WHEN 1 THEN 30 WHEN 2 THEN 50 WHEN 3 THEN 65 WHEN 4 THEN 85 WHEN 5 THEN 100 ELSE 10
            END
          ELSE mastery_score
        END,
        status = CASE
          WHEN status = 'new' AND last_reviewed_at IS NOT NULL THEN
            CASE
              WHEN mastery_level >= 4 THEN 'mastered'
              WHEN wrong_count >= 2 THEN 'weak'
              WHEN next_review_at IS NOT NULL AND next_review_at <= NOW() THEN 'review'
              ELSE 'learning'
            END
          ELSE status
        END
      WHERE last_reviewed_at IS NOT NULL OR mastery_level > 0 OR wrong_count > 0
    `);
  } catch {
    /* backfill optional */
  }
}

export async function ensureUserWordProgressTable(): Promise<void> {
  if (ensured) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_word_progress (
      user_id BIGINT UNSIGNED NOT NULL,
      word_id BIGINT UNSIGNED NOT NULL,
      mastery_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
      last_reviewed_at DATETIME NULL,
      next_review_at DATETIME NULL,
      correct_streak INT NOT NULL DEFAULT 0,
      wrong_count INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, word_id),
      CONSTRAINT fk_user_word_progress_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_user_word_progress_word FOREIGN KEY (word_id) REFERENCES vocabulary(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      INDEX idx_user_word_progress_next (user_id, next_review_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  for (const migration of COLUMN_MIGRATIONS) {
    await addColumnIfMissing(migration);
  }

  try {
    await pool.query(
      "CREATE INDEX idx_user_word_progress_status ON user_word_progress (user_id, status)"
    );
  } catch {
    /* exists */
  }

  await backfillProgressFromLegacy();
  ensured = true;
}

export function defaultProgressRow() {
  return defaultSrsProgressRow();
}

export function normalizeProgressRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return defaultProgressRow();
  const level = Number(row.mastery_level ?? 0);
  return {
    mastery_level: level,
    mastery_score: Number(row.mastery_score ?? masteryScoreFromLevel(level)),
    correct_count: Number(row.correct_count ?? row.correct_streak ?? 0),
    wrong_count: Number(row.wrong_count ?? 0),
    correct_streak: Number(row.correct_streak ?? 0),
    lapse_count: Number(row.lapse_count ?? 0),
    interval_days: Number(row.interval_days ?? 0),
    ease_factor: Number(row.ease_factor ?? 2.5),
    status: String(row.status || "new"),
    last_answer_type: row.last_answer_type ? String(row.last_answer_type) : null,
    last_pronunciation_score:
      row.last_pronunciation_score != null ? Number(row.last_pronunciation_score) : null,
    last_reviewed_at: row.last_reviewed_at ?? null,
    next_review_at: row.next_review_at ?? null,
  };
}
