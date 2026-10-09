import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserIdFromRequest } from "@/lib/http/ai-entitlement";
import { shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import { getUserPlan } from "@/lib/subscriptions/subscription-service";
import {
  decideLearnAiCallAccess,
  isOrdinaryLessonCall,
  learnAiCallEmailAllowed,
  learnAiCallEnabled,
  learnAiCallGateOpen,
  learnAiCallLevelOneLimits,
  learnAiCallPackageAllowanceMs,
  readLearnCallPackage,
  resolveUnlockedGateCall,
} from "@/lib/beego/learn/ai-call-access";
import { getLessonContentById } from "@/lib/beego/learn/get-lesson-content";
import { getLearningPathForUser } from "@/lib/beego/learning-path-progress";
import { getVoiceRedis } from "@/lib/voice/redis";

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

export async function GET(request) {
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
        },
        { status: 403, headers: { "Cache-Control": "no-store" } }
      );
    }

    const params = new URL(request.url).searchParams;
    const lessonId = params.get("lessonId") || "";
    const sectionId = params.get("sectionId") || "";
    let lessonOffer = null;
    if (decision.allowed) {
      const path = await getLearningPathForUser(userId);
      const gate = resolveUnlockedGateCall(path, { sectionId, lessonId });
      if (!gate.ok) {
        return NextResponse.json(
          { success: false, code: gate.code, message: gate.message },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      const lesson = getLessonContentById(gate.lessonId);
      if (!lesson || !isOrdinaryLessonCall(lesson.type)) {
        return NextResponse.json(
          {
            success: false,
            code: "LESSON_NOT_CALLABLE",
            message: "Bài này không có cuộc gọi AI.",
          },
          { status: 403, headers: { "Cache-Control": "no-store" } }
        );
      }
      const limits = { ...learnAiCallLevelOneLimits() };
      if (learnAiCallPackageAllowanceMs(decision.plan) != null) {
        const redis = getVoiceRedis();
        if (!redis) {
          return NextResponse.json(
            { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không kiểm tra được hạn mức gọi." },
            { status: 503, headers: { "Cache-Control": "no-store" } }
          );
        }
        try {
          const quote = await readLearnCallPackage(redis, { userId, plan: decision.plan });
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
        if (limits.packageRemainingMs <= 0) {
          return NextResponse.json(
            {
              success: false,
              code: "PACKAGE_QUOTA",
              message: "Đã hết hạn mức gọi của gói thử nghiệm trong hôm nay.",
              data: { allowed: false, plan: decision.plan, lesson: { lessonId: lesson.lessonId, title: lesson.title, limits } },
            },
            { status: 402, headers: { "Cache-Control": "no-store" } }
          );
        }
      }
      lessonOffer = {
        lessonId: lesson.lessonId,
        sectionId: gate.sectionId,
        title: gate.topicTitle || lesson.title,
        objective: lesson.objective,
        limits,
      };
    }

    return NextResponse.json(
      {
        success: decision.allowed,
        code: decision.code,
        message: decision.message || decision.reason || "",
        data: {
          allowed: decision.allowed,
          plan: decision.plan,
          adminBypass: decision.adminBypass,
          reason: decision.reason || "",
          lesson: lessonOffer,
        },
      },
      { status: decision.status, headers: { "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { success: false, code: "SUBSCRIPTION_LOAD_FAILED", message: "Không kiểm tra được gói học. Cuộc gọi chưa được mở." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
