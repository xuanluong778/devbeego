import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import { generateLearnLessonChatReply } from "@/lib/ai/services/learn-lesson-chat.service";
import {
  getLearnLessonChatRateLimit,
  isLearnLessonChatEnabled,
} from "@/lib/beego/learn/learn-lesson-chat-flags";
import { assertUserCanAccessLearnLessonChat } from "@/lib/beego/learn/learn-lesson-chat-context";
import {
  assertLearnLessonChatQuota,
  refundLearnLessonChatQuota,
  tryReserveLearnLessonChatQuota,
} from "@/lib/beego/learn/learn-lesson-chat-quota";
import {
  claimPendingTurn,
  closeLearnLessonChatSession,
  completePendingTurn,
  getLearnLessonChatSessionByKey,
  loadSessionHistoryForAi,
  releasePendingTurn,
} from "@/lib/beego/learn/learn-lesson-chat-store";
import {
  commitLearnLessonAdaptation,
  planLearnLessonAdaptation,
} from "@/lib/beego/learn/learn-lesson-adaptation-store";

export const dynamic = "force-dynamic";

function featureDisabledResponse() {
  return NextResponse.json(
    {
      success: false,
      code: "FEATURE_DISABLED",
      message: "Learn lesson chat is disabled. Set LEARN_LESSON_CHAT_ENABLED=1 to enable.",
    },
    { status: 503 }
  );
}

function turnPayload(turn, { duplicate = false } = {}) {
  const reply = turn.aiReply || {
    reply: turn.aiReplyText || "",
    corrected_sentence: "",
    ipa: "",
    pronunciation_tip: "",
    mistakes_explanation: "",
  };
  return {
    duplicate,
    turn_index: turn.turnIndex,
    client_request_id: turn.clientRequestId,
    reply: reply.reply || turn.aiReplyText || "",
    corrected_sentence: reply.corrected_sentence || "",
    ipa: reply.ipa || "",
    pronunciation_tip: reply.pronunciation_tip || "",
    mistakes_explanation: reply.mistakes_explanation || "",
    translation: reply.translation || "",
  };
}

/**
 * POST — send one Learn lesson chat turn.
 * Body: { session_id, message, client_request_id, source? }
 *
 * Quota: atomic reserve before AI; refund on timeout/failure.
 * Idempotent client_request_id: completed → replay (no extra quota);
 * in-flight pending → 409 TURN_IN_PROGRESS.
 */
