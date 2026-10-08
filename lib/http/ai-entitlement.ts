import pool from "@/lib/db";
import { createAdminAiGateBilling, shouldBypassEntitlementsForEmail } from "@/lib/auth/admin-entitlement";
import {
  canAccessPaidAi,
  canUseSpeakingAi,
  getPooledDailyLimit,
  getUserPlan,
  incrementPooledAiUsage,
  loadSubscriptionAndUsageToday,
  type SubscriptionRow,
  type UserPlanState,
} from "@/lib/subscriptions/subscription-service";

import { resolveSessionToken } from "@/lib/auth/resolve-session-token";

export type AiFeature = "chat" | "translate" | "grammar" | "speaking";

export type AiGateBilling = {
  userId: number;
  plan: UserPlanState;
  usageToday: number;
  dailyLimit: number;
  /** True when paid VIP + active subscription (lessons chat model priority). */
  vipPriority: boolean;
  subscription: SubscriptionRow;
};

export type AiGateOk = { ok: true; billing: AiGateBilling };
export type AiGateErr = {
  ok: false;
  status: number;
  code: string;
  message: string;
};

export type AiGateResult = AiGateOk | AiGateErr;

const PAYWALL = {
  code: "PAYWALL",
  message: "Your free trial has ended. Please upgrade.",
} as const;

export async function getSessionUserIdFromRequest(request: {
  cookies?: { get: (name: string) => { value?: string } | undefined };
  headers?: Headers | { get: (name: string) => string | null };
}): Promise<number | null> {
  const token = resolveSessionToken(request);
  if (!token) return null;
  try {
    const [rows] = await pool.query(
      `SELECT u.id AS id
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()
         AND (s.revoked_at IS NULL)
       LIMIT 1`,
      [token]
    );
    const id = Number((rows as { id: number }[])[0]?.id);
    return Number.isFinite(id) ? id : null;
  } catch {
    const [rows] = await pool.query(
      `SELECT u.id AS id
       FROM user_sessions s
       INNER JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()
       LIMIT 1`,
      [token]
    );
    const id = Number((rows as { id: number }[])[0]?.id);
    return Number.isFinite(id) ? id : null;
  }
}

async function getUserEmailById(userId: number): Promise<string | null> {
  const [rows] = await pool.query(`SELECT email FROM users WHERE id = ? LIMIT 1`, [userId]);
  const email = (rows as { email?: string | null }[])[0]?.email;
  return email != null ? String(email) : null;
}

/**
 * Enforce paywall, plan features, and pooled daily limits before calling AI-backed handlers.
 * Speaking: VIP + active subscription only (not trial).
 * Admin users bypass all limits.
 */
export async function assertAiFeatureAccess(
  userId: number,
  feature: AiFeature,
  options?: { email?: string | null }
): Promise<AiGateResult> {
  const email = options?.email ?? (await getUserEmailById(userId));
  const loaded = await loadSubscriptionAndUsageToday(userId);

  if (shouldBypassEntitlementsForEmail(email)) {
    return {
      ok: true,
      billing: createAdminAiGateBilling(userId, loaded?.subscription ?? null),
    };
  }

  if (!loaded) {
    return {
      ok: false,
      status: 500,
      code: "SUBSCRIPTION_LOAD_FAILED",
      message: "Could not load subscription.",
    };
  }

  const { subscription, usageToday } = loaded;
  const plan = getUserPlan(subscription);

  if (!canAccessPaidAi(subscription)) {
    return {
      ok: false,
      status: 402,
      code: PAYWALL.code,
      message: PAYWALL.message,
    };
  }

  if (feature === "speaking") {
    if (!canUseSpeakingAi(subscription)) {
      return {
        ok: false,
        status: 403,
        code: "SPEAKING_NOT_INCLUDED",
        message: "Speaking practice is available on the VIP plan.",
      };
    }
    const billing: AiGateBilling = {
      userId,
      plan,
      usageToday,
      dailyLimit: getPooledDailyLimit(plan),
      vipPriority: true,
      subscription,
    };
    return { ok: true, billing };
  }

  const dailyLimit = getPooledDailyLimit(plan);
  if (usageToday >= dailyLimit) {
    return {
      ok: false,
      status: 429,
      code: "DAILY_LIMIT",
      message: "Daily AI request limit reached for your plan. Try again tomorrow or upgrade.",
    };
  }

  const billing: AiGateBilling = {
    userId,
    plan,
    usageToday,
    dailyLimit,
    vipPriority: plan === "vip",
    subscription,
  };

  return { ok: true, billing };
}

/** Call after a successful pooled AI response (chat / translate / grammar). */
export async function recordPooledAiUsageSuccess(userId: number, billing: AiGateBilling): Promise<void> {
  if (billing.plan === "vip" && billing.dailyLimit >= 50000) {
    return;
  }
  await incrementPooledAiUsage(userId);
}
