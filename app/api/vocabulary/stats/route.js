import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { ensureVocabularySchema } from "@/lib/vocabulary/ensure-schema";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";

export const dynamic = "force-dynamic";

function levelFromXp(xp) {
  return Math.max(1, Math.floor(Number(xp || 0) / 100) + 1);
}

const GUEST_STATS = {
  authenticated: false,
  learned_today: 0,
  review_due: 0,
  new_today: 0,
  pronunciation_practiced: 0,
  progress_percent: 0,
  streak_days: 0,
  total_learning: 0,
  total_words: 0,
  xp_total: 0,
  level: 1,
  mastered_count: 0,
  weak_count: 0,
  new_words: [],
  due_words: [],
  weak_words: [],
};

export async function GET(request) {
  try {
    await ensureVocabularySchema(pool);
    await ensureUserWordProgressTable();
    const [[totalWordsRow]] = await pool.query(
      "SELECT COUNT(*) AS c FROM vocabulary WHERE level = 'beginner'"
    );
    const totalWords = Number(totalWordsRow?.c || 0);

    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({
        success: true,
        data: { ...GUEST_STATS, total_words: totalWords },
      });
    }
    await ensureUserWordProgressTable();
    await ensureUserStatsTables();

    const [[learnedTodayRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress
       WHERE user_id = ? AND last_reviewed_at IS NOT NULL AND DATE(last_reviewed_at) = CURDATE()`,
      [userId]
    );

    const [[reviewDueRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress
       WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= NOW()`,
      [userId]
    );

    const [[newTodayRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress
       WHERE user_id = ? AND DATE(created_at) = CURDATE()`,
      [userId]
    );

    const [[totalLearningRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress WHERE user_id = ?`,
      [userId]
    );

    const [[masteredRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress
       WHERE user_id = ? AND (status = 'mastered' OR mastery_level >= 4)`,
      [userId]
    );

    const [[weakRow]] = await pool.query(
      `SELECT COUNT(*) AS c FROM user_word_progress
       WHERE user_id = ? AND (status = 'weak' OR wrong_count >= 2 OR (mastery_level = 0 AND wrong_count >= 1))`,
      [userId]
    );

    const [dueWordRows] = await pool.query(
      `SELECT word_id FROM user_word_progress
       WHERE user_id = ? AND next_review_at IS NOT NULL AND next_review_at <= NOW()
       ORDER BY next_review_at ASC
       LIMIT 500`,
      [userId]
    );

    const [weakWordRows] = await pool.query(
      `SELECT word_id FROM user_word_progress
       WHERE user_id = ? AND (status = 'weak' OR wrong_count >= 2)
       ORDER BY wrong_count DESC, last_reviewed_at ASC
       LIMIT 500`,
      [userId]
    );

    const [newWordRows] = await pool.query(
      `SELECT v.id AS word_id
       FROM vocabulary v
       LEFT JOIN user_word_progress p ON p.word_id = v.id AND p.user_id = ?
       WHERE v.level = 'beginner'
         AND (p.word_id IS NULL OR p.status = 'new')
       ORDER BY v.id ASC
       LIMIT 500`,
      [userId]
    );

    const [[statsRow]] = await pool.query(
      `SELECT xp_total, current_streak FROM user_stats WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    let pronunciationPracticed = 0;
    try {
      const [[pronRow]] = await pool.query(
        `SELECT COUNT(*) AS c FROM user_events
         WHERE user_id = ? AND event_type = 'pronunciation_practice' AND DATE(created_at) = CURDATE()`,
        [userId]
      );
      pronunciationPracticed = Number(pronRow?.c || 0);
    } catch {
      pronunciationPracticed = Number(learnedTodayRow?.c || 0);
    }

    const totalLearning = Number(totalLearningRow?.c || 0);
    const mastered = Number(masteredRow?.c || 0);
    const xpTotal = Number(statsRow?.xp_total || 0);
    const progressPercent =
      totalLearning > 0 ? Math.min(100, Math.round((mastered / totalLearning) * 100)) : 0;

    const dueWords = dueWordRows.map((r) => Number(r.word_id));
    const weakWords = weakWordRows.map((r) => Number(r.word_id));
    const newWords = newWordRows.map((r) => Number(r.word_id));

    return NextResponse.json({
      success: true,
      data: {
        authenticated: true,
        learned_today: Number(learnedTodayRow?.c || 0),
        review_due: Number(reviewDueRow?.c || 0),
        new_today: Number(newTodayRow?.c || 0),
        pronunciation_practiced: pronunciationPracticed,
        progress_percent: progressPercent,
        streak_days: Number(statsRow?.current_streak || 0),
        total_learning: totalLearning,
        total_words: totalWords,
        xp_total: xpTotal,
        level: levelFromXp(xpTotal),
        mastered_count: mastered,
        weak_count: Number(weakRow?.c || 0),
        new_words: newWords,
        due_words: dueWords,
        weak_words: weakWords,
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Không tải được thống kê.${detail}`.trim() },
      { status: 500 }
    );
  }
}
