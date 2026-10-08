import crypto from "node:crypto";
import pool from "@/lib/db";
import { checkAnswer } from "@/lib/beego/learn/exercise-check";
import {
  buildPlacementItemBank,
  pickPlacementItem,
  toClientPlacementQuestion,
} from "@/lib/beego/learn/placement-item-bank";
import {
  PLACEMENT_MAX_QUESTIONS,
  PLACEMENT_MIN_QUESTIONS,
  PLACEMENT_START_DIFFICULTY,
  assertKnownLessonId,
  computePlacementConfidence,
  placementToProgressionTier,
  scorePlacementAnswers,
  shouldEarlyStopPlacement,
} from "@/lib/beego/learn/placement-scoring";
import { DEFAULT_FIRST_LESSON_ID } from "@/lib/beego/learning-path-catalog";
import { ensureUserStatsRow } from "@/lib/beego/learning-path-progress";
import { ensureSmartProgressionTables } from "@/lib/beego/learn/smart-progression";

let schemaReady = false;

export async function ensurePlacementTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_placement_sessions (
      session_id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NULL,
      status ENUM('active', 'completed', 'abandoned') NOT NULL DEFAULT 'active',
      ability_score DECIMAL(8,3) NOT NULL DEFAULT 0,
      difficulty_level TINYINT UNSIGNED NOT NULL DEFAULT 2,
      asked_count INT UNSIGNED NOT NULL DEFAULT 0,
      correct_count INT UNSIGNED NOT NULL DEFAULT 0,
      current_item_json JSON NULL,
      asked_refs_json JSON NULL,
      skill_stats_json JSON NULL,
      guest_token VARCHAR(64) NULL,
      expires_at DATETIME NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_lps_user (user_id),
      KEY idx_lps_guest (guest_token),
      KEY idx_lps_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_placement_answers (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      answer_key VARCHAR(64) NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      question_id VARCHAR(128) NOT NULL,
      skill_key VARCHAR(32) NOT NULL,
      difficulty_level TINYINT UNSIGNED NOT NULL,
      is_correct TINYINT(1) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_lpa_answer_key (answer_key),
      KEY idx_lpa_session (session_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_placement_results (
      user_id BIGINT UNSIGNED NOT NULL PRIMARY KEY,
      session_id VARCHAR(64) NOT NULL,
      placement_score DECIMAL(5,2) NOT NULL DEFAULT 0,
      estimated_level VARCHAR(16) NOT NULL DEFAULT 'A0',
      strengths_json JSON NULL,
      weak_skills_json JSON NULL,
      confidence DECIMAL(5,3) NOT NULL DEFAULT 0,
      recommended_lesson_id VARCHAR(64) NOT NULL,
      start_choice ENUM('recommended', 'from_start', 'skipped') NULL,
      placement_start_lesson_id VARCHAR(64) NULL,
      completed_at DATETIME NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_ulpr_lesson (recommended_lesson_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  for (const sql of [
    "ALTER TABLE user_stats ADD COLUMN placement_start_lesson_id VARCHAR(64) NULL AFTER active_lesson_id",
  ]) {
    try {
      await pool.query(sql);
    } catch {
      /* exists */
    }
  }
  schemaReady = true;
}

function parseJson(val, fallback) {
  if (val == null) return fallback;
  if (typeof val === "object") return val;
  try {
    return JSON.parse(val);
  } catch {
    return fallback;
  }
}

function newId() {
  return crypto.randomBytes(24).toString("hex");
}

/**
 * @param {number|null} userId
 */
export async function getPlacementStatus(userId) {
  await ensurePlacementTables();
  if (!userId) {
    return {
      needed: true,
      completed: false,
      result: null,
      guest: true,
    };
  }
  const [rows] = await pool.query(
    `SELECT placement_score, estimated_level, strengths_json, weak_skills_json, confidence,
            recommended_lesson_id, start_choice, placement_start_lesson_id, completed_at
     FROM user_learn_placement_results WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const row = rows[0];
  if (!row) {
    const [prog] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_lesson_progress WHERE user_id = ? AND status = 'completed'`,
      [userId]
    );
    const hasProgress = Number(prog[0]?.c || 0) > 0;
    return {
      needed: !hasProgress,
      completed: false,
      result: null,
      guest: false,
    };
  }
  return {
    needed: false,
    completed: true,
    guest: false,
    result: {
      placementScore: Number(row.placement_score),
      estimatedLevel: row.estimated_level,
      strengths: parseJson(row.strengths_json, []),
      weakSkills: parseJson(row.weak_skills_json, []),
      confidence: Number(row.confidence),
      recommendedLessonId: row.recommended_lesson_id,
      startChoice: row.start_choice,
      placementStartLessonId: row.placement_start_lesson_id,
      completedAt: row.completed_at,
    },
  };
}

/**
 * @param {number|null} userId
 */
export async function startPlacementSession(userId) {
  await ensurePlacementTables();
  buildPlacementItemBank();

  if (userId) {
    const status = await getPlacementStatus(userId);
    if (status.completed && status.result?.startChoice) {
      const err = new Error("Placement already completed.");
      err.code = "ALREADY_DONE";
      throw err;
    }
    await pool.query(
      `UPDATE learn_placement_sessions SET status = 'abandoned'
       WHERE user_id = ? AND status = 'active'`,
      [userId]
    );
  }

  const sessionId = newId();
  const guestToken = userId ? null : newId();
  const difficulty = PLACEMENT_START_DIFFICULTY;
  const item = pickPlacementItem(difficulty, new Set());
  if (!item) {
    const err = new Error("Placement bank empty.");
    err.code = "NO_ITEMS";
    throw err;
  }

  const expires = new Date(Date.now() + 2 * 60 * 60 * 1000);
  const answerKey = newId();
  const current = {
    ...item,
    answerKey,
  };

  await pool.query(
    `INSERT INTO learn_placement_sessions
       (session_id, user_id, status, ability_score, difficulty_level, asked_count, correct_count,
        current_item_json, asked_refs_json, skill_stats_json, guest_token, expires_at)
     VALUES (?, ?, 'active', 0, ?, 0, 0, ?, ?, ?, ?, ?)`,
    [
      sessionId,
      userId || null,
      difficulty,
      JSON.stringify(current),
      JSON.stringify([]),
      JSON.stringify({ consecutive: 0, lastCorrect: null }),
      guestToken,
      expires,
    ]
  );

  return {
    sessionId,
    guestToken,
    questionIndex: 1,
    minQuestions: PLACEMENT_MIN_QUESTIONS,
    maxQuestions: PLACEMENT_MAX_QUESTIONS,
    question: toClientPlacementQuestion(item),
    answerKey,
    done: false,
  };
}

/**
 * Load session with ownership check.
 */
async function loadOwnedSession(sessionId, { userId = null, guestToken = null }, forUpdate = false) {
  await ensurePlacementTables();
  const lock = forUpdate ? "FOR UPDATE" : "";
  const [rows] = await pool.query(
    `SELECT * FROM learn_placement_sessions WHERE session_id = ? LIMIT 1 ${lock}`,
    [sessionId]
  );
  const row = rows[0];
  if (!row) {
    const err = new Error("Session not found.");
    err.code = "NOT_FOUND";
    throw err;
  }
  if (new Date(row.expires_at).getTime() < Date.now() && row.status === "active") {
    const err = new Error("Session expired.");
    err.code = "EXPIRED";
    throw err;
  }
  if (row.user_id != null) {
    if (!userId || Number(row.user_id) !== Number(userId)) {
      const err = new Error("Forbidden.");
      err.code = "FORBIDDEN";
      throw err;
    }
  } else {
    if (!guestToken || String(row.guest_token) !== String(guestToken)) {
      const err = new Error("Forbidden.");
      err.code = "FORBIDDEN";
      throw err;
    }
  }
  return row;
}

/**
 * @param {{
 *   sessionId: string,
 *   answerKey: string,
 *   answer: unknown,
 *   userId?: number|null,
 *   guestToken?: string|null,
 * }} input
 */
export async function submitPlacementAnswer(input) {
  await ensurePlacementTables();
  const sessionId = String(input.sessionId || "").trim();
  const answerKey = String(input.answerKey || "").trim();
  if (!sessionId || !answerKey) {
    const err = new Error("sessionId and answerKey required.");
    err.code = "INVALID_INPUT";
    throw err;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT * FROM learn_placement_sessions WHERE session_id = ? LIMIT 1 FOR UPDATE`,
      [sessionId]
    );
    const row = rows[0];
    if (!row) {
      const err = new Error("Session not found.");
      err.code = "NOT_FOUND";
      throw err;
    }
    if (row.status !== "active") {
      const err = new Error("Session not active.");
      err.code = "NOT_ACTIVE";
      throw err;
    }
    if (new Date(row.expires_at).getTime() < Date.now()) {
      const err = new Error("Session expired.");
      err.code = "EXPIRED";
      throw err;
    }
    if (row.user_id != null) {
      if (!input.userId || Number(row.user_id) !== Number(input.userId)) {
        const err = new Error("Forbidden.");
        err.code = "FORBIDDEN";
        throw err;
      }
    } else if (!input.guestToken || String(row.guest_token) !== String(input.guestToken)) {
      const err = new Error("Forbidden.");
      err.code = "FORBIDDEN";
      throw err;
    }

    const [dup] = await conn.query(
      `SELECT id FROM learn_placement_answers WHERE answer_key = ? LIMIT 1`,
      [answerKey]
    );
    if (dup[0]) {
      await conn.commit();
      return {
        duplicate: true,
        done: false,
        message: "Answer already recorded.",
      };
    }

    const current = parseJson(row.current_item_json, null);
    if (!current || current.answerKey !== answerKey) {
      const err = new Error("Answer key mismatch.");
      err.code = "KEY_MISMATCH";
      throw err;
    }

    const isCorrect = checkAnswer(current.exercise, input.answer);
    await conn.query(
      `INSERT INTO learn_placement_answers
         (session_id, answer_key, lesson_id, question_id, skill_key, difficulty_level, is_correct)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        sessionId,
        answerKey,
        current.lessonId,
        current.questionId,
        current.skillKey,
        current.difficulty,
        isCorrect ? 1 : 0,
      ]
    );

    const askedRefs = parseJson(row.asked_refs_json, []);
    askedRefs.push(current.ref);
    const used = new Set(askedRefs);

    let ability = Number(row.ability_score) || 0;
    let difficulty = Number(row.difficulty_level) || PLACEMENT_START_DIFFICULTY;
    const delta = 0.35 + current.difficulty * 0.15;
    if (isCorrect) {
      ability += delta;
      difficulty = Math.min(4, difficulty + 1);
    } else {
      ability -= delta;
      difficulty = Math.max(1, difficulty - 1);
    }

    const skillStats = parseJson(row.skill_stats_json, { consecutive: 0, lastCorrect: null });
    if (skillStats.lastCorrect === null || skillStats.lastCorrect === isCorrect) {
      skillStats.consecutive = Number(skillStats.consecutive || 0) + 1;
    } else {
      skillStats.consecutive = 1;
    }
    skillStats.lastCorrect = isCorrect;

    const askedCount = Number(row.asked_count || 0) + 1;
    const correctCount = Number(row.correct_count || 0) + (isCorrect ? 1 : 0);
    const confidence = computePlacementConfidence({
      asked: askedCount,
      correct: correctCount,
      ability,
      streakConsistent: skillStats.consecutive,
    });

    const stop = shouldEarlyStopPlacement({
      asked: askedCount,
      confidence,
      consecutiveSameDirection: skillStats.consecutive,
    });

    if (stop) {
      const [ansRows] = await conn.query(
        `SELECT difficulty_level AS difficulty, is_correct, skill_key
         FROM learn_placement_answers WHERE session_id = ? ORDER BY id ASC`,
        [sessionId]
      );
      const scored = scorePlacementAnswers(
        ansRows.map((a) => ({
          difficulty: a.difficulty,
          is_correct: Boolean(a.is_correct),
          skill_key: a.skill_key,
        }))
      );

      await conn.query(
        `UPDATE learn_placement_sessions SET
           status = 'completed',
           ability_score = ?,
           difficulty_level = ?,
           asked_count = ?,
           correct_count = ?,
           asked_refs_json = ?,
           skill_stats_json = ?,
           current_item_json = NULL,
           updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ?`,
        [ability, difficulty, askedCount, correctCount, JSON.stringify(askedRefs), JSON.stringify(skillStats), sessionId]
      );

      const resultPayload = {
        placementScore: scored.placementScore,
        estimatedLevel: scored.estimatedLevel,
        strengths: scored.strengths,
        weakSkills: scored.weakSkills,
        confidence,
        recommendedLessonId: scored.recommendedLessonId,
        askedCount,
        correctCount,
      };

      if (row.user_id) {
        await conn.query(
          `INSERT INTO user_learn_placement_results
             (user_id, session_id, placement_score, estimated_level, strengths_json, weak_skills_json,
              confidence, recommended_lesson_id, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             session_id = VALUES(session_id),
             placement_score = VALUES(placement_score),
             estimated_level = VALUES(estimated_level),
             strengths_json = VALUES(strengths_json),
             weak_skills_json = VALUES(weak_skills_json),
             confidence = VALUES(confidence),
             recommended_lesson_id = VALUES(recommended_lesson_id),
             completed_at = NOW(),
             updated_at = CURRENT_TIMESTAMP`,
          [
            row.user_id,
            sessionId,
            scored.placementScore,
            scored.estimatedLevel,
            JSON.stringify(scored.strengths),
            JSON.stringify(scored.weakSkills),
            confidence,
            scored.recommendedLessonId,
          ]
        );
      }

      await conn.commit();
      return {
        duplicate: false,
        done: true,
        isCorrect,
        result: resultPayload,
        xpAwarded: 0,
        honeyAwarded: 0,
        streakChanged: false,
      };
    }

    const nextItem = pickPlacementItem(difficulty, used);
    if (!nextItem || askedCount >= PLACEMENT_MAX_QUESTIONS - 1) {
      // Exhausted bank or last slot — finalize with current answers
      const [ansRows] = await conn.query(
        `SELECT difficulty_level AS difficulty, is_correct, skill_key
         FROM learn_placement_answers WHERE session_id = ? ORDER BY id ASC`,
        [sessionId]
      );
      const scored = scorePlacementAnswers(
        ansRows.map((a) => ({
          difficulty: a.difficulty,
          is_correct: Boolean(a.is_correct),
          skill_key: a.skill_key,
        }))
      );
      await conn.query(
        `UPDATE learn_placement_sessions SET
           status = 'completed',
           ability_score = ?,
           difficulty_level = ?,
           asked_count = ?,
           correct_count = ?,
           asked_refs_json = ?,
           skill_stats_json = ?,
           current_item_json = NULL,
           updated_at = CURRENT_TIMESTAMP
         WHERE session_id = ?`,
        [ability, difficulty, askedCount, correctCount, JSON.stringify(askedRefs), JSON.stringify(skillStats), sessionId]
      );
      const resultPayload = {
        placementScore: scored.placementScore,
        estimatedLevel: scored.estimatedLevel,
        strengths: scored.strengths,
        weakSkills: scored.weakSkills,
        confidence,
        recommendedLessonId: scored.recommendedLessonId,
        askedCount,
        correctCount,
      };
      if (row.user_id) {
        await conn.query(
          `INSERT INTO user_learn_placement_results
             (user_id, session_id, placement_score, estimated_level, strengths_json, weak_skills_json,
              confidence, recommended_lesson_id, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
           ON DUPLICATE KEY UPDATE
             session_id = VALUES(session_id),
             placement_score = VALUES(placement_score),
             estimated_level = VALUES(estimated_level),
             strengths_json = VALUES(strengths_json),
             weak_skills_json = VALUES(weak_skills_json),
             confidence = VALUES(confidence),
             recommended_lesson_id = VALUES(recommended_lesson_id),
             completed_at = NOW()`,
          [
            row.user_id,
            sessionId,
            scored.placementScore,
            scored.estimatedLevel,
            JSON.stringify(scored.strengths),
            JSON.stringify(scored.weakSkills),
            confidence,
            scored.recommendedLessonId,
          ]
        );
      }
      await conn.commit();
      return {
        duplicate: false,
        done: true,
        isCorrect,
        result: resultPayload,
        xpAwarded: 0,
        honeyAwarded: 0,
        streakChanged: false,
      };
    }

    const nextAnswerKey = newId();
    const nextCurrent = { ...nextItem, answerKey: nextAnswerKey };

    await conn.query(
      `UPDATE learn_placement_sessions SET
         ability_score = ?,
         difficulty_level = ?,
         asked_count = ?,
         correct_count = ?,
         asked_refs_json = ?,
         skill_stats_json = ?,
         current_item_json = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE session_id = ?`,
      [
        ability,
        difficulty,
        askedCount,
        correctCount,
        JSON.stringify(askedRefs),
        JSON.stringify(skillStats),
        JSON.stringify(nextCurrent),
        sessionId,
      ]
    );

    await conn.commit();
    return {
      duplicate: false,
      done: false,
      isCorrect,
      questionIndex: askedCount + 1,
      question: toClientPlacementQuestion(nextItem),
      answerKey: nextAnswerKey,
      confidence,
      xpAwarded: 0,
      honeyAwarded: 0,
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

/**
 * Apply Smart Start choice — no XP/Honey/Streak/mass-complete.
 * @param {number} userId
 * @param {'recommended'|'from_start'|'skipped'} choice
 */
export async function applyPlacementStartChoice(userId, choice) {
  await ensurePlacementTables();
  await ensureUserStatsRow(userId);
  await ensureSmartProgressionTables();
  const allowed = new Set(["recommended", "from_start", "skipped"]);
  if (!allowed.has(choice)) {
    const err = new Error("Invalid choice.");
    err.code = "INVALID_INPUT";
    throw err;
  }

  const [rows] = await pool.query(
    `SELECT * FROM user_learn_placement_results WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const result = rows[0];
  if (!result) {
    const err = new Error("Complete placement first.");
    err.code = "NO_RESULT";
    throw err;
  }
  if (result.start_choice) {
    return {
      alreadyApplied: true,
      startChoice: result.start_choice,
      activeLessonId: result.placement_start_lesson_id || DEFAULT_FIRST_LESSON_ID,
      recommendedLessonId: result.recommended_lesson_id,
    };
  }

  let startLesson = DEFAULT_FIRST_LESSON_ID;
  if (choice === "recommended") {
    startLesson = assertKnownLessonId(result.recommended_lesson_id);
  } else if (choice === "from_start" || choice === "skipped") {
    startLesson = DEFAULT_FIRST_LESSON_ID;
  }

  const tier = placementToProgressionTier(
    Number(result.placement_score),
    parseJson(result.weak_skills_json, [])
  );
  const recovery = tier === "weak" ? 80 : tier === "strong" ? 25 : 50;
  const challenge = tier === "strong" ? 80 : tier === "weak" ? 25 : 50;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    await conn.query(
      `UPDATE user_learn_placement_results SET
         start_choice = ?,
         placement_start_lesson_id = ?,
         updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ? AND start_choice IS NULL`,
      [choice, choice === "recommended" ? startLesson : null, userId]
    );

    await conn.query(
      `UPDATE user_stats SET
         active_lesson_id = ?,
         placement_start_lesson_id = ?
       WHERE user_id = ?`,
      [startLesson, choice === "recommended" ? startLesson : null, userId]
    );

    // Soft signal for Phase 6–7 mix only — does NOT write mastery earned
    await conn.query(
      `INSERT INTO user_learn_smart_progression
         (user_id, progression_tier, recovery_priority, challenge_priority, primary_skill_key, last_lesson_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         progression_tier = VALUES(progression_tier),
         recovery_priority = VALUES(recovery_priority),
         challenge_priority = VALUES(challenge_priority),
         updated_at = CURRENT_TIMESTAMP`,
      [userId, tier, recovery, challenge, parseJson(result.weak_skills_json, [])[0] || "vocabulary", startLesson]
    );

    await conn.commit();
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }

  return {
    alreadyApplied: false,
    startChoice: choice,
    activeLessonId: startLesson,
    recommendedLessonId: result.recommended_lesson_id,
    progressionTier: tier,
    xpAwarded: 0,
    honeyAwarded: 0,
  };
}

export { loadOwnedSession };
