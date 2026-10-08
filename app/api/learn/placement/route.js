import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  applyPlacementStartChoice,
  getPlacementStatus,
  startPlacementSession,
  submitPlacementAnswer,
} from "@/lib/beego/learn/placement-engine";

export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    const data = await getPlacementStatus(user?.id || null);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to load placement status.${detail}`.trim() },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }
    const rl = await checkRateLimit(request, { key: "learn_placement", windowMs: 60_000, max: 60 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    const body = await request.json().catch(() => ({}));
    const action = String(body.action || "start").trim();

    if (action === "start") {
      const data = await startPlacementSession(user?.id || null);
      return NextResponse.json({ success: true, data });
    }

    if (action === "answer") {
      const data = await submitPlacementAnswer({
        sessionId: body.session_id || body.sessionId,
        answerKey: body.answer_key || body.answerKey,
        answer: body.answer,
        userId: user?.id || null,
        guestToken: body.guest_token || body.guestToken || null,
      });
      return NextResponse.json({ success: true, data });
    }

    if (action === "choose_start") {
      if (!user?.id) {
        return NextResponse.json({ success: false, message: "Login required." }, { status: 401 });
      }
      const choice = String(body.choice || "").trim();
      const data = await applyPlacementStartChoice(user.id, choice);
      return NextResponse.json({ success: true, data });
    }

    return NextResponse.json({ success: false, message: "Unknown action." }, { status: 400 });
  } catch (error) {
    const code = error?.code;
    const status =
      code === "FORBIDDEN"
        ? 403
        : code === "NOT_FOUND" || code === "NO_RESULT"
          ? 404
          : code === "ALREADY_DONE" || code === "NOT_ACTIVE" || code === "EXPIRED" || code === "KEY_MISMATCH" || code === "INVALID_INPUT"
            ? 400
            : 500;
    return NextResponse.json(
      { success: false, message: error?.message || "Placement failed.", code },
      { status }
    );
  }
}
