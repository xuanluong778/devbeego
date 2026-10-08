-- Rollback Phase 4 learn mastery (drops new tables only; no Phase 1–3 data touched)

DROP TABLE IF EXISTS user_learn_exercise_attempts;
DROP TABLE IF EXISTS user_learn_mistakes;
DROP TABLE IF EXISTS user_learn_skill_mastery;
