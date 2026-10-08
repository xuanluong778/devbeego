-- Rollback concurrency hardening (best-effort)

ALTER TABLE learn_lesson_chat_turns DROP INDEX uq_llct_session_turn_index;

ALTER TABLE learn_lesson_chat_turns
  MODIFY COLUMN status ENUM('completed', 'failed') NOT NULL DEFAULT 'completed';
