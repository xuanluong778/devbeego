-- Phase 6: stable adaptive lesson mix per user+lesson (additive)

CREATE TABLE IF NOT EXISTS user_learn_lesson_mix_session (
  mix_id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  mix_fingerprint VARCHAR(128) NOT NULL,
  questions_json JSON NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uq_ulms_user_lesson (user_id, lesson_id),
  KEY idx_ulms_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
