import crypto from "node:crypto";
import pool from "@/lib/db";
import { buildAdaptiveLessonMix, buildLessonMixFromContent } from "@/lib/beego/learn/lesson-mix-engine";
import { isIntegratedLesson } from "@/lib/beego/learn/integrated-lesson";

let schemaReady = false;

export async function ensureLessonMixSessionTable() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_lesson_mix_session (
      mix_id VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      mix_fingerprint VARCHAR(128) NOT NULL,
      questions_json JSON NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      UNIQUE KEY uq_ulms_user_lesson (user_id, lesson_id),
      KEY idx_ulms_expires (expires_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  schemaReady = true;
}

export async function findServedMixExercise(userId, lessonId, questionId) {
  await ensureLessonMixSessionTable();
  const [rows] = await pool.query(
    `SELECT questions_json
     FROM user_learn_lesson_mix_session
     WHERE user_id = ? AND lesson_id = ? AND expires_at > NOW()
     LIMIT 1`,
    [userId, String(lessonId || "")]
  );
  let questions = rows[0]?.questions_json;
  if (typeof questions === "string") {
    try {
      questions = JSON.parse(questions);
    } catch {
      questions = null;
    }
  }
  if (!Array.isArray(questions)) return null;
  const id = String(questionId || "");
  return (
    questions.find((question) => {
      const source = question?.activityMeta?.sourceQuestionId || question?.reviewMeta?.sourceQuestionId || question?.id;
      return String(question?.id || "") === id || String(source || "") === id;
    }) || null
  );
}

/**
 * Stable mix for reload (24h TTL). Review lessons skip (Phase 5).
 * @param {number} userId
 * @param {object} lesson normalized catalog lesson
 */
export async function getOrCreateLessonMixSession(userId, lesson) {
  await ensureLessonMixSessionTable();
  const lessonId = String(lesson.lessonId || "").trim();
  if (!lessonId || lesson.type === "review") {
    return { questions: lesson.questions, mixId: null, cached: false, skipped: true };
  }

  const [existing] = await pool.query(
    `SELECT mix_id, questions_json, mix_fingerprint
     FROM user_learn_lesson_mix_session
     WHERE user_id = ? AND lesson_id = ? AND expires_at > NOW()
     LIMIT 1`,
    [userId, lessonId]
  );

  if (isIntegratedLesson(lesson)) {
    const built = buildLessonMixFromContent(lesson, {});
    let cachedQuestions = existing[0]?.questions_json;
    if (typeof cachedQuestions === "string") {
      try {
        cachedQuestions = JSON.parse(cachedQuestions);
      } catch {
        cachedQuestions = null;
      }
    }
    if (
      Array.isArray(cachedQuestions) &&
      existing[0]?.mix_fingerprint === built.mixFingerprint &&
      cachedQuestions.length === built.questions.length
    ) {
      return {
        questions: cachedQuestions,
        mixId: existing[0].mix_id,
        mixFingerprint: existing[0].mix_fingerprint,
        cached: true,
        mixMeta: built.mixMeta,
      };
    }
    const mixId = crypto.randomBytes(16).toString("hex");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.query(
      `INSERT INTO user_learn_lesson_mix_session
         (mix_id, user_id, lesson_id, mix_fingerprint, questions_json, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         mix_id = VALUES(mix_id),
         mix_fingerprint = VALUES(mix_fingerprint),
         questions_json = VALUES(questions_json),
         expires_at = VALUES(expires_at),
         created_at = CURRENT_TIMESTAMP`,
      [mixId, userId, lessonId, built.mixFingerprint, JSON.stringify(built.questions), expires]
    );
    return {
      questions: built.questions,
      mixId,
      mixFingerprint: built.mixFingerprint,
      mixMeta: built.mixMeta,
      cached: false,
    };
  }

  if (existing[0]?.questions_json) {
    let questions = existing[0].questions_json;
    if (typeof questions === "string") {
      try {
        questions = JSON.parse(questions);
      } catch {
        questions = null;
      }
    }
    const bankSize = Array.isArray(lesson.questions) ? lesson.questions.length : 0;
    const expectMin = Math.min(10, bankSize);
    // Invalidate stale short mixes from pre–content-v2 banks
    if (Array.isArray(questions) && questions.length >= expectMin && questions.length > 0) {
      return {
        questions,
        mixId: existing[0].mix_id,
        mixFingerprint: existing[0].mix_fingerprint,
        cached: true,
      };
    }
  }

  const built = await buildAdaptiveLessonMix(userId, lesson);
  const mixId = crypto.randomBytes(16).toString("hex");
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  await pool.query(
    `INSERT INTO user_learn_lesson_mix_session
       (mix_id, user_id, lesson_id, mix_fingerprint, questions_json, expires_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       mix_id = VALUES(mix_id),
       mix_fingerprint = VALUES(mix_fingerprint),
       questions_json = VALUES(questions_json),
       expires_at = VALUES(expires_at),
       created_at = CURRENT_TIMESTAMP`,
    [mixId, userId, lessonId, built.mixFingerprint, JSON.stringify(built.questions), expires]
  );

  return {
    questions: built.questions,
    mixId,
    mixFingerprint: built.mixFingerprint,
    mixMeta: built.mixMeta,
    cached: false,
  };
}

/**
 * @param {number} userId
 * @param {string} lessonId
 */
export async function clearLessonMixSession(userId, lessonId) {
  await ensureLessonMixSessionTable();
  await pool.query(`DELETE FROM user_learn_lesson_mix_session WHERE user_id = ? AND lesson_id = ?`, [
    userId,
    String(lessonId || "").trim(),
  ]);
}
