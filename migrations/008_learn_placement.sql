-- Phase 9: Adaptive Placement Test (additive)

CREATE TABLE IF NOT EXISTS learn_placement_sessions (
  session_id VARCHAR(64) NOT NULL PRIMARY KEY,
  user_id BIGINT UNSIGNED NULL,
  status ENUM('active', 'completed', 'abandoned') NOT NULL DEFAULT 'active',
  ability_score DECIMAL(8,3) NOT NULL DEFAULT 0,
  difficulty_level TINYINT UNSIGNED NOT NULL DEFAULT 2,
  asked_count INT UNSIGNED NOT NULL DEFAULT 0,
  correct_count INT UNSIGNED NOT NULL DEFAULT 0,
  current_item_json JSON NULL,
  asked_refs_json JSON NULL,
  skill_stats_json JSON NULL,
  guest_token VARCHAR(64) NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_lps_user (user_id),
  KEY idx_lps_guest (guest_token),
  KEY idx_lps_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_placement_answers (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  answer_key VARCHAR(64) NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  question_id VARCHAR(128) NOT NULL,
  skill_key VARCHAR(32) NOT NULL,
  difficulty_level TINYINT UNSIGNED NOT NULL,
  is_correct TINYINT(1) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_lpa_answer_key (answer_key),
  KEY idx_lpa_session (session_id),
  CONSTRAINT fk_lpa_session FOREIGN KEY (session_id) REFERENCES learn_placement_sessions(session_id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learn_placement_results (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  session_id VARCHAR(64) NOT NULL,
  placement_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  estimated_level VARCHAR(16) NOT NULL DEFAULT 'A0',
  strengths_json JSON NULL,
  weak_skills_json JSON NULL,
  confidence DECIMAL(5,3) NOT NULL DEFAULT 0,
  recommended_lesson_id VARCHAR(64) NOT NULL,
  start_choice ENUM('recommended', 'from_start', 'skipped') NULL,
  placement_start_lesson_id VARCHAR(64) NULL,
  completed_at DATETIME NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ulpr_lesson (recommended_lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

ALTER TABLE user_stats
  ADD COLUMN IF NOT EXISTS placement_start_lesson_id VARCHAR(64) NULL AFTER active_lesson_id;
