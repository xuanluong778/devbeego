/**
 * Persistence for Learn lesson chat sessions/turns (not lesson_chat_logs).
 * Pending claim + unique turn_index prevent concurrent order/quota races.
 */

import crypto from "node:crypto";
import pool from "@/lib/db";

let schemaReady = false;

export async function ensureLearnLessonChatTables() {
  if (schemaReady) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_lesson_chat_sessions (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_key CHAR(36) NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      status ENUM('active', 'closed') NOT NULL DEFAULT 'active',
      lesson_snapshot_json JSON NULL,
      turn_count INT UNSIGNED NOT NULL DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      UNIQUE KEY uq_llcs_session_key (session_key),
      KEY idx_llcs_user_lesson_status (user_id, lesson_id, status),
      KEY idx_llcs_user_updated (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS learn_lesson_chat_turns (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      session_id BIGINT UNSIGNED NOT NULL,
      user_id BIGINT UNSIGNED NOT NULL,
      lesson_id VARCHAR(64) NOT NULL,
      turn_index INT UNSIGNED NOT NULL,
      client_request_id VARCHAR(64) NOT NULL,
      source VARCHAR(20) NOT NULL DEFAULT 'text',
      user_message TEXT NOT NULL,
      ai_reply_json JSON NULL,
      ai_reply_text TEXT NULL,
      status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending',
      error_code VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_llct_session_client_req (session_id, client_request_id),
      UNIQUE KEY uq_llct_session_turn_index (session_id, turn_index),
      KEY idx_llct_session_turn (session_id, turn_index),
      KEY idx_llct_user_lesson (user_id, lesson_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  try {
    await pool.query(`
      ALTER TABLE learn_lesson_chat_turns
        MODIFY COLUMN status ENUM('pending', 'completed', 'failed') NOT NULL DEFAULT 'pending'
    `);
  } catch {
    /* already applied */
  }
  try {
    await pool.query(`
      ALTER TABLE learn_lesson_chat_turns
        ADD UNIQUE KEY uq_llct_session_turn_index (session_id, turn_index)
    `);
  } catch {
    /* already applied */
  }

  schemaReady = true;
}

function newSessionKey() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return crypto.randomBytes(16).toString("hex").replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, "$1-$2-$3-$4-$5");
}

export async function findLatestLearnLessonChatSession({ userId, lessonId }) {
  await ensureLearnLessonChatTables();
  const lid = String(lessonId || "").trim();
  const [rows] = await pool.query(
    `SELECT id, session_key, user_id, lesson_id, status, lesson_snapshot_json, turn_count, created_at, updated_at
     FROM learn_lesson_chat_sessions
     WHERE user_id = ? AND lesson_id = ?
     ORDER BY (status = 'active') DESC, id DESC
     LIMIT 1`,
    [userId, lid]
  );
  if (!rows[0]) return null;
  return sealSessionIfWrapUpSaved(mapSession(rows[0]));
}

export async function closeLearnLessonChatSession(sessionId) {
  await ensureLearnLessonChatTables();
  await pool.query(
    `UPDATE learn_lesson_chat_sessions
     SET status = 'closed', updated_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'active'`,
    [sessionId]
  );
}

async function sealSessionIfWrapUpSaved(session) {
  if (!session || session.status === "closed") return session;
  const [rows] = await pool.query(
    `SELECT id FROM learn_lesson_chat_turns
     WHERE session_id = ? AND source = 'wrap_up' AND status = 'completed'
     LIMIT 1`,
    [session.id]
  );
  if (!rows[0]) return session;
  await closeLearnLessonChatSession(session.id);
  return { ...session, status: "closed" };
}

export async function getOrCreateLearnLessonChatSession({ userId, lessonId, lessonSnapshot }) {
  await ensureLearnLessonChatTables();
  const lid = String(lessonId || "").trim();

  const existing = await findLatestLearnLessonChatSession({ userId, lessonId: lid });
  if (existing) return existing;

  const sessionKey = newSessionKey();
  const snapshotJson = JSON.stringify(lessonSnapshot || {});
  try {
    const [result] = await pool.query(
      `INSERT INTO learn_lesson_chat_sessions
        (session_key, user_id, lesson_id, status, lesson_snapshot_json, turn_count)
       VALUES (?, ?, ?, 'active', CAST(? AS JSON), 0)`,
      [sessionKey, userId, lid, snapshotJson]
    );
    return {
      id: Number(result.insertId),
      sessionKey,
      userId,
      lessonId: lid,
      status: "active",
      lessonSnapshot: lessonSnapshot || {},
      turnCount: 0,
    };
  } catch (err) {
    if (err && (err.code === "ER_DUP_ENTRY" || Number(err.errno) === 1062)) {
      const [again] = await pool.query(
        `SELECT id, session_key, user_id, lesson_id, status, lesson_snapshot_json, turn_count, created_at, updated_at
         FROM learn_lesson_chat_sessions
         WHERE user_id = ? AND lesson_id = ? AND status = 'active'
         ORDER BY id DESC LIMIT 1`,
        [userId, lid]
      );
      if (again[0]) return mapSession(again[0]);
    }
    throw err;
  }
}

export async function getLearnLessonChatSessionByKey(sessionKey) {
  await ensureLearnLessonChatTables();
  const key = String(sessionKey || "").trim();
  if (!key) return null;
  const [rows] = await pool.query(
    `SELECT id, session_key, user_id, lesson_id, status, lesson_snapshot_json, turn_count, created_at, updated_at
     FROM learn_lesson_chat_sessions WHERE session_key = ? LIMIT 1`,
    [key]
  );
  return rows[0] ? mapSession(rows[0]) : null;
}

function mapSession(row) {
  let snapshot = {};
  try {
    snapshot =
      typeof row.lesson_snapshot_json === "string"
        ? JSON.parse(row.lesson_snapshot_json)
        : row.lesson_snapshot_json || {};
  } catch {
    snapshot = {};
  }
  return {
    id: Number(row.id),
    sessionKey: String(row.session_key),
    userId: Number(row.user_id),
    lessonId: String(row.lesson_id),
    status: String(row.status),
    lessonSnapshot: snapshot,
    turnCount: Number(row.turn_count || 0),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findTurnByClientRequestId(sessionId, clientRequestId) {
  await ensureLearnLessonChatTables();
  const [rows] = await pool.query(
    `SELECT id, session_id, user_id, lesson_id, turn_index, client_request_id, source,
            user_message, ai_reply_json, ai_reply_text, status, error_code, created_at
     FROM learn_lesson_chat_turns
     WHERE session_id = ? AND client_request_id = ?
     LIMIT 1`,
    [sessionId, String(clientRequestId || "").trim()]
  );
  return rows[0] ? mapTurn(rows[0]) : null;
}

/**
 * Claim a pending turn under session lock.
 * @returns {{ kind: 'completed'|'pending'|'claimed'|'session_closed', turn?: object, turnIndex?: number, turnId?: number }}
 */
export async function claimPendingTurn({
  sessionId,
  userId,
  lessonId,
  clientRequestId,
  source,
  userMessage,
  intent = "practice",
}) {
  await ensureLearnLessonChatTables();
  const conn = await pool.getConnection();
  const reqId = String(clientRequestId || "").trim();

  try {
    await conn.beginTransaction();

    const [sessions] = await conn.query(
      `SELECT id, turn_count, status FROM learn_lesson_chat_sessions WHERE id = ? FOR UPDATE`,
      [sessionId]
    );
    const sess = sessions[0];
    if (!sess || String(sess.status) !== "active") {
      await conn.rollback();
      return { kind: "session_closed" };
    }

    const [existingRows] = await conn.query(
      `SELECT id, session_id, user_id, lesson_id, turn_index, client_request_id, source,
              user_message, ai_reply_json, ai_reply_text, status, error_code, created_at
       FROM learn_lesson_chat_turns
       WHERE session_id = ? AND client_request_id = ?
       LIMIT 1 FOR UPDATE`,
      [sessionId, reqId]
    );

    if (existingRows[0]) {
      const turn = mapTurn(existingRows[0]);
      if (turn.status === "completed") {
        if (turn.source === "wrap_up") {
          await conn.query(
            `UPDATE learn_lesson_chat_sessions SET status = 'closed' WHERE id = ? AND status = 'active'`,
            [sessionId]
          );
        }
        await conn.commit();
        return { kind: "completed", turn };
      }
      if (turn.status === "pending") {
        await conn.commit();
        return { kind: "pending", turn };
      }
      // failed → delete so same client_request_id can retry
      await conn.query(`DELETE FROM learn_lesson_chat_turns WHERE id = ?`, [turn.id]);
    }

    const [wrapRows] = await conn.query(
      `SELECT id, session_id, user_id, lesson_id, turn_index, client_request_id, source,
              user_message, ai_reply_json, ai_reply_text, status, error_code, created_at
       FROM learn_lesson_chat_turns
       WHERE session_id = ? AND source = 'wrap_up' AND status IN ('pending', 'completed')
       LIMIT 1 FOR UPDATE`,
      [sessionId]
    );
    if (wrapRows[0]) {
      const wrap = mapTurn(wrapRows[0]);
      if (wrap.status === "completed") {
        await conn.query(
          `UPDATE learn_lesson_chat_sessions SET status = 'closed' WHERE id = ? AND status = 'active'`,
          [sessionId]
        );
        await conn.commit();
        return { kind: "completed", turn: wrap };
      }
      await conn.commit();
      return { kind: "pending", turn: wrap };
    }

    const turnSource = intent === "wrap_up" ? "wrap_up" : source === "voice" ? "voice" : "text";
    const turnIndex = Number(sess.turn_count || 0) + 1;
    const [ins] = await conn.query(
      `INSERT INTO learn_lesson_chat_turns
        (session_id, user_id, lesson_id, turn_index, client_request_id, source,
         user_message, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [sessionId, userId, lessonId, turnIndex, reqId, turnSource, userMessage]
    );
    await conn.query(
      `UPDATE learn_lesson_chat_sessions
       SET turn_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [turnIndex, sessionId]
    );
    await conn.commit();
    return { kind: "claimed", turnId: Number(ins.insertId), turnIndex };
  } catch (err) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    if (err && (err.code === "ER_DUP_ENTRY" || Number(err.errno) === 1062)) {
      const existing = await findTurnByClientRequestId(sessionId, reqId);
      if (existing?.status === "completed") return { kind: "completed", turn: existing };
      if (existing?.status === "pending") return { kind: "pending", turn: existing };
    }
    throw err;
  } finally {
    conn.release();
  }
}

export async function completePendingTurn(turnId, aiPayload) {
  await ensureLearnLessonChatTables();
  const replyText = String(aiPayload?.reply || "").trim();
  const replyJson = JSON.stringify(aiPayload || {});
  await pool.query(
    `UPDATE learn_lesson_chat_turns
     SET status = 'completed',
         ai_reply_json = CAST(? AS JSON),
         ai_reply_text = ?,
         error_code = NULL
     WHERE id = ? AND status = 'pending'`,
    [replyJson, replyText, turnId]
  );
  const [rows] = await pool.query(
    `SELECT id, session_id, user_id, lesson_id, turn_index, client_request_id, source,
            user_message, ai_reply_json, ai_reply_text, status, error_code, created_at
     FROM learn_lesson_chat_turns WHERE id = ? LIMIT 1`,
    [turnId]
  );
  if (!rows[0]) return { ok: false };
  return { ok: true, turn: mapTurn(rows[0]) };
}

/**
 * Delete pending turn after AI failure/timeout so retry can reuse client_request_id.
 */
export async function releasePendingTurn(turnId, sessionId) {
  await ensureLearnLessonChatTables();
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const [turns] = await conn.query(
      `SELECT id, turn_index, status FROM learn_lesson_chat_turns WHERE id = ? FOR UPDATE`,
      [turnId]
    );
    const turn = turns[0];
    if (!turn || String(turn.status) !== "pending") {
      await conn.rollback();
      return { released: false };
    }
    await conn.query(`DELETE FROM learn_lesson_chat_turns WHERE id = ? AND status = 'pending'`, [
      turnId,
    ]);
    await conn.query(
      `UPDATE learn_lesson_chat_sessions
       SET turn_count = IF(turn_count = ?, GREATEST(turn_count - 1, 0), turn_count),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [Number(turn.turn_index), sessionId]
    );
    await conn.commit();
    return { released: true };
  } catch (e) {
    try {
      await conn.rollback();
    } catch {
      /* ignore */
    }
    throw e;
  } finally {
    conn.release();
  }
}

export async function loadSessionHistoryForAi(sessionId, limit = 10) {
  await ensureLearnLessonChatTables();
  const [rows] = await pool.query(
    `SELECT user_message, ai_reply_text
     FROM learn_lesson_chat_turns
     WHERE session_id = ? AND status = 'completed'
     ORDER BY turn_index DESC
     LIMIT ?`,
    [sessionId, limit]
  );
  const history = [];
  for (const row of rows.reverse()) {
    const u = String(row.user_message || "").trim();
    const a = String(row.ai_reply_text || "").trim();
    if (u) history.push({ role: "user", content: u });
    if (a) history.push({ role: "assistant", content: a.split("\n")[0] });
  }
  return history.slice(-10);
}

export async function listSessionTurns(sessionId, limit = 40) {
  await ensureLearnLessonChatTables();
  const [rows] = await pool.query(
    `SELECT id, turn_index, client_request_id, source, user_message, ai_reply_json, ai_reply_text, status, created_at
     FROM learn_lesson_chat_turns
     WHERE session_id = ? AND status IN ('completed', 'pending')
     ORDER BY turn_index ASC
     LIMIT ?`,
    [sessionId, limit]
  );
  return rows.map(mapTurn);
}

function mapTurn(row) {
  let aiReply = null;
  try {
    aiReply =
      typeof row.ai_reply_json === "string"
        ? JSON.parse(row.ai_reply_json)
        : row.ai_reply_json;
  } catch {
    aiReply = null;
  }
  return {
    id: Number(row.id),
    sessionId: Number(row.session_id || 0),
    turnIndex: Number(row.turn_index),
    clientRequestId: String(row.client_request_id || ""),
    source: String(row.source || "text"),
    userMessage: String(row.user_message || ""),
    aiReply,
    aiReplyText: String(row.ai_reply_text || ""),
    status: String(row.status || ""),
    errorCode: row.error_code || null,
    createdAt: row.created_at,
  };
}
