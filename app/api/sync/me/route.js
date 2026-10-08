import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { getLearningPathForUser } from "@/lib/beego/learning-path-progress";
import { ensureUserStatsTables } from "@/lib/srs/ensure-stats";
import { ensureUserWordProgressTable } from "@/lib/srs/ensure-schema";
import {
  getPooledDailyLimit,
  getUserPlan,
  loadSubscriptionAndUsageToday,
  VIP_EFFECTIVELY_UNLIMITED,
} from "@/lib/subscriptions/subscription-service";
import { resolveEffectivePlanForEmail, shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Single sync payload for Web + Android — backend is source of truth.
 */
export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    await ensureUserStatsTables();
    await ensureUserWordProgressTable();

    const path = await getLearningPathForUser(user.id);
    const subUsage = await loadSubscriptionAndUsageToday(user.id);
    const rawPlan = subUsage ? getUserPlan(subUsage.subscription) : "expired";
    const adminBypass = shouldBypassEntitlementsForEmail(user.email);
    const planState = resolveEffectivePlanForEmail(user.email, rawPlan);
    const dailyLimit = adminBypass ? VIP_EFFECTIVELY_UNLIMITED : getPooledDailyLimit(planState);
    const usageToday = adminBypass ? 0 : subUsage?.usageToday ?? 0;

    const [[vocab]] = await pool.query(
      `SELECT COUNT(*) AS learned FROM user_word_progress WHERE user_id = ?`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      synced_at: new Date().toISOString(),
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          avatar_url: user.avatar_url ?? null,
        },
        progress: path.progress,
        learning_path: {
          active_lesson_id: path.activeLessonId,
          current_section_id: path.currentSectionId,
          completed_count: path.progress?.completed_count ?? 0,
          sections: path.sections,
        },
        vocabulary: {
          words_learned: Number(vocab?.learned || 0),
        },
        subscription: {
          plan_state: planState,
          plan: subUsage?.subscription?.plan ?? "free",
          usage_today: usageToday,
          daily_limit: dailyLimit,
          quota_remaining: Math.max(0, dailyLimit - usageToday),
          trial_end_at: subUsage?.subscription?.trial_end_at ?? null,
          expires_at: subUsage?.subscription?.expires_at ?? null,
          source: subUsage?.subscription?.source ?? null,
        },
      },
    });
  } catch (error) {
    console.error("[sync/me]", error);
    return NextResponse.json({ success: false, message: "Sync failed." }, { status: 500 });
  }
}
