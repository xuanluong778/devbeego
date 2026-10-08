import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { ensureVocabularySchema } from "@/lib/vocabulary/ensure-schema";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    await ensureVocabularySchema(pool);
    await ensureUserWordProgressTable();
    await ensureUserStatsTables();

    const NEW_TARGET = 10;
    const baseWordWhere = `word IS NOT NULL AND TRIM(word) <> ''`;

    const [[beginnerCount]] = await pool.query(
      `SELECT COUNT(*) AS total FROM vocabulary WHERE level = 'beginner' AND ${baseWordWhere}`
    );
    const hasBeginner = Number(beginnerCount?.total || 0) > 0;
    const levelSql = hasBeginner ? "v.level = 'beginner'" : "1=1";

    const [[reviewRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM user_word_progress p
       INNER JOIN vocabulary v ON v.id = p.word_id
       WHERE p.user_id = ?
         AND p.next_review_at IS NOT NULL
         AND p.next_review_at <= NOW()
         AND ${levelSql}
         AND ${baseWordWhere}`,
      [userId]
    );
    const review_count = Number(reviewRow?.total || 0);

    const [[newRow]] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM vocabulary v
       WHERE ${levelSql}
         AND ${baseWordWhere}
         AND NOT EXISTS (
           SELECT 1 FROM user_word_progress p
           WHERE p.user_id = ? AND p.word_id = v.id
         )`,
      [userId]
    );
    const new_words_count = Number(newRow?.total || 0);

    const [statsRows] = await pool.query(
      `SELECT xp_total, honey_total, current_streak, active_lesson_id
       FROM user_stats
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );
    const stats = statsRows?.[0] || {
      xp_total: 0,
      honey_total: 0,
      current_streak: 0,
      active_lesson_id: null,
    };

    const [[todayRow]] = await pool.query(
      `SELECT
        COUNT(*) AS completed_today,
        COALESCE(SUM(xp_delta), 0) AS xp_today
       FROM user_review_events
       WHERE user_id = ?
         AND created_at >= CURDATE()
         AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`,
      [userId]
    );
    const completed_today = Number(todayRow?.completed_today || 0);
    const xp_today = Number(todayRow?.xp_today || 0);
    const denom = Math.max(1, review_count + NEW_TARGET);
    const daily_progress = Math.max(0, Math.min(100, Math.round((completed_today / denom) * 100)));

    return NextResponse.json({
      success: true,
      data: {
        review_count,
        daily_progress,
        xp_today,
        new_target: NEW_TARGET,
        completed_today,
        new_words_count,
        xp_total: Number(stats.xp_total || 0),
        honey_total: Number(stats.honey_total || 0),
        streak: Number(stats.current_streak || 0),
        active_lesson_id: stats.active_lesson_id || null,
      },
    });
  } catch (error) {
    // Fallback if honey_total column not migrated yet
    if (String(error?.message || "").includes("honey_total") || error?.errno === 1054) {
      try {
        const userId = await getSessionUserIdFromRequest(request);
        if (!userId) {
          return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
        }
        const [statsRows] = await pool.query(
          `SELECT xp_total, current_streak FROM user_stats WHERE user_id = ? LIMIT 1`,
          [userId]
        );
        const stats = statsRows?.[0] || { xp_total: 0, current_streak: 0 };
        return NextResponse.json({
          success: true,
          data: {
            review_count: 0,
            daily_progress: 0,
            xp_today: 0,
            new_target: 10,
            completed_today: 0,
            new_words_count: 0,
            xp_total: Number(stats.xp_total || 0),
            honey_total: Number(stats.xp_total || 0),
            streak: Number(stats.current_streak || 0),
            active_lesson_id: null,
          },
        });
      } catch {
        /* fall through */
      }
    }
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load dashboard.${detail}`.trim() },
      { status: 500 }
    );
  }
}

