-- Harden Learn lesson chat: pending turns + unique turn_index per session

ALTER TABLE learn_lesson_chat_turns
  MODIFY COLUMN status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending';

-- Unique conversation order per session (ignore if already present)
-- MySQL: add index only when missing via migrate.js compatible path is limited;
-- use plain ADD and ignore duplicate in app ensure, or check information_schema in migrate.
ALTER TABLE learn_lesson_chat_turns
  ADD UNIQUE KEY uq_llct_session_turn_index (session_id, turn_index);
