-- Migration 015: Assessment Session Isolation & Mistake Archived Status
-- Purpose:
-- 1. Support server-side session isolation for gate checkpoints (n08/n15)
-- 2. Formalize ENUM status ('open', 'resolved', 'archived') in user_learn_mistakes
-- 3. Add content_revision tracking to user_learn_mistakes to disambiguate legacy question IDs (a01-a08)
-- 4. Safely archive legacy mistakes without deleting history

-- Step 1: Formalize ENUM status with 'archived' in user_learn_mistakes (idempotent)
ALTER TABLE user_learn_mistakes MODIFY COLUMN status ENUM('open', 'resolved', 'archived') NOT NULL DEFAULT 'open';

-- Step 2: Add content_revision to user_learn_mistakes if not exists
ALTER TABLE user_learn_mistakes ADD COLUMN IF NOT EXISTS content_revision VARCHAR(32) NULL AFTER question_id;

-- Step 3: Add assessment_session_id to user_learn_exercise_attempts if not exists
ALTER TABLE user_learn_exercise_attempts ADD COLUMN IF NOT EXISTS assessment_session_id VARCHAR(64) NULL AFTER content_revision;

-- Step 4: Add index for session lookups on user_learn_exercise_attempts
-- (Using query-based execution in migrate runner)

-- Step 5: Safely archive legacy Part 1 mistakes that were recorded under previous revisions (p1g1-r3 or NULL)
-- This ensures learners are not tested on altered questions (a01-a08) as if they were fixing old mistakes.
UPDATE user_learn_mistakes
SET status = 'archived'
WHERE lesson_id LIKE 'p1-g1-%'
  AND (content_revision IS NULL OR content_revision != 'p1g1-r4')
  AND status = 'open';
