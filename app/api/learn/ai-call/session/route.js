import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { getUserPlan } from "@/lib/subscriptions/subscription-service";
import { signVoiceJwt } from "@/lib/voice/jwt";
import { getVoiceRedis } from "@/lib/voice/redis";
import {
  LEARN_AI_CALL_PURPOSE,
  decideLearnAiCallAccess,
  isOrdinaryLessonCall,
  claimLearnCallOpenLock,
  finalizeLearnCallSession,
  learnAiCallContextKey,
  learnAiCallEmailAllowed,
  learnAiCallGateOpen,
  learnAiCallEnabled,
  learnAiCallLevelOneHints,
  learnAiCallLevelOneLimits,
  learnAiCallPackageAllowanceMs,
  learnAiCallSessionKey,
  learnAiCallWsUrl,
  learnCallOpenLockTtlSeconds,
  releaseLearnCallOpenLock,
  readLearnCallPackage,
  resolveUnlockedGateCall,
} from "@/lib/beego/learn/ai-call-access";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import {
  LEARN_CALL_DIFFICULTY_KEYS,
  learnCallContextFromLesson,
  learnCallDifficulty,
  learnCallLearningNotes,
} from "@/lib/beego/learn/learn-call-tutor";
import { learnCallTeacher } from "@/lib/beego/learn/learn-call-teachers";
import { getLearningPathForUser } from "@/lib/beego/learning-path-progress";

export const dynamic = "force-dynamic";

const TOKEN_TTL_SECONDS = 10 * 60;

