import {
  VIP_EFFECTIVELY_UNLIMITED,
  type SubscriptionRow,
  type UserPlanState,
} from "@/lib/subscriptions/subscription-service";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export type AdminAiGateBilling = {
  userId: number;
  plan: UserPlanState;
  usageToday: number;
  dailyLimit: number;
  vipPriority: boolean;
  subscription: SubscriptionRow;
};

export function shouldBypassEntitlementsForEmail(email: string | null | undefined): boolean {
  return isAdminUser(email);
}

export function resolveEffectivePlanForEmail(
  email: string | null | undefined,
  plan: UserPlanState
): UserPlanState {
  return isAdminUser(email) ? "vip" : plan;
}

export function createAdminAiGateBilling(
  userId: number,
  subscription: SubscriptionRow | null | undefined
): AdminAiGateBilling {
  const base =
    subscription ??
    ({
      id: 0,
      user_id: userId,
      plan: "vip",
      trial_start_at: new Date(),
      trial_end_at: new Date(),
      subscribed_at: new Date(),
      expires_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    } as SubscriptionRow);

  return {
    userId,
    plan: "vip",
    usageToday: 0,
    dailyLimit: VIP_EFFECTIVELY_UNLIMITED,
    vipPriority: true,
    subscription: { ...base, plan: "vip" },
  };
}
