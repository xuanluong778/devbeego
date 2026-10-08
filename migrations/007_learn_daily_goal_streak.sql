-- Phase 8: Daily Goal + Streak motivation (additive)

CREATE TABLE IF NOT EXISTS user_learn_daily_settings (
  user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
  daily_goal_xp INT UNSIGNED NOT NULL DEFAULT 30,
  timezone VARCHAR(64) NOT NULL DEFAULT 'Asia/Ho_Chi_Minh',
  streak_freeze_ready TINYINT UNSIGNED NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_learn_daily_progress (
  user_id BIGINT UNSIGNED NOT NULL,
  progress_date DATE NOT NULL,
  goal_xp INT UNSIGNED NOT NULL DEFAULT 30,
  xp_earned INT UNSIGNED NOT NULL DEFAULT 0,
  lessons_completed INT UNSIGNED NOT NULL DEFAULT 0,
  goal_completed_at DATETIME NULL,
  streak_applied TINYINT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, progress_date),
  KEY idx_uldp_user_completed (user_id, goal_completed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
