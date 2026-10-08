import { NextResponse } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  getLearnLessonChatRateLimit,
  isLearnLessonChatEnabled,
} from "@/lib/beego/learn/learn-lesson-chat-flags";
import { assertUserCanAccessLearnLessonChat } from "@/lib/beego/learn/learn-lesson-chat-context";
import {
  findLatestLearnLessonChatSession,
  getLearnLessonChatSessionByKey,
  getOrCreateLearnLessonChatSession,
  listSessionTurns,
} from "@/lib/beego/learn/learn-lesson-chat-store";
import { assertLearnLessonChatQuota } from "@/lib/beego/learn/learn-lesson-chat-quota";

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

/**
 * GET ?session_id= | ?lesson_id=
 * Returns session + turns for owner.
 */
export async function GET(request) {
  try {
    if (!isLearnLessonChatEnabled()) return featureDisabledResponse();

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

    const rl = await checkRateLimit(request, {
      key: "learn_lesson_chat_session_get",
      ...getLearnLessonChatRateLimit(),
    });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, code: "RATE_LIMIT", message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const url = new URL(request.url);
    const sessionKey = String(url.searchParams.get("session_id") || "").trim();
    const lessonId = String(url.searchParams.get("lesson_id") || "").trim();

    let session = null;
    if (sessionKey) {
      session = await getLearnLessonChatSessionByKey(sessionKey);
      if (!session || session.userId !== user.id) {
        return NextResponse.json(
          { success: false, code: "SESSION_NOT_FOUND", message: "Session not found." },
          { status: 404 }
        );
      }
    } else if (lessonId) {
      const access = await assertUserCanAccessLearnLessonChat(user.id, lessonId);
      if (!access.ok) {
        return NextResponse.json(
          { success: false, code: access.code, message: access.message },
          { status: access.status }
        );
      }
      session = await findLatestLearnLessonChatSession({
        userId: user.id,
        lessonId,
      });
      if (!session) {
        return NextResponse.json(
          { success: false, code: "SESSION_NOT_FOUND", message: "No Learn chat session for this lesson." },
          { status: 404 }
        );
      }
    } else {
      return NextResponse.json(
        { success: false, code: "INVALID_INPUT", message: "session_id or lesson_id required." },
        { status: 400 }
      );
    }

    const turns = await listSessionTurns(session.id, 50);
    const quota = await assertLearnLessonChatQuota(user.id);

    return NextResponse.json({
      success: true,
      data: {
        session: {
          session_id: session.sessionKey,
          lesson_id: session.lessonId,
          status: session.status,
          turn_count: session.turnCount,
          lesson: {
            lessonId: session.lessonSnapshot.lessonId || session.lessonId,
            title: session.lessonSnapshot.title || "",
            objective: session.lessonSnapshot.objective || "",
            level: session.lessonSnapshot.level || "",
            topicTitle: session.lessonSnapshot.topicTitle || "",
            vocabularyWords: session.lessonSnapshot.vocabularyWords || [],
          },
        },
        turns: turns.map((t) => ({
          turn_index: t.turnIndex,
          client_request_id: t.clientRequestId,
          source: t.source,
          user_message: t.userMessage,
          reply: t.aiReply?.reply || t.aiReplyText,
          corrected_sentence: t.aiReply?.corrected_sentence || "",
          ipa: t.aiReply?.ipa || "",
          pronunciation_tip: t.aiReply?.pronunciation_tip || "",
          mistakes_explanation: t.aiReply?.mistakes_explanation || "",
          translation: t.aiReply?.translation || "",
          status: t.status,
          created_at: t.createdAt,
        })),
        quota: {
          usage_today: quota.usageToday,
          daily_limit: quota.dailyLimit,
          usage_date: quota.usageDate,
          pooled_speaking_chat: "not_used",
        },
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: `Failed to load session.${detail}`.trim() },
      { status: 500 }
    );
  }
}

/**
 * POST { lesson_id } — create or resume active session for lesson.
 */
export async function POST(request) {
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

    const rl = await checkRateLimit(request, {
      key: "learn_lesson_chat_session_post",
      ...getLearnLessonChatRateLimit(),
    });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, code: "RATE_LIMIT", message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const body = await request.json().catch(() => ({}));
    // Reject client-supplied system prompts (ignored even if present).
    if (body.system || body.system_prompt || body.systemPrompt) {
      /* intentionally ignored */
    }

    const lessonId = String(body.lesson_id || body.lessonId || "").trim();
    const access = await assertUserCanAccessLearnLessonChat(user.id, lessonId);
    if (!access.ok) {
      return NextResponse.json(
        { success: false, code: access.code, message: access.message },
        { status: access.status }
      );
    }

    const session = await getOrCreateLearnLessonChatSession({
      userId: user.id,
      lessonId,
      lessonSnapshot: access.context,
    });
    const quota = await assertLearnLessonChatQuota(user.id);

    return NextResponse.json({
      success: true,
      data: {
        session_id: session.sessionKey,
        lesson_id: session.lessonId,
        status: session.status,
        turn_count: session.turnCount,
        lesson: {
          lessonId: access.context.lessonId,
          title: access.context.title,
          objective: access.context.objective,
          level: access.context.level,
          topicTitle: access.context.topicTitle,
          grammarPoint: access.context.grammarPoint,
          lessonType: access.context.lessonType,
          vocabularyWords: access.context.vocabularyWords,
        },
        quota: {
          usage_today: quota.usageToday,
          daily_limit: quota.dailyLimit,
          usage_date: quota.usageDate,
          pooled_speaking_chat: "not_used",
        },
      },
    });
  } catch (error) {
    const detail =
      process.env.NODE_ENV === "development" && error instanceof Error ? ` ${error.message}` : "";
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: `Failed to open session.${detail}`.trim() },
      { status: 500 }
    );
  }
}
