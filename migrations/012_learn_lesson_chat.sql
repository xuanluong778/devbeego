-- Learn-scoped lesson conversation (sessions + turns + daily usage).
-- Separate from Luyện nói `lesson_chat_logs` / pooled chat quota.

CREATE TABLE IF NOT EXISTS learn_lesson_chat_sessions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_key CHAR(36) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
  lesson_snapshot_json JSON NULL,
  turn_count INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_llcs_session_key (session_key),
  KEY idx_llcs_user_lesson_status (user_id, lesson_id, status),
  KEY idx_llcs_user_updated (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_lesson_chat_turns (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) NOT NULL,
  turn_index INT UNSIGNED NOT NULL,
  client_request_id VARCHAR(64) NOT NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'text',
  user_message TEXT NOT NULL,
  ai_reply_json JSON NULL,
  ai_reply_text TEXT NULL,
  status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed',
  error_code VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_llct_session_client_req (session_id, client_request_id),
  KEY idx_llct_session_turn (session_id, turn_index),
  KEY idx_llct_user_lesson (user_id, lesson_id, created_at),
  CONSTRAINT fk_llct_session
    FOREIGN KEY (session_id) REFERENCES learn_lesson_chat_sessions (id)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learn_lesson_chat_usage_daily (
  user_id BIGINT UNSIGNED NOT NULL,
  usage_date DATE NOT NULL,
  request_count INT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, usage_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
