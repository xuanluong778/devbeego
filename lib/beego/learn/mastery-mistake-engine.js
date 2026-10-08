import pool from "@/lib/db";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";

let schemaReady = false;

export async function ensureLearnMasteryTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_exercise_attempts (
      attempt_key VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      question_id VARCHAR(128) NOT NULL,
      skill_key VARCHAR(32) NOT NULL,
      exercise_type VARCHAR(64) NOT NULL,
      is_correct TINYINT(1) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ulea_user_lesson (user_id, lesson_id),
      KEY idx_ulea_user_skill (user_id, skill_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_skill_mastery (
      user_id BIGINT UNSIGNED NOT NULL,
      skill_key VARCHAR(32) NOT NULL,
      correct_count INT UNSIGNED NOT NULL DEFAULT 0,
      wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
      attempts_count INT UNSIGNED NOT NULL DEFAULT 0,
      mastery_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      mastery_level TINYINT UNSIGNED NOT NULL DEFAULT 0,
      last_practiced_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, skill_key),
      KEY idx_ulsm_user_score (user_id, mastery_score)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_mistakes (
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      question_id VARCHAR(128) NOT NULL,
      skill_key VARCHAR(32) NOT NULL,
      exercise_type VARCHAR(64) NOT NULL,
      status ENUM('open', 'resolved') NOT NULL DEFAULT 'open',
      wrong_count INT UNSIGNED NOT NULL DEFAULT 0,
      correct_recovery_count INT UNSIGNED NOT NULL DEFAULT 0,
      last_wrong_at DATETIME NULL,
      last_correct_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id, question_id),
      KEY idx_ulm_user_skill_open (user_id, skill_key, status),
      KEY idx_ulm_user_open (user_id, status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const sql of [
    "ALTER TABLE user_learn_skill_mastery ADD COLUMN mastery_phase VARCHAR(16) NOT NULL DEFAULT 'NEW' AFTER mastery_level",
    "ALTER TABLE user_learn_skill_mastery ADD COLUMN accuracy_pct DECIMAL(5,2) NOT NULL DEFAULT 0 AFTER mastery_phase",
    "ALTER TABLE user_learn_exercise_attempts ADD COLUMN activity_stage VARCHAR(32) NULL AFTER exercise_type",
    "ALTER TABLE user_learn_exercise_attempts ADD COLUMN difficulty VARCHAR(16) NULL AFTER activity_stage",
  ]) {
    try {
      await pool.query(sql);
    } catch {
      /* exists */
    }
  }
  schemaReady = true;
}

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/**
 * @param {number} userId
 * @param {{
 *   attemptKey: string,
 *   lessonId: string,
 *   questionId: string,
 *   lessonType: string,
 *   exerciseType: string,
 *   skillLabel?: string,
 *   isCorrect: boolean,
 *   activityStage?: string,
 *   difficulty?: string,
 * }} input
 */
export async function recordLearnExerciseResult(userId, input) {
  await ensureLearnMasteryTables();

  const attemptKey = String(input.attemptKey || "").trim().slice(0, 64);
  const lessonId = String(input.lessonId || "").trim();
  const questionId = String(input.questionId || "").trim().slice(0, 128);
  if (!attemptKey || !lessonId || !questionId) {
    const err = new Error("attempt_key, lesson_id, question_id required");
    err.code = "INVALID_INPUT";
    throw err;
  }

  const exerciseType = String(input.exerciseType || "unknown").slice(0, 64);
  const skillKey = resolveLearnSkillKey(input.lessonType, exerciseType, input.skillLabel);
  const isCorrect = Boolean(input.isCorrect);
  const activityStage = String(input.activityStage || input.activity_stage || "").slice(0, 32) || null;
  const difficulty = String(input.difficulty || "").slice(0, 16) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [existingQuestion] = await conn.query(
      `SELECT attempt_key, is_correct, skill_key
       FROM user_learn_exercise_attempts
       WHERE user_id = ? AND lesson_id = ? AND question_id = ?
       LIMIT 1`,
      [userId, lessonId, questionId]
    );
    if (existingQuestion[0]) {
      await conn.commit();
      return {
        recorded: false,
        duplicate: true,
        skill_key: existingQuestion[0].skill_key || skillKey,
        is_correct: Boolean(existingQuestion[0].is_correct),
      };
    }

    const [ins] = await conn.query(
      `INSERT IGNORE INTO user_learn_exercise_attempts
         (attempt_key, user_id, lesson_id, question_id, skill_key, exercise_type, activity_stage, difficulty, is_correct)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attemptKey,
        userId,
        lessonId,
        questionId,
        skillKey,
        exerciseType,
        activityStage,
        difficulty,
        isCorrect ? 1 : 0,
      ]
    );

    if (!ins || ins.affectedRows === 0) {
      const [prev] = await conn.query(
        `SELECT is_correct, skill_key FROM user_learn_exercise_attempts
         WHERE attempt_key = ? AND user_id = ? LIMIT 1`,
        [attemptKey, userId]
      );
      await conn.commit();
      return {
        recorded: false,
        duplicate: true,
        skill_key: prev[0]?.skill_key || skillKey,
        is_correct: Boolean(prev[0]?.is_correct),
      };
    }

    const { recomputeSkillMasteryForUser } = await import("@/lib/beego/learn/learn-mastery-service");
    const computed = await recomputeSkillMasteryForUser(userId, skillKey, conn);
    const [agg] = await conn.query(
      `SELECT SUM(is_correct = 1) AS c, SUM(is_correct = 0) AS w FROM user_learn_exercise_attempts
       WHERE user_id = ? AND skill_key = ?`,
      [userId, skillKey]
    );
    const correctCount = Number(agg[0]?.c || 0);
    const wrongCount = Number(agg[0]?.w || 0);

    await conn.query(
      `INSERT INTO user_learn_skill_mastery
         (user_id, skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level, mastery_phase, accuracy_pct, last_practiced_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         correct_count = VALUES(correct_count),
         wrong_count = VALUES(wrong_count),
         attempts_count = VALUES(attempts_count),
         mastery_score = VALUES(mastery_score),
         mastery_level = VALUES(mastery_level),
         mastery_phase = VALUES(mastery_phase),
         accuracy_pct = VALUES(accuracy_pct),
         last_practiced_at = NOW(),
         updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        skillKey,
        correctCount,
        wrongCount,
        correctCount + wrongCount,
        computed.mastery_score,
        computed.mastery_level,
        computed.mastery_phase,
        computed.accuracy_pct,
      ]
    );

    if (!isCorrect) {
      await conn.query(
        `INSERT INTO user_learn_mistakes
           (user_id, lesson_id, question_id, skill_key, exercise_type, status, wrong_count, last_wrong_at)
         VALUES (?, ?, ?, ?, ?, 'open', 1, NOW())
         ON DUPLICATE KEY UPDATE
           skill_key = VALUES(skill_key),
           exercise_type = VALUES(exercise_type),
           status = 'open',
           wrong_count = wrong_count + 1,
           last_wrong_at = NOW(),
           updated_at = CURRENT_TIMESTAMP`,
        [userId, lessonId, questionId, skillKey, exerciseType]
      );
    } else {
      await conn.query(
        `INSERT INTO user_learn_mistakes
           (user_id, lesson_id, question_id, skill_key, exercise_type, status, correct_recovery_count, last_correct_at)
         VALUES (?, ?, ?, ?, ?, 'resolved', 1, NOW())
         ON DUPLICATE KEY UPDATE
           skill_key = VALUES(skill_key),
           exercise_type = VALUES(exercise_type),
           correct_recovery_count = correct_recovery_count + 1,
           last_correct_at = NOW(),
           status = IF(status = 'open', 'resolved', status),
           updated_at = CURRENT_TIMESTAMP`,
        [userId, lessonId, questionId, skillKey, exerciseType]
      );
    }

    await conn.commit();

    return {
      recorded: true,
      duplicate: false,
      skill_key: skillKey,
      mastery_score: computed.mastery_score,
      mastery_level: computed.mastery_level,
      mastery_phase: computed.mastery_phase,
      accuracy_pct: computed.accuracy_pct,
      is_correct: isCorrect,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * @param {number} userId
 */
export async function getLearnMasterySnapshot(userId) {
  await ensureLearnMasteryTables();
  const [skills] = await pool.query(
    `SELECT skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level,
            mastery_phase, accuracy_pct, last_practiced_at
     FROM user_learn_skill_mastery WHERE user_id = ? ORDER BY skill_key`,
    [userId]
  );
  const [mistakes] = await pool.query(
    `SELECT lesson_id, question_id, skill_key, exercise_type, status, wrong_count, last_wrong_at, last_correct_at
     FROM user_learn_mistakes WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50`,
    [userId]
  );
  const weak = [...skills].sort(
    (a, b) => Number(a.mastery_score) - Number(b.mastery_score)
  );
  return { skills, mistakes, weak_skills: weak.slice(0, 6) };
}

/** Question ids already submitted for one lesson. Does not create attempts. */
export async function listLessonAttemptRows(userId, lessonId) {
  await ensureLearnMasteryTables();
  const [rows] = await pool.query(
    `SELECT question_id, is_correct
     FROM user_learn_exercise_attempts
     WHERE user_id = ? AND lesson_id = ?`,
    [userId, String(lessonId || "")]
  );
  return rows || [];
}
