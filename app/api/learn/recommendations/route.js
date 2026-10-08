import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getPersonalizedRecommendations } from "@/lib/beego/learn/recommendation-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/learn/recommendations
 * Optional survey query: purpose, focus, dailyMinutes
 * Auth only — never accepts user_id (no IDOR).
 */
export async function GET(request) {
  try {
    const rl = await checkRateLimit(request, {
      key: "learn_recommendations",
      windowMs: 60_000,
      max: 90,
    });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({
        success: true,
        data: {
          guest: true,
          recommendations: [],
          message: "Đăng nhập để nhận đề xuất cá nhân hóa.",
        },
      });
    }
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const url = new URL(request.url);
    // Ignore any user_id / target_user query (anti-IDOR)
    const purpose = url.searchParams.get("purpose") || "";
    const focus = url.searchParams.get("focus") || "";
    const dailyMinutesRaw = url.searchParams.get("dailyMinutes") || url.searchParams.get("daily_minutes");
    const dailyMinutes = dailyMinutesRaw != null ? Number(dailyMinutesRaw) : undefined;
    const bypassCache = url.searchParams.get("refresh") === "1";

    const data = await getPersonalizedRecommendations(user.id, {
      purpose,
      focus,
      dailyMinutes: Number.isFinite(dailyMinutes) ? dailyMinutes : undefined,
      bypassCache,
    });

    return NextResponse.json({
      success: true,
      data: {
        guest: false,
        ...data,
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load recommendations.${detail}`.trim() },
      { status: 500 }
    );
  }
}
