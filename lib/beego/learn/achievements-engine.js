/**
 * Phase 12 — Achievements engine.
 * Deterministic + idempotent unlocks from Phase 1–11 aggregates.
 * Does NOT award XP/Honey or mutate mastery/progression/SRS/streak.
 */
import crypto from "node:crypto";
import pool from "@/lib/db";
import { ACHIEVEMENT_CATALOG, ACHIEVEMENT_BY_KEY } from "@/lib/beego/learn/achievement-catalog";
import { getLearnDailyMotivation } from "@/lib/beego/learn/daily-goal-streak-engine";
import { ensureLearnMasteryTables } from "@/lib/beego/learn/mastery-mistake-engine";

const CACHE_TTL_SEC = 45;
const STRONG_MASTERY = 75;
const PERFECT_SCORE = 95;

let schemaReady = false;

export async function ensureAchievementTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_achievements (
      user_id BIGINT UNSIGNED NOT NULL,
      achievement_key VARCHAR(64) NOT NULL,
      unlocked_at DATETIME NOT NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, achievement_key),
      KEY idx_ula_unlocked (user_id, unlocked_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_achievements_cache (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      payload_json JSON NOT NULL,
      input_fingerprint CHAR(64) NOT NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ulac2_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

/**
 * @param {number} userId
 */
export async function invalidateAchievementsCache(userId) {
  if (!userId) return;
  try {
    await ensureAchievementTables();
    await pool.query(`DELETE FROM user_learn_achievements_cache WHERE user_id = ?`, [userId]);
  } catch {
    /* non-blocking */
  }
}

function fingerprint(obj) {
  return crypto.createHash("sha256").update(JSON.stringify(obj)).digest("hex");
}

/**
 * Batch aggregate metrics (no N+1 over history rows beyond grouped counts).
 * @param {number} userId
 */
export async function loadAchievementMetrics(userId) {
  await ensureLearnMasteryTables();
  await ensureAchievementTables();

  const [
    lessonRes,
    perfectRes,
    statsRes,
    daily,
    dailyGoalRes,
    srsRes,
    masteryRes,
    placementRes,
    resolvedRes,
  ] = await Promise.all([
    pool.query(
      `SELECT COUNT(*) AS c FROM user_lesson_progress
       WHERE user_id = ? AND status = 'completed'`,
      [userId]
    ),
    pool.query(
      `SELECT COUNT(*) AS c FROM user_lesson_progress
       WHERE user_id = ? AND status = 'completed' AND score IS NOT NULL AND score >= ?`,
      [userId, PERFECT_SCORE]
    ),
    pool.query(
      `SELECT xp_total, honey_total, current_streak, best_streak
       FROM user_stats WHERE user_id = ? LIMIT 1`,
      [userId]
    ),
    getLearnDailyMotivation(userId),
    pool.query(
      `SELECT COUNT(*) AS c FROM user_learn_daily_progress
       WHERE user_id = ? AND goal_completed_at IS NOT NULL`,
      [userId]
    ).catch(() => [[{ c: 0 }]]),
    pool.query(
      `SELECT COUNT(*) AS c FROM user_review_events WHERE user_id = ?`,
      [userId]
    ).catch(() => [[{ c: 0 }]]),
    pool.query(
      `SELECT skill_key, mastery_score FROM user_learn_skill_mastery WHERE user_id = ?`,
      [userId]
    ),
    pool.query(
      `SELECT 1 AS ok FROM user_learn_placement_results WHERE user_id = ? LIMIT 1`,
      [userId]
    ).catch(() => [[]]),
    pool.query(
      `SELECT COUNT(*) AS c FROM user_learn_mistakes
       WHERE user_id = ? AND status = 'resolved'`,
      [userId]
    ).catch(() => [[{ c: 0 }]]),
  ]);

  const stats = statsRes[0]?.[0] || {};
  // Display streak from daily motivation (same source as Phase 8 UI)
  const streakForUnlock = Number(daily?.streak || stats.current_streak || 0);

  const skillsStrong = (masteryRes[0] || []).filter(
    (r) => Number(r.mastery_score) >= STRONG_MASTERY
  ).length;

  return {
    lessons_completed: Number(lessonRes[0]?.[0]?.c || 0),
    perfect_lessons: Number(perfectRes[0]?.[0]?.c || 0),
    xp_total: Number(stats.xp_total || 0),
    honey_total: Number(stats.honey_total || 0),
    streak: streakForUnlock,
    daily_goals_completed: Number(dailyGoalRes[0]?.[0]?.c || 0),
    srs_reviews: Number(srsRes[0]?.[0]?.c || 0),
    skills_strong: skillsStrong,
    placement_completed: placementRes[0]?.[0] ? 1 : 0,
    mistakes_resolved: Number(resolvedRes[0]?.[0]?.c || 0),
  };
}

/**
 * @param {Record<string, number>} metrics
 * @param {string} metric
 */
function metricValue(metrics, metric) {
  const v = metrics[metric];
  return Number.isFinite(Number(v)) ? Number(v) : 0;
}

/**
 * Idempotent evaluate + unlock. INSERT IGNORE → no duplicates under concurrency.
 * @param {number} userId
 * @returns {Promise<{ newlyUnlocked: object[], metrics: object }>}
 */
export async function evaluateAndUnlockAchievements(userId) {
  await ensureAchievementTables();
  const metrics = await loadAchievementMetrics(userId);

  const eligible = ACHIEVEMENT_CATALOG.filter(
    (def) => metricValue(metrics, def.metric) >= def.target
  );

  const newlyUnlocked = [];
  if (eligible.length === 0) {
    await invalidateAchievementsCache(userId);
    return { newlyUnlocked, metrics };
  }

  const now = new Date();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (const def of eligible) {
      const meta = JSON.stringify({
        metric: def.metric,
        value: metricValue(metrics, def.metric),
        target: def.target,
      });
      const [ins] = await conn.query(
        `INSERT IGNORE INTO user_learn_achievements
           (user_id, achievement_key, unlocked_at, meta_json)
         VALUES (?, ?, ?, CAST(? AS JSON))`,
        [userId, def.key, now, meta]
      );
      if (ins?.affectedRows === 1) {
        newlyUnlocked.push({
          key: def.key,
          title: def.title,
          description: def.description,
          icon: def.icon,
          category: def.category,
          tier: def.tier,
          unlockedAt: now.toISOString(),
        });
      }
    }
    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  await invalidateAchievementsCache(userId);
  return { newlyUnlocked, metrics };
}

/**
 * Build progress snapshot for UI (unlocked + in-progress).
 * @param {number} userId
 * @param {{ bypassCache?: boolean, evaluate?: boolean }} [opts]
 */
export async function getAchievementsSnapshot(userId, opts = {}) {
  await ensureAchievementTables();

  let newlyUnlocked = [];
  if (opts.evaluate !== false) {
    const ev = await evaluateAndUnlockAchievements(userId);
    newlyUnlocked = ev.newlyUnlocked;
  }

  const metrics = await loadAchievementMetrics(userId);
  const fp = fingerprint(metrics);

  if (!opts.bypassCache && newlyUnlocked.length === 0) {
    const [cached] = await pool.query(
      `SELECT payload_json, input_fingerprint, expires_at
       FROM user_learn_achievements_cache WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const row = cached[0];
    if (
      row &&
      String(row.input_fingerprint) === fp &&
      row.expires_at &&
      new Date(row.expires_at).getTime() > Date.now()
    ) {
      const payload =
        typeof row.payload_json === "string" ? JSON.parse(row.payload_json) : row.payload_json;
      return { ...payload, newlyUnlocked: [], cached: true };
    }
  }

  const [unlockedRows] = await pool.query(
    `SELECT achievement_key, unlocked_at, meta_json
     FROM user_learn_achievements WHERE user_id = ?
     ORDER BY unlocked_at DESC`,
    [userId]
  );
  const unlockedMap = new Map(
    (unlockedRows || []).map((r) => [String(r.achievement_key), r])
  );

  const items = ACHIEVEMENT_CATALOG.map((def) => {
    const current = metricValue(metrics, def.metric);
    const row = unlockedMap.get(def.key);
    const unlocked = Boolean(row);
    const unlockedAt = row?.unlocked_at
      ? new Date(row.unlocked_at).toISOString()
      : null;
    return {
      key: def.key,
      title: def.title,
      description: def.description,
      icon: def.icon,
      category: def.category,
      tier: def.tier,
      progress: Math.min(current, def.target),
      current,
      target: def.target,
      unlocked,
      unlockedAt,
      progressPct: Math.min(100, Math.round((current / Math.max(1, def.target)) * 100)),
    };
  });

  const unlocked = items.filter((i) => i.unlocked);
  const inProgress = items
    .filter((i) => !i.unlocked && i.current > 0)
    .sort((a, b) => b.progressPct - a.progressPct)
    .slice(0, 6);
  const locked = items.filter((i) => !i.unlocked && i.current === 0);

  const result = {
    metrics,
    unlocked,
    inProgress,
    lockedCount: locked.length,
    total: items.length,
    unlockedCount: unlocked.length,
    newlyUnlocked,
    generatedAt: new Date().toISOString(),
    cached: false,
  };

  const expires = new Date(Date.now() + CACHE_TTL_SEC * 1000);
  await pool.query(
    `INSERT INTO user_learn_achievements_cache (user_id, payload_json, input_fingerprint, expires_at)
     VALUES (?, CAST(? AS JSON), ?, ?)
     ON DUPLICATE KEY UPDATE
       payload_json = VALUES(payload_json),
       input_fingerprint = VALUES(input_fingerprint),
       expires_at = VALUES(expires_at),
       updated_at = CURRENT_TIMESTAMP`,
    [userId, JSON.stringify({ ...result, newlyUnlocked: [] }), fp, expires]
  );

  return result;
}

/**
 * Reject client-claimed unlock keys (security helper for API).
 * @param {unknown} body
 */
export function rejectClientUnlockAttempt(body) {
  if (!body || typeof body !== "object") return false;
  return Boolean(
    body.unlock ||
      body.achievement_key ||
      body.achievementKey ||
      body.unlock_key ||
      Array.isArray(body.unlocks)
  );
}

export { ACHIEVEMENT_BY_KEY, ACHIEVEMENT_CATALOG };
