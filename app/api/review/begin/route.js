import { NextResponse } from "next/server";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { issueReviewAttempt } from "@/lib/srs/review-attempts";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }

    const rl = await checkRateLimit(request, { key: "review_begin", windowMs: 60_000, max: 120 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const wordId = Number(body?.word_id);
    if (!Number.isFinite(wordId) || wordId <= 0) {
      return NextResponse.json({ success: false, message: "word_id is required." }, { status: 400 });
    }

    const attempt = await issueReviewAttempt(userId, wordId);
    return NextResponse.json({ success: true, data: attempt });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, message: `Failed to start review attempt.${detail}`.trim() },
      { status: 500 }
    );
  }
}
