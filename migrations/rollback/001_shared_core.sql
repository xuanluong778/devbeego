-- Rollback P0 — only safe when no production progress depends on these tables.
-- Prefer: leave tables in place. Destructive rollback for staging only.

-- DROP TABLE IF EXISTS payments;
-- DROP TABLE IF EXISTS ai_usage_daily;
-- DROP TABLE IF EXISTS subscriptions;
-- DROP TABLE IF EXISTS user_review_events;
-- DROP TABLE IF EXISTS user_lesson_progress;
-- DROP TABLE IF EXISTS user_stats;
DELETE FROM schema_migrations WHERE version = '001_shared_core';
