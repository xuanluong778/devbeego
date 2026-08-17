import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { ensureVocabularySchema } from "@/lib/vocabulary/ensure-schema";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import {
  getPooledDailyLimit,
  getUserPlan,
  loadSubscriptionAndUsageToday,
  VIP_EFFECTIVELY_UNLIMITED,
} from "@/lib/subscriptions/subscription-service";
import { resolveEffectivePlanForEmail, shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { ensureChatLogTable } from "@/lib/data/lesson-chat-logs";

export const dynamic = "force-dynamic";

function pct(correct: number, total: number) {
  if (!total) return 0;
  return Math.round((correct / total) * 100);
}

export async function GET(request: Request) {
  try {
    const user = await getSessionUserFromRequest(request as never);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const userId = user.id;
    await ensureVocabularySchema(pool);
    await ensureUserWordProgressTable();
    await ensureUserStatsTables();
    await ensureChatLogTable();

    const NEW_TARGET = 10;
    const baseWordWhere = `word IS NOT NULL AND TRIM(word) <> ''`;

    const [[reviewRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM user_word_progress p
       INNER JOIN vocabulary v ON v.id = p.word_id
       WHERE p.user_id = ? AND p.next_review_at IS NOT NULL AND p.next_review_at <= NOW()
         AND ${baseWordWhere}`,
      [userId]
    );
    const review_count = Number(reviewRow?.total || 0);

    const [[newRow]] = await pool.query(
      `SELECT COUNT(*) AS total FROM vocabulary v
       WHERE ${baseWordWhere}
         AND NOT EXISTS (SELECT 1 FROM user_word_progress p WHERE p.user_id = ? AND p.word_id = v.id)`,
      [userId]
    );
    const new_words_count = Number(newRow?.total || 0);

    const [statsRows] = await pool.query(
      "SELECT xp_total, current_streak FROM user_stats WHERE user_id = ? LIMIT 1",
      [userId]
    );
    const stats = statsRows?.[0] || { xp_total: 0, current_streak: 0 };

    const [[todayRow]] = await pool.query(
      `SELECT COUNT(*) AS completed_today, COALESCE(SUM(xp_delta), 0) AS xp_today
       FROM user_review_events
       WHERE user_id = ? AND created_at >= CURDATE() AND created_at < DATE_ADD(CURDATE(), INTERVAL 1 DAY)`,
      [userId]
    );
    const completed_today = Number(todayRow?.completed_today || 0);
    const xp_today = Number(todayRow?.xp_today || 0);
    const daily_progress = Math.max(
      0,
      Math.min(100, Math.round((completed_today / Math.max(1, review_count + NEW_TARGET)) * 100))
    );

    const [[wordsLearned]] = await pool.query(
      "SELECT COUNT(*) AS total FROM user_word_progress WHERE user_id = ?",
      [userId]
    );

    const [weakRows] = await pool.query(
      `SELECT v.word, COUNT(*) AS attempts,
              ROUND(SUM(CASE WHEN e.is_correct = 1 THEN 1 ELSE 0 END) / COUNT(*) * 100) AS correct_rate
       FROM user_events e
       INNER JOIN vocabulary v ON v.id = e.word_id
       WHERE e.user_id = ? AND e.event_type = 'quiz_answer'
         AND e.created_at >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
       GROUP BY v.id, v.word
       HAVING COUNT(*) >= 2
       ORDER BY correct_rate ASC, attempts DESC
       LIMIT 6`,
      [userId]
    );

    const [[pronRow]] = await pool.query(
      `SELECT ROUND(AVG(pronunciation_score)) AS avg_score, COUNT(*) AS sessions
       FROM lesson_chat_logs
       WHERE user_id = ? AND pronunciation_score IS NOT NULL`,
      [userId]
    );

    const [aiRecent] = await pool.query(
      `SELECT id, source, message, pronunciation_score, created_at
       FROM lesson_chat_logs WHERE user_id = ?
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    const subUsage = await loadSubscriptionAndUsageToday(userId);
    const rawPlanState = subUsage ? getUserPlan(subUsage.subscription) : "expired";
    const adminBypass = shouldBypassEntitlementsForEmail(user.email);
    const planState = resolveEffectivePlanForEmail(user.email, rawPlanState);
    const dailyLimit = adminBypass ? VIP_EFFECTIVELY_UNLIMITED : getPooledDailyLimit(planState);
    const usageToday = adminBypass ? 0 : subUsage?.usageToday ?? 0;

    const xpTotal = Number(stats.xp_total || 0);
    const level = Math.max(1, Math.floor(xpTotal / 500) + 1);

    return NextResponse.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          is_admin: adminBypass,
          hide_billing_ui: adminBypass,
        },
        today: {
          review_count,
          new_words_count,
          daily_progress,
          completed_today,
          xp_today,
          new_target: NEW_TARGET,
          suggestion:
            review_count > 0
              ? `Hôm nay có ${review_count} từ cần ôn — bắt đầu ngay!`
              : new_words_count > 0
              ? "Học 10 từ mới hôm nay để giữ streak."
              : "Bạn đã hoàn thành mục tiêu hôm nay — thử AI Call!",
        },
        progress: {
          xp_total: xpTotal,
          xp_today,
          streak: Number(stats.current_streak || 0),
          level,
          words_learned: Number(wordsLearned?.total || 0),
          daily_progress,
        },
        weak_words: (weakRows as Record<string, unknown>[]).map((r) => ({
          word: String(r.word || ""),
          correct_rate: Number(r.correct_rate || 0),
          attempts: Number(r.attempts || 0),
        })),
        pronunciation: {
          avg_score: pronRow?.avg_score != null ? Number(pronRow.avg_score) : null,
          sessions: Number(pronRow?.sessions || 0),
        },
        ai_calls: aiRecent,
        subscription: {
          plan_state: planState,
          plan: subUsage?.subscription.plan ?? "free",
          usage_today: usageToday,
          daily_limit: dailyLimit,
          quota_remaining: Math.max(0, dailyLimit - usageToday),
          trial_end_at: subUsage?.subscription.trial_end_at ?? null,
          expires_at: subUsage?.subscription.expires_at ?? null,
        },
        ctas: {
          continue_learning: review_count > 0 ? "/quiz?mode=review" : "/quiz",
          ai_call: "/luyen-noi",
          review_vocab: "/vocabulary",
          practice_errors: weakRows.length ? "/quiz?mode=review" : "/pronunciation",
        },
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load dashboard.${detail}`.trim() },
      { status: 500 }
    );
  }
}
