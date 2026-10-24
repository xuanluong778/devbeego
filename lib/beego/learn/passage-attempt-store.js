import pool from "@/lib/db";
import { PASSAGE_PASS_PRONUNCIATION } from "@/lib/beego/learn/passage-read";

let ready = false;

export async function ensurePassageAttemptTable() {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_learn_passage_attempts (
      attempt_key VARCHAR(64) NOT NULL PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      question_id VARCHAR(128) NOT NULL,
      content_revision VARCHAR(40) NULL,
      pronunciation_score TINYINT UNSIGNED NULL,
      accuracy_score TINYINT UNSIGNED NULL,
      fluency_score TINYINT UNSIGNED NULL,
      completeness_score TINYINT UNSIGNED NULL,
      prosody_score TINYINT UNSIGNED NULL,
      passed TINYINT(1) NOT NULL DEFAULT 0,
      words_json TEXT NULL,
      feedback_vi VARCHAR(600) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_ulpa_user_lesson (user_id, lesson_id, question_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ready = true;
}

function rowToResult(row) {
  if (!row) return null;
  let words = [];
  try {
    words = JSON.parse(row.words_json || "[]");
  } catch {
    words = [];
  }
  return {
    attemptKey: row.attempt_key,
    lessonId: row.lesson_id,
    pronunciationScore: row.pronunciation_score == null ? null : Number(row.pronunciation_score),
    accuracyScore: row.accuracy_score == null ? null : Number(row.accuracy_score),
    fluencyScore: row.fluency_score == null ? null : Number(row.fluency_score),
    completenessScore: row.completeness_score == null ? null : Number(row.completeness_score),
    prosodyScore: row.prosody_score == null ? null : Number(row.prosody_score),
    passed: Number(row.passed) === 1,
    words,
    feedbackVi: row.feedback_vi || "",
    source: "azure",
    createdAt: row.created_at,
  };
}

export async function getPassageAttempt(userId, attemptKey) {
  await ensurePassageAttemptTable();
  const [rows] = await pool.query(
    `SELECT * FROM user_learn_passage_attempts WHERE user_id = ? AND attempt_key = ? LIMIT 1`,
    [userId, attemptKey]
  );
  return rowToResult(rows?.[0]);
}

export async function savePassageAttempt({
  userId,
  attemptKey,
  lessonId,
  questionId,
  contentRevision,
  scores,
}) {
  await ensurePassageAttemptTable();
  const existing = await getPassageAttempt(userId, attemptKey);
  if (existing) return existing;
  const passed = Number(scores.pronunciationScore) >= PASSAGE_PASS_PRONUNCIATION;
  await pool.query(
    `INSERT INTO user_learn_passage_attempts
      (attempt_key, user_id, lesson_id, question_id, content_revision,
       pronunciation_score, accuracy_score, fluency_score, completeness_score, prosody_score,
       passed, words_json, feedback_vi)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      attemptKey,
      userId,
      lessonId,
      questionId,
      contentRevision || null,
      scores.pronunciationScore,
      scores.accuracyScore,
      scores.fluencyScore,
      scores.completenessScore,
      scores.prosodyScore,
      passed ? 1 : 0,
      JSON.stringify(scores.words || []).slice(0, 20000),
      String(scores.feedbackVi || "").slice(0, 600),
    ]
  );
  return getPassageAttempt(userId, attemptKey);
}

export async function passageScoreSummary(userId, lessonId, questionId) {
  await ensurePassageAttemptTable();
  const [rows] = await pool.query(
    `SELECT pronunciation_score, passed, created_at
     FROM user_learn_passage_attempts
     WHERE user_id = ? AND lesson_id = ? AND question_id = ?
     ORDER BY created_at DESC`,
    [userId, lessonId, questionId]
  );
  const list = rows || [];
  const latest = list[0] ? Number(list[0].pronunciation_score) : null;
  const best = list.reduce((max, row) => {
    const n = Number(row.pronunciation_score);
    return Number.isFinite(n) ? Math.max(max, n) : max;
  }, null);
  return {
    attempts: list.length,
    latest,
    best: list.length ? best : null,
    passedOnce: list.some((row) => Number(row.passed) === 1),
  };
}
