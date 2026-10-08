-- Phase 11: Learning Analytics & Progress Insights cache (additive)

CREATE TABLE IF NOT EXISTS user_learn_analytics_cache (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  payload_json JSON NOT NULL,
  input_fingerprint CHAR(64) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_ulac_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
