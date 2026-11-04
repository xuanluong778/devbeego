import { ensureLearnCallPolicy } from "@/lib/beego/learn/learn-call-policy-store";
import { NextResponse } from "next/server";
import { realtimeCallClock } from "@/lib/beego/learn/learn-call-realtime-lifecycle";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { getUserPlan } from "@/lib/subscriptions/subscription-service";
import { getVoiceRedis } from "@/lib/voice/redis";
import {
  decideLearnAiCallAccess,
  isOrdinaryLessonCall,
  claimLearnCallOpenLock,
  releaseLearnCallOpenLock,
  learnAiCallEndedKey,
  learnAiCallContextKey,
  learnAiCallEmailAllowed,
  learnAiCallGateOpen,
  learnAiCallLevelOneHints,
  learnAiCallLevelOneLimits,
  learnAiCallPackageAllowanceMs,
  learnCallOpenLockTtlSeconds,
  readLearnCallPackage,
  reserveLearnCallPackage,
  resolveUnlockedGateCall,
} from "@/lib/beego/learn/ai-call-access";
import { ingestLearnCallPilotSnapshot } from "@/lib/beego/learn/learn-call-pilot";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import {
  LEARN_CALL_DEFAULT_DIFFICULTY,
  learnCallContextFromLesson,
  learnCallDifficulty,
} from "@/lib/beego/learn/learn-call-tutor";
import { learnCallTeacher } from "@/lib/beego/learn/learn-call-teachers";
import { getLearningPathForUser } from "@/lib/beego/learning-path-progress";
import {
  learnCallClaimOpening,
  learnCallOpeningPayload,
} from "@/lib/beego/learn/learn-call-opening";
import {
  buildRealtimeInstructions,
  createRealtimeCall,
  getRealtimeConfig,
  isRealtimeEnabled,
  isRealtimeUserAllowed,
  realtimeSessionKey,
  reserveRealtimeSession,
  rollbackRealtimeSession,
  terminateRealtimeSession,
} from "@/lib/beego/learn/learn-call-realtime";

