import { NextResponse } from "next/server";
import pool from "@/lib/db";
import {
  ensureSubscriptionRow,
  fetchSubscriptionRow,
  getTrialDaysRemaining,
  getUserPlan,
} from "@/lib/subscriptions/subscription-service";
import { ensureUserProfileColumns } from "@/lib/users/ensure-user-profile-columns";
import { ensureUserSessionsTable } from "@/lib/auth/ensure-session-schema";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { isAdminUser, resolveRoleForEmail } from "@/lib/auth/user-role";
import { resolveEffectivePlanForEmail } from "@/lib/auth/admin-entitlement";
import { resolveSessionToken } from "@/lib/auth/resolve-session-token";

export async function GET(request) {
  try {
    const token = resolveSessionToken(request);
    if (!token) {
      return NextResponse.json(
        { success: false, message: "Not authenticated." },
        { status: 401 }
      );
    }

    await ensureUserSessionsTable();
    await ensureUserProfileColumns();
    await ensureRoleSchema();

    let rows;
    try {
      const [r] = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.date_of_birth, u.role, u.is_active
         FROM user_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()
           AND (s.revoked_at IS NULL)
         LIMIT 1`,
        [token]
      );
      rows = r;
    } catch {
      const [r] = await pool.query(
        `SELECT u.id, u.name, u.email, u.phone, u.avatar_url, u.date_of_birth, u.role, u.is_active
         FROM user_sessions s
         INNER JOIN users u ON u.id = s.user_id
         WHERE s.token = ? AND s.expires_at > NOW()
         LIMIT 1`,
        [token]
      );
      rows = r;
    }
    const user = rows[0];

    if (!user) {
      return NextResponse.json(
        { success: false, message: "Session expired." },
        { status: 401 }
      );
    }

    const expectedRole = resolveRoleForEmail(user.email);
    if (String(user.role || "user") !== expectedRole) {
      await pool.query("UPDATE users SET role = ? WHERE id = ?", [expectedRole, user.id]);
      user.role = expectedRole;
    }

    const admin = isAdminUser(user.email);

    let trialPayload = null;
    let planState = "expired";
    try {
      await ensureSubscriptionRow(user.id);
      const sub = await fetchSubscriptionRow(user.id);
      planState = getUserPlan(sub);
      if (!admin && sub?.trial_end_at) {
        const end = sub.trial_end_at instanceof Date ? sub.trial_end_at : new Date(sub.trial_end_at);
        if (planState === "trial") {
          const days = getTrialDaysRemaining(sub);
          if (days != null) {
            trialPayload = {
              end_at: end.toISOString(),
              days_remaining: days,
              is_active: true,
            };
          }
        } else if (planState === "expired") {
          trialPayload = {
            end_at: end.toISOString(),
            days_remaining: 0,
            is_active: false,
          };
        }
      }
    } catch {
      /* optional enrichment */
    }

    return NextResponse.json({
      success: true,
      data: {
        ...user,
        role: String(user.role || "user"),
        is_admin: admin,
        hide_billing_ui: admin,
        plan: resolveEffectivePlanForEmail(user.email, planState),
        trial: admin ? null : trialPayload,
      },
    });
  } catch (_error) {
    return NextResponse.json(
      { success: false, message: "Failed to fetch current user." },
      { status: 500 }
    );
  }
}
