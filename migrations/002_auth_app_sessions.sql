-- P1 Auth for Web + Android (additive)

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS platform VARCHAR(32) NOT NULL DEFAULT 'web'
    COMMENT 'web|android|ios';

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS device_id VARCHAR(128) NULL;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS refresh_token_hash VARCHAR(128) NULL;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS revoked_at DATETIME NULL;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS last_seen_at DATETIME NULL;

ALTER TABLE user_sessions
  ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512) NULL;

CREATE TABLE IF NOT EXISTS oauth_app_links (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  provider VARCHAR(32) NOT NULL DEFAULT 'google',
  state_hash VARCHAR(128) NOT NULL,
  redirect_uri VARCHAR(512) NOT NULL,
  platform VARCHAR(32) NOT NULL DEFAULT 'android',
  expires_at DATETIME NOT NULL,
  used_at DATETIME NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_oauth_state (state_hash),
  KEY idx_oauth_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
