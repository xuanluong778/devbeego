import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { getLearnAnalytics } from "@/lib/beego/learn/analytics-insights-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/learn/analytics
 * Session user only — ignores user_id query (anti-IDOR).
 */
export async function GET(request) {
  try {
    const rl = await checkRateLimit(request, {
      key: "learn_analytics",
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
          analytics: null,
          insights: [
            {
              code: "GUEST",
              severity: "info",
              text: "Đăng nhập để xem tiến độ học tập của bạn.",
              skillKey: null,
            },
          ],
        },
      });
    }
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const url = new URL(request.url);
    const bypassCache = url.searchParams.get("refresh") === "1";
    const data = await getLearnAnalytics(user.id, { bypassCache });

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
      { success: false, message: `Failed to load analytics.${detail}`.trim() },
      { status: 500 }
    );
  }
}
