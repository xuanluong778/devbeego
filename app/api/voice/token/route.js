import { NextResponse } from "next/server";
import { signVoiceJwt } from "@/lib/voice/jwt";
import { ensureSubscriptionRow, fetchSubscriptionRow, getUserPlan } from "@/lib/subscriptions/subscription-service";
import { resolveEffectivePlanForEmail } from "@/lib/auth/admin-entitlement";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";

export const runtime = "nodejs";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user?.id) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Sign in to use voice." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    const sessionId =
      typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

    let plan = "expired";
    try {
      await ensureSubscriptionRow(user.id);
      const sub = await fetchSubscriptionRow(user.id);
      plan = resolveEffectivePlanForEmail(user.email, getUserPlan(sub));
    } catch {
      /* optional */
    }

    const token = signVoiceJwt({ sub: String(user.id), plan }, 10 * 60);

    return NextResponse.json(
      {
        success: true,
        data: {
          token,
          sessionId,
          plan,
          expires_in: 600,
        },
      },
      { headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err?.message || "Failed to create voice token." },
      { status: 500, headers: { "Cache-Control": "no-store" } }
    );
  }
}

