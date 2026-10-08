import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  getGuestDailyMotivation,
  getLearnDailyMotivation,
  updateLearnDailySettings,
} from "@/lib/beego/learn/daily-goal-streak-engine";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: true, data: getGuestDailyMotivation() });
    }
    const data = await getLearnDailyMotivation(user.id);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load daily goal.${detail}`.trim() },
      { status: 500 }
    );
  }
}

export async function PATCH(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const rl = await checkRateLimit(request, { key: "learn_daily_goal", windowMs: 60_000, max: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const dailyGoalXp =
      body.daily_goal_xp != null || body.dailyGoalXp != null
        ? Number(body.daily_goal_xp ?? body.dailyGoalXp)
        : undefined;
    const timezone = body.timezone != null ? String(body.timezone) : undefined;

    const data = await updateLearnDailySettings(user.id, { dailyGoalXp, timezone });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to update daily goal.${detail}`.trim() },
      { status: 500 }
    );
  }
}
