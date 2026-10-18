import pool from "@/lib/db";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import {
  buildLearningPathFromCatalog,
  flattenPathNodes,
} from "@/lib/beego/learning-path-build";
import { DEFAULT_FIRST_LESSON_ID } from "@/lib/beego/learning-path-catalog";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import {
  applyDailyGoalAndStreakInTx,
  getLearnDailyMotivation,
} from "@/lib/beego/learn/daily-goal-streak-engine";

let pathSchemaReady = false;

export async function ensureLearningPathTables() {
  if (pathSchemaReady) return;
  await ensureUserStatsTables();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_lesson_progress (
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      status ENUM('active', 'completed') NOT NULL DEFAULT 'completed',
      score DECIMAL(5,2) NULL,
      xp_awarded INT NOT NULL DEFAULT 0,
      honey_awarded INT NOT NULL DEFAULT 0,
      completed_at DATETIME NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, lesson_id),
      KEY idx_ulp_user_status (user_id, status),
      KEY idx_ulp_completed (user_id, completed_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const sql of [
    "ALTER TABLE user_stats ADD COLUMN honey_total INT NOT NULL DEFAULT 0 AFTER xp_total",
    "ALTER TABLE user_stats ADD COLUMN active_lesson_id VARCHAR(64) NULL AFTER last_answer_at",
    "ALTER TABLE user_stats ADD COLUMN placement_start_lesson_id VARCHAR(64) NULL AFTER active_lesson_id",
  ]) {
    try {
      await pool.query(sql);
    } catch {
      /* column exists */
    }
  }
  pathSchemaReady = true;
}

/**
 * @param {number} userId
 */
export async function ensureUserStatsRow(userId) {
  await ensureLearningPathTables();
  await pool.query(
    `INSERT IGNORE INTO user_stats (user_id, xp_total, honey_total, current_streak, best_streak, active_lesson_id)
     VALUES (?, 0, 0, 0, 0, ?)`,
    [userId, DEFAULT_FIRST_LESSON_ID]
  );
}

/**
 * @param {number} userId
 * @returns {Promise<{ completedIds: Set<string>, activeLessonId: string, stats: object }>}
 */
