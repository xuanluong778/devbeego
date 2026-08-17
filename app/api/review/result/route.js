import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  ensureUserWordProgressTable,
  PROGRESS_SELECT_FIELDS,
  normalizeProgressRow,
} from "@/lib/srs/ensure-schema";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { applySrsRating } from "@/lib/srs/update-srs";
import { normalizeAnswerType, SRS_ANSWER_TYPES } from "@/lib/srs/srs-types";

export const dynamic = "force-dynamic";

const XP_BY_ANSWER = {
  [SRS_ANSWER_TYPES.FORGOT]: 0,
  [SRS_ANSWER_TYPES.HARD]: 5,
  [SRS_ANSWER_TYPES.NORMAL]: 10,
  [SRS_ANSWER_TYPES.EASY]: 12,
  [SRS_ANSWER_TYPES.MASTERED]: 15,
};

function xpForAnswerType(answerType) {
  return XP_BY_ANSWER[answerType] ?? 0;
}

function isAnswerCorrect(answerType) {
  return answerType !== SRS_ANSWER_TYPES.FORGOT;
}

export async function POST(request) {
  let conn;
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json();
    const wordId = Number(body?.word_id);
    const answerType = normalizeAnswerType(body?.answer_type, Boolean(body?.isCorrect));
    const pronunciationScore =
      body?.pronunciation_score != null ? Number(body.pronunciation_score) : null;
    const attemptId = typeof body?.attempt_id === "string" ? body.attempt_id.trim() : "";

    if (!Number.isFinite(wordId) || wordId <= 0) {
      return NextResponse.json({ success: false, message: "word_id is required." }, { status: 400 });
    }

    await ensureUserWordProgressTable();
    await ensureUserStatsTables();

    conn = await pool.getConnection();
    await conn.beginTransaction();

    if (attemptId) {
      const [evtRows] = await conn.query(
        `SELECT id, xp_delta FROM user_review_events WHERE user_id = ? AND attempt_id = ? LIMIT 1 FOR UPDATE`,
        [userId, attemptId]
      );
      if (evtRows && evtRows[0]) {
        const [pRows] = await conn.query(
          `SELECT ${PROGRESS_SELECT_FIELDS}
           FROM user_word_progress
           WHERE user_id = ? AND word_id = ?
           LIMIT 1`,
          [userId, wordId]
        );
        const [sRows] = await conn.query(
          `SELECT user_id, xp_total, current_streak, best_streak, last_active_date, last_answer_at
           FROM user_stats
           WHERE user_id = ?
           LIMIT 1`,
          [userId]
        );
        await conn.commit();
        return NextResponse.json({
          success: true,
          data: {
            user_id: userId,
            word_id: wordId,
            progress: pRows?.[0] || null,
            stats: sRows?.[0]
              ? {
                  xp_delta: Number(evtRows[0]?.xp_delta || 0),
                  xp_total: Number(sRows[0]?.xp_total || 0),
                  current_streak: Number(sRows[0]?.current_streak || 0),
                  level: Math.floor(Number(sRows[0]?.xp_total || 0) / 100) + 1,
                }
              : null,
            idempotent: true,
          },
        });
      }
    }

    const [rows] = await conn.query(
      `SELECT ${PROGRESS_SELECT_FIELDS}
       FROM user_word_progress
       WHERE user_id = ? AND word_id = ?
       LIMIT 1
       FOR UPDATE`,
      [userId, wordId]
    );
    const progress = normalizeProgressRow(rows?.[0] || null);

    const next = applySrsRating(progress, answerType, {
      pronunciationScore: Number.isFinite(pronunciationScore) ? pronunciationScore : null,
    });

    await conn.query(
      `INSERT INTO user_word_progress
        (user_id, word_id, mastery_level, mastery_score, last_reviewed_at, next_review_at,
         correct_streak, correct_count, wrong_count, lapse_count, interval_days, ease_factor,
         last_answer_type, last_pronunciation_score, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        mastery_level = VALUES(mastery_level),
        mastery_score = VALUES(mastery_score),
        last_reviewed_at = VALUES(last_reviewed_at),
        next_review_at = VALUES(next_review_at),
        correct_streak = VALUES(correct_streak),
        correct_count = VALUES(correct_count),
        wrong_count = VALUES(wrong_count),
        lapse_count = VALUES(lapse_count),
        interval_days = VALUES(interval_days),
        ease_factor = VALUES(ease_factor),
        last_answer_type = VALUES(last_answer_type),
        last_pronunciation_score = VALUES(last_pronunciation_score),
        status = VALUES(status),
        updated_at = CURRENT_TIMESTAMP`,
      [
        userId,
        wordId,
        next.mastery_level,
        next.mastery_score,
        next.last_reviewed_at,
        next.next_review_at,
        next.correct_streak,
        next.correct_count,
        next.wrong_count,
        next.lapse_count,
        next.interval_days,
        next.ease_factor,
        next.last_answer_type,
        next.last_pronunciation_score,
        next.status,
      ]
    );

    const xpDelta = xpForAnswerType(answerType);
    const correct = isAnswerCorrect(answerType);

    await conn.query(`INSERT INTO user_stats (user_id) VALUES (?) ON DUPLICATE KEY UPDATE user_id = user_id`, [
      userId,
    ]);
    await conn.query(
      `UPDATE user_stats
       SET xp_total = xp_total + ?,
           current_streak = CASE
             WHEN last_active_date = CURDATE() THEN current_streak
             WHEN last_active_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN current_streak + 1
             ELSE 1
           END,
           best_streak = GREATEST(
             best_streak,
             CASE
               WHEN last_active_date = CURDATE() THEN current_streak
               WHEN last_active_date = DATE_SUB(CURDATE(), INTERVAL 1 DAY) THEN current_streak + 1
               ELSE 1
             END
           ),
           last_active_date = CURDATE(),
           last_answer_at = NOW(),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = ?`,
      [xpDelta, userId]
    );

    const [sRows2] = await conn.query(
      `SELECT xp_total, current_streak FROM user_stats WHERE user_id = ? LIMIT 1`,
      [userId]
    );
    const xpTotal = Number(sRows2?.[0]?.xp_total || 0);
    const nextStreak = Number(sRows2?.[0]?.current_streak || 0);
    const level = Math.max(1, Math.floor(xpTotal / 100) + 1);

    if (attemptId) {
      await conn.query(
        `INSERT INTO user_review_events (user_id, attempt_id, word_id, is_correct, xp_delta)
         VALUES (?, ?, ?, ?, ?)`,
        [userId, attemptId, wordId, correct ? 1 : 0, xpDelta]
      );
    }

    try {
      await conn.query(
        `INSERT IGNORE INTO user_events (user_id, attempt_id, event_type, word_id, is_correct)
         VALUES (?, ?, 'quiz_answer', ?, ?)`,
        [userId, attemptId || null, wordId, correct ? 1 : 0]
      );
    } catch (_e) {
      /* analytics optional */
    }

    await conn.commit();
    return NextResponse.json({
      success: true,
      data: {
        user_id: userId,
        word_id: wordId,
        progress: next,
        stats: {
          xp_delta: xpDelta,
          xp_total: xpTotal,
          current_streak: nextStreak,
          level,
        },
      },
    });
  } catch (error) {
    try {
      await conn?.rollback?.();
    } catch (_e) {}
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to update review result.${detail}`.trim() },
      { status: 500 }
    );
  } finally {
    try {
      conn?.release?.();
    } catch (_e) {}
  }
}