export async function POST(request) {
  let reservedQuota = null;
  let claimedTurnId = null;
  let claimedSessionId = null;
  let userIdForRefund = null;

  try {
    if (!isLearnLessonChatEnabled()) return featureDisabledResponse();

    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json(
        { success: false, code: csrf.code, message: csrf.message },
        { status: 403 }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (!user?.id) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Sign in required." },
        { status: 401 }
      );
    }
    if (user.is_active !== 1) {
      return NextResponse.json(
        { success: false, code: "ACCOUNT_BLOCKED", message: "Account blocked." },
        { status: 403 }
      );
    }
    userIdForRefund = user.id;

    const rl = await checkRateLimit(request, {
      key: "learn_lesson_chat_turn",
      ...getLearnLessonChatRateLimit(),
    });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, code: "RATE_LIMIT", message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    void body.system;
    void body.system_prompt;
    void body.systemPrompt;
    void body.history;

    const sessionKey = String(body.session_id || body.sessionId || "").trim();
    const intent = body.intent === "wrap_up" ? "wrap_up" : "practice";
    const message =
      intent === "wrap_up"
        ? "I finished this optional lesson practice. Please give short end-of-session feedback only."
        : String(body.message || "").trim();
    const clientRequestId = String(body.client_request_id || body.clientRequestId || "")
      .trim()
      .slice(0, 64);
    const source = String(body.source || "text").toLowerCase() === "voice" ? "voice" : "text";

    if (!sessionKey) {
      return NextResponse.json(
        { success: false, code: "SESSION_REQUIRED", message: "session_id required." },
        { status: 400 }
      );
    }
    if (!message) {
      return NextResponse.json(
        { success: false, code: "MESSAGE_REQUIRED", message: "message required." },
        { status: 400 }
      );
    }
    if (!clientRequestId || clientRequestId.length < 8) {
      return NextResponse.json(
        {
          success: false,
          code: "CLIENT_REQUEST_ID_REQUIRED",
          message: "client_request_id required (min 8 chars) for idempotency.",
        },
        { status: 400 }
      );
    }

    const session = await getLearnLessonChatSessionByKey(sessionKey);
    if (!session || session.userId !== user.id) {
      return NextResponse.json(
        { success: false, code: "SESSION_NOT_FOUND", message: "Session not found." },
        { status: 404 }
      );
    }
    if (session.status !== "active") {
      return NextResponse.json(
        { success: false, code: "SESSION_CLOSED", message: "Session is closed." },
        { status: 409 }
      );
    }

    const access = await assertUserCanAccessLearnLessonChat(user.id, session.lessonId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, code: access.code, message: access.message },
        { status: access.status }
      );
    }

    const claim = await claimPendingTurn({
      sessionId: session.id,
      userId: user.id,
      lessonId: session.lessonId,
      clientRequestId,
      source,
      userMessage: message,
      intent,
    });

    if (claim.kind === "session_closed") {
      return NextResponse.json(
        { success: false, code: "SESSION_CLOSED", message: "Session is closed." },
        { status: 409 }
      );
    }

    if (claim.kind === "completed" && claim.turn) {
      if (claim.turn.source === "wrap_up") {
        await closeLearnLessonChatSession(session.id);
      }
      const snap = await assertLearnLessonChatQuota(user.id);
      return NextResponse.json({
        success: true,
        data: {
          ...turnPayload(claim.turn, { duplicate: true }),
          session_id: session.sessionKey,
          lesson_id: session.lessonId,
          quota: {
            usage_today: snap.usageToday,
            daily_limit: snap.dailyLimit,
            usage_date: snap.usageDate,
            pooled_speaking_chat: "not_used",
            note: "Idempotent replay — Learn daily quota not incremented again.",
          },
        },
      });
    }

    if (claim.kind === "pending") {
      return NextResponse.json(
        {
          success: false,
          code: "TURN_IN_PROGRESS",
          message: "This request is already being processed. Retry shortly with the same client_request_id.",
        },
        { status: 409 }
      );
    }

    claimedTurnId = claim.turnId;
    claimedSessionId = session.id;

    const reserved = await tryReserveLearnLessonChatQuota(user.id);
    if (!reserved.ok) {
      await releasePendingTurn(claimedTurnId, claimedSessionId);
      claimedTurnId = null;
      return NextResponse.json(
        {
          success: false,
          code: reserved.code,
          message: reserved.message,
          data: {
            usage_today: reserved.usageToday,
            daily_limit: reserved.dailyLimit,
            usage_date: reserved.usageDate,
            pooled_speaking_chat: "not_used",
          },
        },
        { status: reserved.status || 429 }
      );
    }
    reservedQuota = reserved;

    const history = await loadSessionHistoryForAi(session.id, 8);
    const lessonBase = session.lessonSnapshot?.lessonId ? session.lessonSnapshot : access.context;
    const adaptation = await planLearnLessonAdaptation({
      userId: user.id,
      lessonId: session.lessonId,
      level: lessonBase.level,
      objective: lessonBase.objective,
      vocabularyWords: lessonBase.vocabularyWords,
      message,
      history,
      sessionId: session.id,
      clientRequestId,
      recordSignal: intent !== "wrap_up",
    });
    const lessonContext = {
      ...lessonBase,
      wrapUp: intent === "wrap_up",
      adaptation,
      history,
      learnerMessage: intent === "wrap_up" ? "" : message,
      sessionId: session.id,
    };

    const ai = await generateLearnLessonChatReply({
      message,
      history,
      lessonContext,
      vipPriority: false,
    });

    if (!ai.ok || !ai.payload?.reply) {
      await releasePendingTurn(claimedTurnId, claimedSessionId);
      claimedTurnId = null;
      await refundLearnLessonChatQuota(user.id, reservedQuota.usageDate);
      reservedQuota = null;

      const status = ai.code === "AI_TIMEOUT" ? 504 : 502;
      return NextResponse.json(
        {
          success: false,
          code: ai.code || "AI_UNAVAILABLE",
          message:
            ai.code === "AI_TIMEOUT"
              ? "AI timed out. Please try again with the same client_request_id."
              : "AI tutor unavailable. Please try again.",
        },
        { status }
      );
    }

    const completed = await completePendingTurn(claimedTurnId, ai.payload);
    claimedTurnId = null;
    reservedQuota = null; // consumed by successful turn
    if (intent === "wrap_up") {
      await closeLearnLessonChatSession(session.id);
    } else {
      await commitLearnLessonAdaptation({
        userId: user.id,
        lessonId: session.lessonId,
        decision: adaptation,
      });
    }

    if (!completed.ok || !completed.turn) {
      await refundLearnLessonChatQuota(user.id, reserved.usageDate);
      return NextResponse.json(
        { success: false, code: "TURN_SAVE_FAILED", message: "Failed to save turn." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...turnPayload(completed.turn, { duplicate: false }),
        session_id: session.sessionKey,
        lesson_id: session.lessonId,
        quota: {
          usage_today: reserved.usageToday,
          daily_limit: reserved.dailyLimit,
          usage_date: reserved.usageDate,
          pooled_speaking_chat: "not_used",
        },
      },
    });
  } catch (error) {
    if (claimedTurnId && claimedSessionId) {
      try {
        await releasePendingTurn(claimedTurnId, claimedSessionId);
      } catch {
        /* ignore */
      }
    }
    if (reservedQuota && userIdForRefund) {
      try {
        await refundLearnLessonChatQuota(userIdForRefund, reservedQuota.usageDate);
      } catch {
        /* ignore */
      }
    }

    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: `Failed to process turn.${detail}`.trim() },
      { status: 500 }
    );
  }
}
