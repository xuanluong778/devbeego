-- Phase 7: mastery phases + smart progression (additive)

ALTER TABLE user_learn_skill_mastery
  ADD COLUMN IF NOT EXISTS mastery_phase VARCHAR(16) NOT NULL DEFAULT 'NEW' AFTER mastery_level;

ALTER TABLE user_learn_skill_mastery
  ADD COLUMN IF NOT EXISTS accuracy_pct DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER mastery_phase;

ALTER TABLE user_learn_exercise_attempts
  ADD COLUMN IF NOT EXISTS activity_stage VARCHAR(32) NULL AFTER exercise_type;

ALTER TABLE user_learn_exercise_attempts
  ADD COLUMN IF NOT EXISTS difficulty VARCHAR(16) NULL AFTER activity_stage;

CREATE TABLE IF NOT EXISTS user_learn_smart_progression (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  progression_tier ENUM('weak', 'medium', 'strong') NOT NULL DEFAULT 'medium',
  recovery_priority TINYINT UNSIGNED NOT NULL DEFAULT 50,
  challenge_priority TINYINT UNSIGNED NOT NULL DEFAULT 50,
  primary_skill_key VARCHAR(32) NULL,
  last_lesson_id VARCHAR(64) NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learn_mastery_rollup_events (
  event_key VARCHAR(128) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_ulmre_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
