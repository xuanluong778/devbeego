-- Per-learner Learn chat support. Not mastery, XP, Honey, or unlock.

CREATE TABLE IF NOT EXISTS learn_lesson_chat_adaptation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  support_level VARCHAR(16) NOT NULL,
  language_complexity VARCHAR(16) NOT NULL,
  communicative_goal VARCHAR(500) NOT NULL,
  evidence_json JSON NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_llca_user_lesson (user_id, lesson_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