export const dynamic = "force-dynamic";

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
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để dùng cuộc gọi AI Realtime." },
        { status: 401, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    // Check server feature flag: fail closed if disabled
    if (!isRealtimeEnabled()) {
      return NextResponse.json(
        {
          success: false,
          code: "REALTIME_DISABLED",
          message: "Tính năng Realtime voice hiện đang tắt trên hệ thống máy chủ.",
        },
        { status: 403, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    let caller = null;
    try {
      caller = await readCaller(userId);
    } catch {
      caller = null;
    }

    const decision = decideLearnAiCallAccess({
      enabled: true,
      plan: caller ? getUserPlan(caller.subscription) : "expired",
      subscriptionLoaded: Boolean(caller),
      adminBypass: Boolean(caller && shouldBypassEntitlementsForEmail(caller.email)),
      allowlisted: Boolean(caller && learnAiCallEmailAllowed(caller.email)),
    });

    if (!isRealtimeUserAllowed({ email: caller?.email, userId })) {
      return NextResponse.json(
        {
          success: false,
          code: "REALTIME_NOT_ALLOWLISTED",
          message: "Tính năng Realtime voice hiện chỉ mở thử nghiệm cho tài khoản nội bộ.",
        },
        { status: 403, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const redis = getVoiceRedis();
    if (!redis) {
      return NextResponse.json(
        { success: false, code: "SERVICE_UNAVAILABLE", message: "Không kết nối được dịch vụ phiên gọi." },
        { status: 503, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    if (decision.allowed && !(await learnAiCallGateOpen(redis))) {
      return NextResponse.json(
        { success: false, code: "FEATURE_DISABLED", message: "Cuộc gọi AI trong tab Học chưa mở." },
        { status: 403, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    if (!decision.allowed) {
      return NextResponse.json(
        {
          success: false,
          code: decision.code,
          message: decision.message || decision.reason || "Không đủ quyền truy cập cuộc gọi.",
        },
        { status: decision.status, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const body = await request.json().catch(() => ({}));
    const sdpOffer = String(body?.sdpOffer || "");
    if (!sdpOffer || !sdpOffer.includes("v=")) {
      return NextResponse.json(
        { success: false, code: "INVALID_SDP_OFFER", message: "Cần sdpOffer hợp lệ để tạo cuộc gọi Realtime." },
        { status: 400, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const difficulty = learnCallDifficulty(body?.difficulty) || LEARN_CALL_DEFAULT_DIFFICULTY;
    const path = await getLearningPathForUser(userId);
    const gate = resolveUnlockedGateCall(path, {
      sectionId: body?.sectionId,
      lessonId: body?.lessonId,
    });
    if (!gate.ok) {
      return NextResponse.json(
        { success: false, code: gate.code, message: gate.message },
        { status: 403, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const lesson = getLessonContentById(gate.lessonId);
    if (!lesson || !isOrdinaryLessonCall(lesson.type)) {
      return NextResponse.json(
        { success: false, code: "LESSON_NOT_CALLABLE", message: "Bài này không có cuộc gọi AI." },
        { status: 403, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const plan = decision.plan;
    const teacher = learnCallTeacher(body?.teacher);
    const limits = { ...learnAiCallLevelOneLimits(difficulty), teacher: teacher.id, teacherName: teacher.name, model: getRealtimeConfig().model };

    // Check package allowance
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
          { status: 503, headers: { "Cache-Control": "no-store, private" } }
        );
      }
      if (!(limits.packageRemainingMs > 0)) {
        return NextResponse.json(
          {
            success: false,
            code: "PACKAGE_QUOTA",
            message: "Đã hết hạn mức gọi của gói hôm nay.",
            data: { limits },
          },
          { status: 402, headers: { "Cache-Control": "no-store, private" } }
        );
      }
    }

    const clientSessionId = String(body?.sessionId || "").trim();
    const sessionId = clientSessionId || (typeof crypto?.randomUUID === "function" ? crypto.randomUUID() : `${userId}-${Date.now()}`);
    const lockTtl = learnCallOpenLockTtlSeconds(limits.maxMinutes);

    // Idempotent single-session lock
    let claim = await claimLearnCallOpenLock(redis, { userId, sessionId, ttlSeconds: lockTtl });
    if (!claim.granted && claim.holder) {
      const prevEnded = (await redis.get(learnAiCallEndedKey(claim.holder))) === "1";
      const prevSessionRaw = await redis.get(realtimeSessionKey(claim.holder));
      let prevStale = false;
      if (prevSessionRaw) {
        try {
          const prevData = JSON.parse(prevSessionRaw);
          if (prevData?.status === "terminated" || prevData?.settled) prevStale = true;
        } catch {}
      } else {
        const prevCtx = await redis.get(learnAiCallContextKey(claim.holder));
        if (!prevCtx) prevStale = true;
      }
      if (prevEnded || prevStale || Boolean(body?.force) || claim.holder === sessionId || claim.holder === clientSessionId) {
        await releaseLearnCallOpenLock(redis, { userId, sessionId: claim.holder });
        claim = await claimLearnCallOpenLock(redis, { userId, sessionId, ttlSeconds: lockTtl });
      }
    }
    if (!claim.granted) {
      return NextResponse.json(
        {
          success: false,
          code: "CALL_IN_PROGRESS",
          message: "Một cuộc gọi đang mở. Hãy đóng cuộc gọi đó trước khi tạo phiên mới.",
        },
        { status: 409, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    if (learnAiCallPackageAllowanceMs(plan) != null) {
      const pkg = await reserveLearnCallPackage(redis, {
        userId,
        plan,
        sessionId,
        sessionCapMs: limits.maxMinutes * 60_000,
      });
      if (pkg.status === "denied") {
        await rollbackRealtimeSession(redis, { userId, sessionId });
        return NextResponse.json(
          {
            success: false,
            code: "PACKAGE_QUOTA",
            message: "Đã hết hạn mức gọi của gói hôm nay.",
            data: { limits: { ...limits, packageRemainingMs: pkg.remainingMs, packageAllowanceMs: pkg.allowanceMs } },
          },
          { status: 402, headers: { "Cache-Control": "no-store, private" } }
        );
      }
      limits.packageLabel = pkg.label;
      limits.packageAllowanceMs = pkg.allowanceMs;
      limits.packageRemainingMs = pkg.remainingMs;
      limits.packageReservedMs = pkg.reservedMs;
    }

    // Build Realtime instructions from Stage 2 system prompt
    const topicCtx = {
      title: gate.topicTitle || lesson.title,
      sectionId: gate.sectionId,
      level: limits.level,
      teacherName: teacher.name,
      ...learnCallContextFromLesson(lesson, { topicTitle: gate.topicTitle, sectionId: gate.sectionId }),
    };
    const sessionMode = body?.sessionMode === "open" ? "open" : "lesson";
    const policy = await ensureLearnCallPolicy(redis, { sessionId, userId, topicCtx: { ...topicCtx, topic: topicCtx.topic || topicCtx.title, sessionMode }, difficulty });
    const topicForOpening = { ...policy.topicCtx, difficulty, teacher: teacher.id };
    let openingClaimed = false;
    if (sessionMode !== "open" && redis) {
      const openingLock = await learnCallClaimOpening(redis, sessionId);
      openingClaimed = openingLock.claimed;
    }
    const opening = learnCallOpeningPayload(topicForOpening, limits.difficulty, {
      open: openingClaimed,
      invite: sessionMode === "open",
      reason: openingClaimed ? "lesson_open" : sessionMode === "open" ? "open_mode_waits" : "already_opened",
    });
    const instructions = buildRealtimeInstructions({
      topicCtx: topicForOpening,
      sessionMode,
      teacherName: teacher.name,
      opening,
    });

    const rtConfig = getRealtimeConfig();
    const apiKey = process.env.OPENAI_API_KEY;

    // Unified GA Flow: Call official POST /v1/realtime/calls with multipart SDP offer + session config
    const rtCall = await createRealtimeCall({
      apiKey,
      sdpOffer,
      model: rtConfig.model,
      voice: rtConfig.voice,
      instructions,
      turnDetection: body?.talkMode === "manual" ? null : undefined,
    });

    if (!rtCall.ok) {
      // Rollback claimed open lock immediately on failure
      await rollbackRealtimeSession(redis, { userId, sessionId });
      return NextResponse.json(
        {
          success: false,
          code: rtCall.error || "REALTIME_CALL_FAILED",
          message: rtCall.message || "Không thể khởi tạo cuộc gọi Realtime với OpenAI.",
        },
        { status: rtCall.status || 502, headers: { "Cache-Control": "no-store, private" } }
      );
    }

    const deadlineAt = Date.now() + Math.min(limits.maxMinutes * 60_000, limits.packageRemainingMs || 120_000);

    // Reserve Realtime session in Redis, tracking verified callId and setting watchdog deadline
    const reserved = await reserveRealtimeSession(redis, {
      userId,
      sessionId,
      callId: rtCall.callId,
      deadlineAt,
      limits,
    });

    return NextResponse.json(
      {
        success: true,
        data: {
          sessionId,
          callId: rtCall.callId,
          sdpAnswer: rtCall.sdpAnswer,
          model: rtCall.model,
          voice: rtCall.voice,
          deadlineAt,
          callClock: realtimeCallClock(reserved.session),
          limits,
          hints: learnAiCallLevelOneHints(lesson),
          opening,
          topicCtx: topicForOpening,
          turnControl: "server_policy",
          awaitingPracticeAttempt: Boolean(policy.activePractice),
        },
      },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, code: "SERVER_ERROR", message: err?.message || "Lỗi máy chủ nội bộ." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}

export async function DELETE(request) {
  try {
    const userId = await getSessionUserIdFromRequest(request);
    if (!userId) {
      return NextResponse.json(
        { success: false, code: "AUTH_REQUIRED", message: "Đăng nhập để kết thúc phiên." },
        { status: 401, headers: { "Cache-Control": "no-store, private" } }
      );
    }
    const body = await request.json().catch(() => ({}));
    const sessionId = String(body?.sessionId || "");
    const redis = getVoiceRedis();

    if (redis && sessionId) {
      await ingestLearnCallPilotSnapshot(redis, {
        sessionId,
        transport: "realtime",
        model: body?.model,
        usage: body?.usage,
        experience: body?.experience,
        endReason: body?.reason || "user_hangup",
        durationMs: Number(body?.durationMs) || 0,
      }).catch(() => null);
      await terminateRealtimeSession(redis, {
        sessionId,
        userId,
        apiKey: process.env.OPENAI_API_KEY,
        reason: body?.reason || "user_hangup",
      });
    }

    return NextResponse.json(
      { success: true, message: "Phiên Realtime đã được đóng và thanh toán một lần." },
      { status: 200, headers: { "Cache-Control": "no-store, private" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, code: "TERMINATION_FAILED", message: "Không thể đóng phiên Realtime." },
      { status: 500, headers: { "Cache-Control": "no-store, private" } }
    );
  }
}
