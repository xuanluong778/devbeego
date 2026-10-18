import pool from "@/lib/db";

let ensured = false;

export async function ensureUserStatsTables() {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_stats (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      xp_total INT NOT NULL DEFAULT 0,
      current_streak INT NOT NULL DEFAULT 0,
      best_streak INT NOT NULL DEFAULT 0,
      last_active_date DATE NULL,
      last_answer_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_user_stats_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await pool.query("ALTER TABLE user_stats ADD COLUMN last_active_date DATE NULL AFTER best_streak");
  } catch (_e) {
    /* ignore */
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_review_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      attempt_id VARCHAR(128) NOT NULL,
      word_id BIGINT UNSIGNED NOT NULL,
      is_correct TINYINT(1) NOT NULL,
      xp_delta INT NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_review_events_attempt (user_id, attempt_id),
      INDEX idx_user_review_events_user_created (user_id, created_at),
      CONSTRAINT fk_user_review_events_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_user_review_events_word FOREIGN KEY (word_id) REFERENCES vocabulary(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_events (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      attempt_id VARCHAR(128) NULL,
      event_type VARCHAR(64) NOT NULL,
      word_id BIGINT UNSIGNED NULL,
      is_correct TINYINT(1) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_user_events_attempt (user_id, attempt_id, event_type),
      INDEX idx_user_events_user_created (user_id, created_at),
      INDEX idx_user_events_user_type_created (user_id, event_type, created_at),
      CONSTRAINT fk_user_events_user FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE CASCADE ON UPDATE CASCADE,
      CONSTRAINT fk_user_events_word FOREIGN KEY (word_id) REFERENCES vocabulary(id)
        ON DELETE CASCADE ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  ensured = true;
}
