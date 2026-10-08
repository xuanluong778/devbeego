/**
 * Per-learner Learn chat adaptation. Not mastery, XP, Honey, or unlock.
 */

import pool from "@/lib/db";
import {
  decideLearnAdaptation,
  resolveLearnLessonDifficulty,
} from "@/lib/beego/learn/learn-lesson-difficulty";

let ready = false;

export async function ensureLearnLessonAdaptationTable() {
  if (ready) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_lesson_chat_adaptation (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      support_level VARCHAR(16) NOT NULL,
      language_complexity VARCHAR(16) NOT NULL,
      communicative_goal VARCHAR(500) NOT NULL,
      evidence_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_llca_user_lesson (user_id, lesson_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ready = true;
}

function parseEvidence(raw) {
  try {
    const value = typeof raw === "string" ? JSON.parse(raw) : raw || {};
    return {
      sessions: Array.isArray(value.sessions) ? value.sessions : [],
      signals: Array.isArray(value.signals) ? value.signals : [],
    };
  } catch {
    return { sessions: [], signals: [] };
  }
}

async function readRow(userId, lessonId) {
  await ensureLearnLessonAdaptationTable();
  const [rows] = await pool.query(
    `SELECT support_level, language_complexity, communicative_goal, evidence_json
     FROM learn_lesson_chat_adaptation
     WHERE user_id = ? AND lesson_id = ? LIMIT 1`,
    [userId, lessonId]
  );
  return rows[0] || null;
}

/**
 * Read the saved state and decide this turn. Does not write.
 */
export async function planLearnLessonAdaptation({
  userId,
  lessonId,
  level,
  objective,
  vocabularyWords,
  message,
  history,
  sessionId,
  clientRequestId,
  recordSignal = true,
}) {
  const start = resolveLearnLessonDifficulty({ lessonId, level });
  const row = await readRow(userId, lessonId);
  const evidence = parseEvidence(row?.evidence_json);
  if (
    clientRequestId &&
    evidence.signals.some((signal) => signal.clientRequestId === clientRequestId)
  ) {
    const previous = evidence.signals.find((signal) => signal.clientRequestId === clientRequestId);
    return {
      catalogLevel: start.level,
      supportLevel: previous.supportLevel,
      languageComplexity: previous.languageComplexity,
      communicativeGoal: row?.communicative_goal || objective || "",
      reason: previous.reason,
      independent: Boolean(previous.independent),
      goalMet: Boolean(previous.goalMet),
      sessions: evidence.sessions,
      duplicate: true,
      clientRequestId,
    };
  }
  const decision = decideLearnAdaptation({
    lessonId,
    level,
    objective: objective || row?.communicative_goal,
    vocabularyWords,
    message: recordSignal ? message : "",
    history,
    sessionId,
    start,
    state: row
      ? {
          supportLevel: row.support_level,
          languageComplexity: row.language_complexity,
          sessions: evidence.sessions,
        }
      : { supportLevel: start.supportLevel, languageComplexity: start.languageComplexity, sessions: [] },
  });
  return { ...decision, duplicate: false, clientRequestId };
}

export async function commitLearnLessonAdaptation({
  userId,
  lessonId,
  decision,
}) {
  if (!decision || decision.duplicate) return { saved: false };
  await ensureLearnLessonAdaptationTable();
  const existing = await readRow(userId, lessonId);
  const evidence = parseEvidence(existing?.evidence_json);
  const signals = evidence.signals.slice(-7);
  signals.push({
    clientRequestId: decision.clientRequestId || "",
    reason: decision.reason,
    supportLevel: decision.supportLevel,
    languageComplexity: decision.languageComplexity,
    independent: Boolean(decision.independent),
    goalMet: Boolean(decision.goalMet),
  });
  const payload = JSON.stringify({
    sessions: decision.sessions || [],
    signals,
  });
  await pool.query(
    `INSERT INTO learn_lesson_chat_adaptation
      (user_id, lesson_id, support_level, language_complexity, communicative_goal, evidence_json)
     VALUES (?, ?, ?, ?, ?, CAST(? AS JSON))
     ON DUPLICATE KEY UPDATE
       support_level = VALUES(support_level),
       language_complexity = VALUES(language_complexity),
       communicative_goal = VALUES(communicative_goal),
       evidence_json = VALUES(evidence_json)`,
    [
      userId,
      lessonId,
      decision.supportLevel,
      decision.languageComplexity,
      String(decision.communicativeGoal || "").slice(0, 500),
      payload,
    ]
  );
  return { saved: true };
}
