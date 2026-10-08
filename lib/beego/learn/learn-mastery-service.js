import pool from "@/lib/db";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";
import { computeMasteryFromRealData } from "@/lib/beego/learn/learn-mastery-compute";
/**
 * Recompute one skill from DB truth (attempts + mistakes).
 * @param {number} userId
 * @param {string} skillKey
 * @param {import('mysql2/promise').PoolConnection} [conn]
 */
export async function recomputeSkillMasteryForUser(userId, skillKey, conn = pool) {
  await ensureLearnMasteryTables();

  const [agg] = await conn.query(
    `SELECT
       SUM(is_correct = 1) AS correct_count,
       SUM(is_correct = 0) AS wrong_count,
       MAX(created_at) AS last_practiced_at
     FROM user_learn_exercise_attempts
     WHERE user_id = ? AND skill_key = ?`,
    [userId, skillKey]
  );
  const m = agg[0] || { correct_count: 0, wrong_count: 0, last_practiced_at: null };

  const [recent] = await conn.query(
    `SELECT is_correct, activity_stage, difficulty
     FROM user_learn_exercise_attempts
     WHERE user_id = ? AND skill_key = ?
     ORDER BY created_at DESC LIMIT 20`,
    [userId, skillKey]
  );

  const [openRows] = await conn.query(
    `SELECT COUNT(*) AS c FROM user_learn_mistakes WHERE user_id = ? AND skill_key = ? AND status = 'open'`,
    [userId, skillKey]
  );

  const computed = computeMasteryFromRealData({
    correctCount: m.correct_count,
    wrongCount: m.wrong_count,
    recentAttempts: recent,
    openMistakeCount: Number(openRows[0]?.c || 0),
    lastPracticedAt: m.last_practiced_at,
  });

  await conn.query(
    `INSERT INTO user_learn_skill_mastery
       (user_id, skill_key, correct_count, wrong_count, attempts_count, mastery_score, mastery_level, mastery_phase, accuracy_pct, last_practiced_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, NOW()))
     ON DUPLICATE KEY UPDATE
       mastery_score = VALUES(mastery_score),
       mastery_level = VALUES(mastery_level),
       mastery_phase = VALUES(mastery_phase),
       accuracy_pct = VALUES(accuracy_pct),
       updated_at = CURRENT_TIMESTAMP`,
    [
      userId,
      skillKey,
      Number(m.correct_count) || 0,
      Number(m.wrong_count) || 0,
      (Number(m.correct_count) || 0) + (Number(m.wrong_count) || 0),
      computed.mastery_score,
      computed.mastery_level,
      computed.mastery_phase,
      computed.accuracy_pct,
      m.last_practiced_at,
    ]
  );

  return computed;
}
