-- Phase 4: Learn tab mastery + mistakes (additive, separate from SRS user_word_progress)

CREATE TABLE IF NOT EXISTS user_learn_exercise_attempts (
  attempt_key VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(128) NOT NULL,
  skill_key VARCHAR(32) NOT NULL,
  exercise_type VARCHAR(64) NOT NULL,
  is_correct TINYINT(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ulea_user_lesson (user_id, lesson_id),
  KEY idx_ulea_user_skill (user_id, skill_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learn_skill_mastery (
  user_id BIGINT UNSIGNED NOT NULL,
  skill_key VARCHAR(32) NOT NULL,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  attempts_count INT UNSIGNED NOT NULL DEFAULT 0,
  mastery_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  mastery_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
  last_practiced_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, skill_key),
  KEY idx_ulsm_user_score (user_id, mastery_score)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learn_mistakes (
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(128) NOT NULL,
  skill_key VARCHAR(32) NOT NULL,
  exercise_type VARCHAR(64) NOT NULL,
  status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
  wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
  correct_recovery_count INT UNSIGNED NOT NULL DEFAULT 0,
  last_wrong_at DATETIME NULL,
  last_correct_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, lesson_id, question_id),
  KEY idx_ulm_user_skill_open (user_id, skill_key, status),
  KEY idx_ulm_user_open (user_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