export async function loadUserPathState(userId) {
  await ensureUserStatsRow(userId);

  const [progRows] = await pool.query(
    `SELECT lesson_id, status FROM user_lesson_progress WHERE user_id = ?`,
    [userId]
  );
  const completedIds = new Set();
  for (const r of progRows) {
    if (String(r.status) === "completed") completedIds.add(String(r.lesson_id));
  }

  const [statsRows] = await pool.query(
    `SELECT xp_total, honey_total, current_streak, best_streak, last_active_date, active_lesson_id, placement_start_lesson_id
     FROM user_stats WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const stats = statsRows[0] || {
    xp_total: 0,
    honey_total: 0,
    current_streak: 0,
    best_streak: 0,
    last_active_date: null,
    active_lesson_id: DEFAULT_FIRST_LESSON_ID,
    placement_start_lesson_id: null,
  };

  let activeLessonId = stats.active_lesson_id
    ? String(stats.active_lesson_id)
    : DEFAULT_FIRST_LESSON_ID;

  // Derive active = first incomplete in catalog order if stored active already completed
  const catalog = buildLearningPathFromCatalog({
    completedLessonIds: completedIds,
    activeLessonId: null,
  });
  const ordered = flattenPathNodes(catalog.sections);
  const firstIncomplete = ordered.find((n) => !completedIds.has(n.lessonId));
  if (firstIncomplete) {
    if (completedIds.has(activeLessonId) || !ordered.some((n) => n.lessonId === activeLessonId)) {
      activeLessonId = firstIncomplete.lessonId;
    }
  } else if (ordered.length) {
    activeLessonId = ordered[ordered.length - 1].lessonId;
  }

  return { completedIds, activeLessonId, stats };
}

/**
 * Build path for a user (or guest demo-free empty progress).
 * @param {number|null} userId
 */
export async function getLearningPathForUser(userId) {
  if (!userId) {
    return buildLearningPathFromCatalog({
      completedLessonIds: new Set(),
      activeLessonId: DEFAULT_FIRST_LESSON_ID,
    });
  }

  const { completedIds, activeLessonId, stats } = await loadUserPathState(userId);

  // Virtual skipped-before-placement for UI only (no XP / no progress rows)
  const displayCompleted = new Set(completedIds);
  const placementStart = stats.placement_start_lesson_id
    ? String(stats.placement_start_lesson_id)
    : null;
  if (placementStart) {
    const catalogAll = buildLearningPathFromCatalog({
      completedLessonIds: new Set(),
      activeLessonId: DEFAULT_FIRST_LESSON_ID,
    });
    for (const n of flattenPathNodes(catalogAll.sections)) {
      if (n.lessonId === placementStart) break;
      displayCompleted.add(n.lessonId);
    }
  }

  const path = buildLearningPathFromCatalog({
    completedLessonIds: displayCompleted,
    activeLessonId,
  });
  if (placementStart) {
    for (const section of path.sections) {
      for (const node of section.nodes) {
        if (displayCompleted.has(node.lessonId) && !completedIds.has(node.lessonId)) {
          node.status = "skipped";
          node.placementSkipped = true;
        }
      }
    }
  }

  let daily = null;
  try {
    daily = await getLearnDailyMotivation(userId);
  } catch {
    daily = null;
  }

  return {
    ...path,
    progress: {
      xp_total: Number(stats.xp_total || 0),
      honey_total: Number(stats.honey_total || 0),
      streak: Number(daily?.streak ?? stats.current_streak ?? 0),
      best_streak: Number(daily?.best_streak ?? stats.best_streak ?? 0),
      active_lesson_id: activeLessonId,
      completed_count: completedIds.size,
      xp_today: Number(daily?.xp_today || 0),
      daily_goal_xp: Number(daily?.daily_goal_xp || 30),
      daily_goal_progress_pct: Number(daily?.daily_goal_progress_pct || 0),
      daily_goal_completed: Boolean(daily?.daily_goal_completed),
      timezone: daily?.timezone || "Asia/Ho_Chi_Minh",
    },
    daily_motivation: daily,
  };
}

/**
 * Mark lesson complete, award XP/Honey, advance active lesson, update streak.
 * @param {number} userId
 * @param {string} lessonId
 * @param {{ score?: number }} [opts]
 */
export async function completeLessonForUser(userId, lessonId, opts = {}) {
  await ensureUserStatsRow(userId);
  const id = String(lessonId || "").trim();
  if (!id) throw new Error("lesson_id required");

  const catalog = buildLearningPathFromCatalog({
    completedLessonIds: new Set(),
    activeLessonId: DEFAULT_FIRST_LESSON_ID,
  });
  const node = flattenPathNodes(catalog.sections).find((n) => n.lessonId === id);
  if (!node) {
    const err = new Error("Unknown lesson_id");
    err.code = "UNKNOWN_LESSON";
    throw err;
  }

  const { completedIds, stats } = await loadUserPathState(userId);
  if (completedIds.has(id)) {
    const path = await getLearningPathForUser(userId);
    return {
      already_completed: true,
      path,
      daily_motivation: path.daily_motivation || null,
    };
  }

  // Sequential unlock: may only complete active or already-unlocked (previous completed)
  // Placement Smart Start may waive lessons before placement_start_lesson_id (no rewards granted).
  const ordered = flattenPathNodes(catalog.sections);
  const idx = ordered.findIndex((n) => n.lessonId === id);
  const placementStart = stats.placement_start_lesson_id
    ? String(stats.placement_start_lesson_id)
    : null;
  const waiveUntil = placementStart
    ? ordered.findIndex((n) => n.lessonId === placementStart)
    : -1;
  for (let i = 0; i < idx; i++) {
    if (completedIds.has(ordered[i].lessonId)) continue;
    if (waiveUntil >= 0 && i < waiveUntil) continue;
    const err = new Error("Lesson locked — complete previous lessons first");
    err.code = "LESSON_LOCKED";
    throw err;
  }

  const lessonContent = getLessonContentById(id);
  const isP1Gate = /^p1-g1-n(0[1-9]|1[0-6])$/.test(id);
  const lessonQuestions = lessonContent?.questions || [];
  const requiredQuestions = isP1Gate
    ? lessonQuestions.filter((question) => question?.required && question.id)
    : [];
  const requiredIds = requiredQuestions
    .map((question) => String(question.id))
    .filter((questionId) => questionId.startsWith(`${id}-`));
  const contentRevision =
    lessonQuestions.find((q) => q.extensions?.contentRevision)?.extensions?.contentRevision || null;

  if (requiredIds.length) {
    const placeholders = requiredIds.map(() => "?").join(", ");
    const [attempted] = await pool.query(
      `SELECT DISTINCT question_id
       FROM user_learn_exercise_attempts
       WHERE user_id = ? AND lesson_id = ? AND content_revision <=> ? AND question_id IN (${placeholders})`,
      [userId, id, contentRevision, ...requiredIds]
    );
    const seen = new Set(attempted.map((row) => String(row.question_id)));
    if (requiredIds.some((questionId) => !seen.has(questionId))) {
      const err = new Error("Required questions were skipped");
      err.code = "REQUIRED_QUESTIONS_SKIPPED";
      throw err;
    }
  }

  const xp = Number(node.xpReward || 0);
  const honey = Number(node.honeyReward || 0);

  // Server-side scoring: evaluate latest attempts per question in the current revision session
  let score = null;
  try {
    const [attempts] = await pool.query(
      `SELECT attempt_key, question_id, is_correct, created_at
       FROM user_learn_exercise_attempts
       WHERE user_id = ? AND lesson_id = ? AND content_revision <=> ?
       ORDER BY created_at DESC`,
      [userId, id, contentRevision]
    );

    // Latest attempt per question in current revision
    const latestAttemptByQid = new Map();
    for (const att of attempts) {
      const qid = String(att.question_id);
      if (!latestAttemptByQid.has(qid)) {
        latestAttemptByQid.set(qid, att);
      }
    }

    if (latestAttemptByQid.size > 0) {
      let correctN = 0;
      const totalN = lessonQuestions.length || latestAttemptByQid.size;
      for (const q of lessonQuestions) {
        const att = latestAttemptByQid.get(String(q.id));
        if (att && Number(att.is_correct) === 1) {
          correctN += 1;
        }
      }
      score = Math.round((correctN / totalN) * 100);

      // Strict checkpoint evaluation for n08 and n15
      if (id === "p1-g1-n15") {
        // Must score >= 80% AND satisfy all core competency groups
        const competencyGroups = {
          greeting_time: ["p1-g1-n15-q1"],
          ask_name: ["p1-g1-n15-q2"],
          ask_health: ["p1-g1-n15-q3"],
          origin_where_from: ["p1-g1-n15-q4", "p1-g1-n15-q5"],
          social_intro: ["p1-g1-n15-q6", "p1-g1-n15-q7"],
          polite_exit: ["p1-g1-n15-q8", "p1-g1-n15-q9", "p1-g1-n15-q10"],
        };

        const unmetCompetencies = [];
        for (const [compName, qIds] of Object.entries(competencyGroups)) {
          const hasPassed = qIds.some((qid) => {
            const att = latestAttemptByQid.get(qid);
            return att && Number(att.is_correct) === 1;
          });
          if (!hasPassed) {
            unmetCompetencies.push(compName);
          }
        }

        if (score < 80 || unmetCompetencies.length > 0) {
          const err = new Error(
            score < 80
              ? `Điểm bài kiểm tra vượt cửa chưa đạt (${score}% / yêu cầu ≥ 80%). Hãy ôn tập và thử lại!`
              : `Bạn cần hoàn thành chính xác đại diện cho toàn bộ 6 nhóm năng lực cốt lõi. Nhóm chưa đạt: ${unmetCompetencies.join(", ")}.`
          );
          err.code = "GATE_TEST_FAILED";
          err.score = score;
          err.requiredScore = 80;
          err.remediationLessonId = "p1-g1-n11";
          err.unmetCompetencies = unmetCompetencies;
          throw err;
        }
      } else if (id === "p1-g1-n08") {
        if (score < 75) {
          const err = new Error(
            `Điểm kiểm tra giữa cửa chưa đạt (${score}% / yêu cầu ≥ 75%). Hãy ôn tập các bài n01–n07 và thử lại!`
          );
          err.code = "GATE_TEST_FAILED";
          err.score = score;
          err.requiredScore = 75;
          err.remediationLessonId = "p1-g1-n06";
          throw err;
        }
      }
    }
  } catch (err) {
    if (err.code === "GATE_TEST_FAILED" || err.code === "REQUIRED_QUESTIONS_SKIPPED") {
      throw err;
    }
    score = null;
  }

  if (score == null && opts.score != null && Number.isFinite(Number(opts.score))) {
    // Fallback only when no attempts yet (e.g. empty lesson) — clamped, never exceeds 100
    score = Math.max(0, Math.min(100, Math.round(Number(opts.score))));
  }
  const nextNode = ordered[idx + 1] || null;
  const nextActive = nextNode ? nextNode.lessonId : id;

  let dailyMotivation = null;
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `INSERT INTO user_lesson_progress
         (user_id, lesson_id, status, score, xp_awarded, honey_awarded, completed_at)
       VALUES (?, ?, 'completed', ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         status = 'completed',
         score = COALESCE(VALUES(score), score),
         xp_awarded = VALUES(xp_awarded),
         honey_awarded = VALUES(honey_awarded),
         completed_at = COALESCE(completed_at, NOW()),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, id, score, xp, honey]
    );

    await conn.query(
      `UPDATE user_stats SET
         xp_total = xp_total + ?,
         honey_total = honey_total + ?,
         active_lesson_id = ?
       WHERE user_id = ?`,
      [xp, honey, nextActive, userId]
    );

    dailyMotivation = await applyDailyGoalAndStreakInTx(conn, userId, { xpAwarded: xp });

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  const path = await getLearningPathForUser(userId);
  return {
    already_completed: false,
    xp_awarded: xp,
    honey_awarded: honey,
    next_lesson_id: nextActive,
    path,
    daily_motivation: dailyMotivation,
  };
}
