import pool from "@/lib/db";
import { ensureSubscriptionTables, type UserPlanState } from "@/lib/subscriptions/subscription-service";

/** Trạng thái gói theo thời gian máy chủ DB (`NOW()`), không phụ thuộc thanh toán. */
export async function getUserPlanStateFromDb(userId: number): Promise<{
  plan: string;
  planState: UserPlanState;
  paidActive: boolean;
  trialActive: boolean;
  expiresAt: unknown;
  subscribedAt: unknown;
  trialEndAt: unknown;
}> {
  await ensureSubscriptionTables();
  await pool.query(
    `INSERT INTO subscriptions (user_id, plan, trial_start_at, trial_end_at)
     VALUES (?, 'free', NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY))
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
  const [rows] = await pool.query(
    `SELECT plan, trial_end_at, expires_at, subscribed_at,
            (expires_at IS NOT NULL AND expires_at > NOW()) AS paid_active,
            (trial_end_at IS NOT NULL AND trial_end_at > NOW()) AS trial_active
     FROM subscriptions WHERE user_id = ? LIMIT 1`,
    [userId]
  );
  const r = (rows as Record<string, unknown>[])[0];
  const plan = String(r?.plan || "free");
  const paidActive = Number(r?.paid_active) === 1;
  const trialActive = Number(r?.trial_active) === 1;
  let planState: UserPlanState = "expired";
  if (paidActive && (plan === "pro" || plan === "vip")) planState = plan as UserPlanState;
  else if (trialActive) planState = "trial";
  return {
    plan,
    planState,
    paidActive,
    trialActive,
    expiresAt: r?.expires_at ?? null,
    subscribedAt: r?.subscribed_at ?? null,
    trialEndAt: r?.trial_end_at ?? null,
  };
}

export function hasPaidProAccess(planState: UserPlanState): boolean {
  return planState === "pro" || planState === "vip";
}