async function readCaller(userId) {
  const [users] = await pool.query(`SELECT email FROM users WHERE id = ? LIMIT 1`, [userId]);
  const email = users?.[0]?.email != null ? String(users[0].email) : null;
  const [subs] = await pool.query(
    `SELECT plan, trial_start_at, trial_end_at, subscribed_at, expires_at
     FROM subscriptions WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  return { email, subscription: subs?.[0] || null };
}

export async function POST(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để dùng cuộc gọi AI." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }

    let caller = null;
    try {
      caller = await readCaller(userId);
    } catch {
      caller = null;
    }

    const decision = decideLearnAiCallAccess({
      enabled: learnAiCallEnabled(),
      plan: caller ? getUserPlan(caller.subscription) : "expired",
      subscriptionLoaded: Boolean(caller),
      adminBypass: Boolean(caller && shouldBypassEntitlementsForEmail(caller.email)),
      allowlisted: Boolean(caller && learnAiCallEmailAllowed(caller.email)),
    });
    if (decision.allowed && !(await learnAiCallGateOpen(getVoiceRedis()))) {
      return NextResponse.json(
        {
          success: false,
          code: "FEATURE_DISABLED",
          message: "Cuộc gọi AI trong tab Học chưa mở.",
          data: { adminBypass: false },
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    if (!decision.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: decision.code,
          message: decision.message || decision.reason || "",
          data: { adminBypass: false },
        },
        { status: decision.status, headers: { "Cache-Control": "no-store" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const difficulty = learnCallDifficulty(body?.difficulty);
    if (!difficulty) {
      return NextResponse.json(
        {
          success: false,
          code: "INVALID_DIFFICULTY",
          message: "Chọn mức độ Dễ, Vừa hoặc Khó trước khi bắt đầu.",
          data: { accepted: LEARN_CALL_DIFFICULTY_KEYS },
        },
        { status: 400, headers: { "Cache-Control": "no-store" } }
      );
    }
    const path = await getLearningPathForUser(userId);
    const gate = resolveUnlockedGateCall(path, {
      sectionId: body?.sectionId,
      lessonId: body?.lessonId,
    });
    if (!gate.ok) {
      return NextResponse.json(
        { success: false, code: gate.code, message: gate.message },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }
    const lesson = getLessonContentById(gate.lessonId);
    if (!lesson || !isOrdinaryLessonCall(lesson.type)) {
      return NextResponse.json(
        { success: false, code: "LESSON_NOT_CALLABLE", message: "Bài này không có cuộc gọi AI." },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const redis = getVoiceRedis();
    if (!redis) {
      return NextResponse.json(
        { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không mở được phiên gọi." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const plan = decision.plan;
    const teacher = learnCallTeacher(body?.teacher);
    const limits = { ...learnAiCallLevelOneLimits(difficulty), teacher: teacher.id, teacherName: teacher.name };
    if (learnAiCallPackageAllowanceMs(plan) != null) {
      try {
        const quote = await readLearnCallPackage(redis, { userId, plan });
        if (quote) {
          limits.packageLabel = quote.label;
          limits.packageAllowanceMs = quote.allowanceMs;
          limits.packageRemainingMs = quote.remainingMs;
        }
      } catch {
        return NextResponse.json(
          { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không kiểm tra được hạn mức gọi." },
          { status: 503, headers: { "Cache-Control": "no-store" } }
        );
      }
      if (!(limits.packageRemainingMs > 0)) {
        return NextResponse.json(
          {
            success: false,
            code: "PACKAGE_QUOTA",
            message: "Đã hết hạn mức gọi của gói thử nghiệm trong hôm nay.",
            data: { limits },
          },
          { status: 402, headers: { "Cache-Control": "no-store" } }
        );
      }
    }
    const sessionId = typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${userId}-${Date.now()}`;
    const lockTtl = learnCallOpenLockTtlSeconds(limits.maxMinutes);
    const claim = await claimLearnCallOpenLock(redis, { userId, sessionId, ttlSeconds: lockTtl });
    if (!claim.granted) {
      return NextResponse.json(
        {
          success: false,
          code: "CALL_IN_PROGRESS",
          message: "Một cuộc gọi đang mở. Hãy đóng cuộc gọi đó trước khi tạo phiên mới.",
        },
        { status: 409, headers: { "Cache-Control": "no-store" } }
      );
    }
    try {
      await redis.set(learnAiCallSessionKey(sessionId), String(userId), "EX", lockTtl);
      await redis.set(
        learnAiCallContextKey(sessionId),
        JSON.stringify({
          userId,
          lessonId: lesson.lessonId,
          sectionId: gate.sectionId,
          title: gate.topicTitle || lesson.title,
          objective: lesson.objective,
          ...learnCallContextFromLesson(lesson, { topicTitle: gate.topicTitle }),
          learningNotes: learnCallLearningNotes(path, { sectionId: gate.sectionId }),
          level: limits.level,
          difficulty,
          teacher: teacher.id,
          maxMinutes: limits.maxMinutes,
        }),
        "EX",
        60 * 60
      );
    } catch {
      try {
        await redis.del(learnAiCallSessionKey(sessionId));
        await releaseLearnCallOpenLock(redis, { userId, sessionId });
      } catch {
        /* ignore */
      }
      return NextResponse.json(
        { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không mở được phiên gọi." },
        { status: 503, headers: { "Cache-Control": "no-store" } }
      );
    }

    const token = signVoiceJwt(
      { sub: String(userId), plan, purpose: LEARN_AI_CALL_PURPOSE, sid: sessionId, learnAllow: 1 },
      TOKEN_TTL_SECONDS
    );

    return NextResponse.json(
      {
        success: true,
        code: decision.code,
        message: decision.reason || "",
        data: {
          token,
          sessionId,
          plan,
          expires_in: TOKEN_TTL_SECONDS,
          adminBypass: decision.adminBypass,
          reason: decision.reason || "",
          limits,
          hints: learnAiCallLevelOneHints(lesson),
          wsUrl: learnAiCallWsUrl(),
          connected: false,
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không mở được phiên gọi." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}

export async function DELETE(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để dùng cuộc gọi AI." },
        { status: 401, headers: { "Cache-Control": "no-store" } }
      );
    }
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    const redis = getVoiceRedis();
    if (redis && sessionId) {
      await finalizeLearnCallSession(redis, { userId, sessionId });
    }
    return NextResponse.json(
      { success: true },
      { status: 200, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không đóng được phiên gọi." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
