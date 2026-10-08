import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import {
  getAchievementsSnapshot,
  rejectClientUnlockAttempt,
} from "@/lib/beego/learn/achievements-engine";

export const dynamic = "force-dynamic";

/**
 * GET /api/learn/achievements — session only, evaluates unlocks server-side.
 */
export async function GET(request) {
  try {
    const rl = await checkRateLimit(request, {
      key: "learn_achievements",
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
          unlocked: [],
          inProgress: [],
          unlockedCount: 0,
          total: 0,
          message: "Đăng nhập để xem thành tích.",
        },
      });
    }
    if (user.is_active !== 1) {
      return NextResponse.json({ success: false, message: "Account blocked." }, { status: 403 });
    }

    const url = new URL(request.url);
    const bypassCache = url.searchParams.get("refresh") === "1";
    const data = await getAchievementsSnapshot(user.id, {
      bypassCache,
      evaluate: true,
    });

    return NextResponse.json({
      success: true,
      data: { guest: false, ...data },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load achievements.${detail}`.trim() },
      { status: 500 }
    );
  }
}

/**
 * POST — explicitly reject client unlock attempts (no client-driven unlock).
 */
export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    if (rejectClientUnlockAttempt(body)) {
      return NextResponse.json(
        {
          success: false,
          message: "Client unlock is not allowed.",
          code: "CLIENT_UNLOCK_FORBIDDEN",
        },
        { status: 403 }
      );
    }
    // Re-evaluate only (no client keys)
    const data = await getAchievementsSnapshot(user.id, { bypassCache: true, evaluate: true });
    return NextResponse.json({ success: true, data: { guest: false, ...data } });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to refresh achievements.${detail}`.trim() },
      { status: 500 }
    );
  }
}
