import pool from "@/lib/db";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";
import { recomputeSkillMasteryForUser } from "@/lib/beego/learn/learn-mastery-service";
import { resolveLearnSkillKey } from "@/lib/beego/learn/learn-skill-keys";
import { progressionTierFromPhase } from "@/lib/beego/learn/learn-mastery-phases";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";

let progressionSchemaReady = false;

export async function ensureSmartProgressionTables() {
  await ensureLearnMasteryTables();
  if (progressionSchemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_smart_progression (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      progression_tier ENUM('weak', 'medium', 'strong') NOT NULL DEFAULT 'medium',
      recovery_priority TINYINT UNSIGNED NOT NULL DEFAULT 50,
      challenge_priority TINYINT UNSIGNED NOT NULL DEFAULT 50,
      primary_skill_key VARCHAR(32) NULL,
      last_lesson_id VARCHAR(64) NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_mastery_rollup_events (
      event_key VARCHAR(128) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ulmre_user (user_id)
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
      /* column exists */
    }
  }
  progressionSchemaReady = true;
}

/**
 * Idempotent mastery rollup + smart progression after lesson complete (no unlock change).
 * @param {number} userId
 * @param {string} lessonId
 * @param {string} [lessonType]
 */
export async function applySmartProgressionAfterLessonComplete(userId, lessonId, lessonType = "") {
  await ensureSmartProgressionTables();
  const id = String(lessonId || "").trim();
  const eventKey = `complete_rollup:${userId}:${id}`.slice(0, 128);

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [ins] = await conn.query(
      `INSERT IGNORE INTO user_learn_mastery_rollup_events (event_key, user_id, lesson_id) VALUES (?, ?, ?)`,
      [eventKey, userId, id]
    );
    if (!ins?.affectedRows) {
      await conn.commit();
      return { rolled_up: false, duplicate: true };
    }

    const lesson = getLessonContentById(id);
    const lt = lessonType || lesson?.type || "";
    const primarySkill = resolveLearnSkillKey(lt, lesson?.questions?.[0]?.type || "", "");

    const [skillRows] = await conn.query(
      `SELECT DISTINCT skill_key FROM user_learn_exercise_attempts WHERE user_id = ? AND lesson_id = ?`,
      [userId, id]
    );
    const skills = skillRows.length ? skillRows.map((r) => String(r.skill_key)) : [primarySkill];

    for (const sk of skills) {
      await recomputeSkillMasteryForUser(userId, sk, conn);
    }

    const [mRow] = await conn.query(
      `SELECT mastery_phase, mastery_score FROM user_learn_skill_mastery WHERE user_id = ? AND skill_key = ? LIMIT 1`,
      [userId, primarySkill]
    );
    const [openRows] = await conn.query(
      `SELECT COUNT(*) AS c FROM user_learn_mistakes WHERE user_id = ? AND skill_key = ? AND status = 'open'`,
      [userId, primarySkill]
    );
    const openCount = Number(openRows[0]?.c || 0);
    const phase = mRow[0]?.mastery_phase || "NEW";
    const tier = progressionTierFromPhase(phase, openCount);

    let recoveryPriority = 50;
    let challengePriority = 50;
    if (tier === "weak") {
      recoveryPriority = 85;
      challengePriority = 25;
    } else if (tier === "strong") {
      recoveryPriority = 20;
      challengePriority = 80;
    }

    await conn.query(
      `INSERT INTO user_learn_smart_progression
         (user_id, progression_tier, recovery_priority, challenge_priority, primary_skill_key, last_lesson_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         progression_tier = VALUES(progression_tier),
         recovery_priority = VALUES(recovery_priority),
         challenge_priority = VALUES(challenge_priority),
         primary_skill_key = VALUES(primary_skill_key),
         last_lesson_id = VALUES(last_lesson_id),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tier, recoveryPriority, challengePriority, primarySkill, id]
    );

    await conn.commit();
    return {
      rolled_up: true,
      duplicate: false,
      progression_tier: tier,
      primary_skill_key: primarySkill,
      mastery_phase: phase,
      recovery_priority: recoveryPriority,
      challenge_priority: challengePriority,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Single round-trip context for adaptive mix (avoids N+1).
 * @param {number} userId
 * @param {string} lessonId
 * @param {string} lessonType
 */
export async function getMasteryContextForLesson(userId, lessonId, lessonType) {
  await ensureSmartProgressionTables();
  const primarySkill = resolveLearnSkillKey(lessonType, "", "");

  const [skillRows, openRows, progRows] = await Promise.all([
    pool.query(
      `SELECT skill_key, mastery_score, mastery_phase, accuracy_pct, correct_count, wrong_count, attempts_count, last_practiced_at
       FROM user_learn_skill_mastery WHERE user_id = ?`,
      [userId]
    ),
    pool.query(
      `SELECT lesson_id, question_id, skill_key, status, wrong_count
       FROM user_learn_mistakes
       WHERE user_id = ? AND status = 'open'
         AND (lesson_id = ? OR skill_key = ?)
       ORDER BY wrong_count DESC LIMIT 8`,
      [userId, lessonId, primarySkill]
    ),
    pool.query(
      `SELECT progression_tier, recovery_priority, challenge_priority, primary_skill_key
       FROM user_learn_smart_progression WHERE user_id = ? LIMIT 1`,
      [userId]
    ),
  ]);

  const masteryBySkill = new Map();
  const phaseBySkill = new Map();
  for (const s of skillRows[0] || []) {
    masteryBySkill.set(String(s.skill_key), Number(s.mastery_score));
    phaseBySkill.set(String(s.skill_key), String(s.mastery_phase || "NEW"));
  }

  return {
    masteryBySkill,
    phaseBySkill,
    openMistakes: openRows[0] || [],
    smartProgression: progRows[0]?.[0] || null,
    primarySkill,
  };
}
