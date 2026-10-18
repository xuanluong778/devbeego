-- Rollback 015: learn_assessment_session_and_archived_status
-- Ensures backward compatibility:
-- 1. Does NOT delete or truncate historical mistake data.
-- 2. Preserves archived status or keeps ENUM readable by old code.
-- 3. Removes migration record from schema_migrations.

DELETE FROM schema_migrations WHERE version = '015_learn_assessment_session_and_archived_status';
