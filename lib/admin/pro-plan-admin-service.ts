import type { PoolConnection } from "mysql2/promise";
import pool from "@/lib/db";
import { writeAdminAuditLog } from "@/lib/admin/audit-log";
import {
  activationSourceCountsAsRevenue,
  ensureProAdminSchema,
  type ProActivationSource,
} from "@/lib/admin/ensure-pro-admin-schema";
import { formatDateTimeVi } from "@/lib/admin/format-vn-time";
import { getUserPlanStateFromDb } from "@/lib/subscriptions/plan-access-sql";
import { ensureSubscriptionTables } from "@/lib/subscriptions/subscription-service";

export type ProPlanAction = "activate" | "extend" | "revoke";

function clampDays(days: number): number {
  return Math.min(730, Math.max(1, Math.floor(days)));
}

function mapLedgerRow(row: Record<string, unknown>) {
  return {
    id: Number(row.id),
    action: String(row.action),
    plan: String(row.plan),
    activationSource: row.activation_source != null ? String(row.activation_source) : null,
    externalRef: row.external_ref != null ? String(row.external_ref) : null,
    reason: row.reason != null ? String(row.reason) : null,
    oldPlan: row.old_plan != null ? String(row.old_plan) : null,
    newPlan: row.new_plan != null ? String(row.new_plan) : null,
    oldExpiresAt: row.old_expires_at,
    newExpiresAt: row.new_expires_at,
    oldExpiresAtVi: formatDateTimeVi(row.old_expires_at),
    newExpiresAtVi: formatDateTimeVi(row.new_expires_at),
    oldSubscribedAt: row.old_subscribed_at,
    newSubscribedAt: row.new_subscribed_at,
    countsAsRevenue: Number(row.counts_as_revenue) === 1,
    createdAt: row.created_at,
    createdAtVi: formatDateTimeVi(row.created_at),
    actorUserId: Number(row.actor_user_id),
    actorName: row.actor_name != null ? String(row.actor_name) : "",
  };
}

export async function listProPlanLedger(studentUserId: number, limit = 30) {
  await ensureProAdminSchema();
  const [rows] = await pool.query(
    `SELECT l.*, u.name AS actor_name
     FROM admin_pro_plan_ledger l
     INNER JOIN users u ON u.id = l.actor_user_id
     WHERE l.student_user_id = ?
     ORDER BY l.created_at DESC
     LIMIT ?`,
    [studentUserId, Math.min(100, Math.max(1, limit))]
  );
  return (rows as Record<string, unknown>[]).map(mapLedgerRow);
}

type SubSnapshot = {
  plan: string;
  expires_at: Date | null;
  subscribed_at: Date | null;
};

async function loadSubForUpdate(conn: PoolConnection, userId: number): Promise<SubSnapshot> {
  await conn.query(
    `INSERT INTO subscriptions (user_id, plan, trial_start_at, trial_end_at)
     VALUES (?, 'free', NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY))
     ON DUPLICATE KEY UPDATE user_id = user_id`,
    [userId]
  );
  const [rows] = await conn.query(
    `SELECT plan, expires_at, subscribed_at FROM subscriptions WHERE user_id = ? FOR UPDATE`,
    [userId]
  );
  const r = (rows as Record<string, unknown>[])[0];
  return {
    plan: String(r?.plan || "free"),
    expires_at: r?.expires_at ? new Date(String(r.expires_at)) : null,
    subscribed_at: r?.subscribed_at ? new Date(String(r.subscribed_at)) : null,
  };
}

/** Gia hạn: còn hạn → cộng từ ngày hết hạn; đã hết → từ NOW(). */
export function computeNewExpiryFromDays(
  currentExpires: Date | null,
  days: number,
  extendFromCurrentExpiry: boolean
): Date {
  const d = clampDays(days);
  const baseMs =
    extendFromCurrentExpiry && currentExpires ? currentExpires.getTime() : Date.now();
  return new Date(baseMs + d * 24 * 60 * 60 * 1000);
}

export async function previewProPlanChange(params: {
  studentUserId: number;
  action: ProPlanAction;
  plan?: "pro" | "vip";
  days?: number;
}) {
  await ensureSubscriptionTables();
  const live = await getUserPlanStateFromDb(params.studentUserId);
  const plan = params.plan === "vip" ? "vip" : "pro";

  if (params.action === "revoke") {
    return {
      action: "revoke" as const,
      current: {
        plan: live.plan,
        planState: live.planState,
        expiresAt: live.expiresAt,
        expiresAtVi: formatDateTimeVi(live.expiresAt),
        subscribedAt: live.subscribedAt,
        subscribedAtVi: formatDateTimeVi(live.subscribedAt),
      },
      preview: {
        plan: "free",
        planState: live.trialActive ? ("trial" as const) : ("expired" as const),
        expiresAt: null,
        expiresAtVi: null,
        subscribedAt: live.subscribedAt,
        subscribedAtVi: formatDateTimeVi(live.subscribedAt),
      },
    };
  }

  const days = clampDays(Number(params.days || 30));
  const extendFromExpiry =
    live.paidActive && (live.plan === "pro" || live.plan === "vip") && live.expiresAt;
  const curExp = live.expiresAt ? new Date(String(live.expiresAt)) : null;
  const newExp = computeNewExpiryFromDays(curExp, days, Boolean(extendFromExpiry));

  return {
    action: params.action,
    days,
    plan,
    current: {
      plan: live.plan,
      planState: live.planState,
      expiresAt: live.expiresAt,
      expiresAtVi: formatDateTimeVi(live.expiresAt),
      subscribedAt: live.subscribedAt,
      subscribedAtVi: formatDateTimeVi(live.subscribedAt),
    },
    preview: {
      plan,
      planState: plan,
      expiresAt: newExp,
      expiresAtVi: formatDateTimeVi(newExp),
      subscribedAt: live.subscribedAt || new Date(),
      subscribedAtVi: formatDateTimeVi(live.subscribedAt || new Date()),
    },
  };
}

async function findIdempotentLedger(idempotencyKey: string) {
  const [rows] = await pool.query(
    `SELECT l.*, u.name AS actor_name FROM admin_pro_plan_ledger l
     INNER JOIN users u ON u.id = l.actor_user_id
     WHERE l.idempotency_key = ? LIMIT 1`,
    [idempotencyKey]
  );
  const row = (rows as Record<string, unknown>[])[0];
  return row ? mapLedgerRow(row) : null;
}

export async function applyProPlanChange(params: {
  studentUserId: number;
  actorUserId: number;
  action: ProPlanAction;
  plan?: "pro" | "vip";
  days?: number;
  activationSource?: ProActivationSource;
  externalRef?: string | null;
  reason?: string;
  idempotencyKey?: string;
}) {
  await ensureProAdminSchema();
  await ensureSubscriptionTables();

  const idem = String(params.idempotencyKey || "").trim().slice(0, 64);
  if (idem) {
    const existing = await findIdempotentLedger(idem);
    if (existing) {
      return { ok: true as const, duplicate: true, ledger: existing };
    }
  }

  if (params.action === "revoke") {
    const reason = String(params.reason || "").trim();
    if (!reason) return { ok: false as const, code: "REASON_REQUIRED" as const };
  } else {
    const src = params.activationSource;
    if (!src || !["payment", "bank_transfer", "gift", "scholarship", "trial"].includes(src)) {
      return { ok: false as const, code: "SOURCE_REQUIRED" as const };
    }
  }

  const plan = params.plan === "vip" ? "vip" : "pro";
  const days = clampDays(Number(params.days || 30));
  const source = params.activationSource;
  const countsRevenue = source ? activationSourceCountsAsRevenue(source) : false;
  const externalRef = params.externalRef ? String(params.externalRef).trim().slice(0, 120) : null;
  const reason = String(params.reason || "").trim().slice(0, 500) || null;

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    if (idem) {
      const [dup] = await conn.query(
        `SELECT id FROM admin_pro_plan_ledger WHERE idempotency_key = ? FOR UPDATE`,
        [idem]
      );
      if ((dup as unknown[]).length) {
        await conn.commit();
        const existing = await findIdempotentLedger(idem);
        return { ok: true as const, duplicate: true, ledger: existing! };
      }
    }

    const before = await loadSubForUpdate(conn, params.studentUserId);
    const oldPlan = before.plan;
    const oldExpires = before.expires_at;
    const oldSubscribed = before.subscribed_at;

    let newPlan = oldPlan;
    let newExpires: Date | null = oldExpires;
    let newSubscribed: Date | null = oldSubscribed;

    if (params.action === "revoke") {
      newPlan = "free";
      newExpires = null;
      await conn.query(
        `UPDATE subscriptions SET plan = 'free', expires_at = NULL, updated_at = NOW() WHERE user_id = ?`,
        [params.studentUserId]
      );
    } else {
      const [activeRow] = await conn.query(
        `SELECT (expires_at IS NOT NULL AND expires_at > NOW()) AS paid_active, expires_at
         FROM subscriptions WHERE user_id = ?`,
        [params.studentUserId]
      );
      const paidActive = Number((activeRow as { paid_active: number }[])[0]?.paid_active) === 1;
      const curExpRaw = (activeRow as { expires_at: unknown }[])[0]?.expires_at;
      const curExp = curExpRaw ? new Date(String(curExpRaw)) : null;
      const extendFromExpiry = paidActive && curExp;
      newExpires = computeNewExpiryFromDays(curExp, days, Boolean(extendFromExpiry));
      newPlan = plan;
      if (!oldSubscribed) newSubscribed = new Date();
      await conn.query(
        `UPDATE subscriptions SET
           plan = ?,
           subscribed_at = COALESCE(subscribed_at, NOW()),
           expires_at = ?,
           updated_at = NOW()
         WHERE user_id = ?`,
        [plan, newExpires, params.studentUserId]
      );
    }

    const [ins] = await conn.query(
      `INSERT INTO admin_pro_plan_ledger
       (student_user_id, actor_user_id, action, plan, activation_source, external_ref, reason,
        old_plan, new_plan, old_expires_at, new_expires_at, old_subscribed_at, new_subscribed_at,
        counts_as_revenue, idempotency_key)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        params.studentUserId,
        params.actorUserId,
        params.action,
        params.action === "revoke"
          ? oldPlan === "vip"
            ? "vip"
            : "pro"
          : plan,
        params.action === "revoke" ? null : source,
        externalRef,
        reason,
        oldPlan,
        newPlan,
        oldExpires,
        newExpires,
        oldSubscribed,
        newSubscribed,
        countsRevenue ? 1 : 0,
        idem || null,
      ]
    );
    const ledgerId = Number((ins as { insertId?: number }).insertId);

    await conn.commit();

    const auditAction =
      params.action === "revoke"
        ? "student.pro.revoke"
        : params.action === "extend"
          ? "student.pro.extend"
          : "student.pro.activate";

    await writeAdminAuditLog({
      actorUserId: params.actorUserId,
      targetUserId: params.studentUserId,
      action: auditAction,
      reason,
      meta: {
        ledger_id: ledgerId,
        activation_source: source,
        external_ref: externalRef,
        counts_as_revenue: countsRevenue,
        days: params.action === "revoke" ? null : days,
        old_expires_at: oldExpires,
        new_expires_at: newExpires,
      },
    });

    const subscription = await getUserPlanStateFromDb(params.studentUserId);
    const [ledgerRows] = await pool.query(
      `SELECT l.*, u.name AS actor_name FROM admin_pro_plan_ledger l
       INNER JOIN users u ON u.id = l.actor_user_id WHERE l.id = ?`,
      [ledgerId]
    );
    return {
      ok: true as const,
      duplicate: false,
      subscription,
      ledger: mapLedgerRow((ledgerRows as Record<string, unknown>[])[0]),
    };
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

export async function getStudentProSummary(studentUserId: number) {
  const subscription = await getUserPlanStateFromDb(studentUserId);
  const ledger = await listProPlanLedger(studentUserId, 20);
  return {
    subscription: {
      plan: subscription.plan,
      planState: subscription.planState,
      paidActive: subscription.paidActive,
      trialActive: subscription.trialActive,
      expiresAt: subscription.expiresAt,
      expiresAtVi: formatDateTimeVi(subscription.expiresAt),
      subscribedAt: subscription.subscribedAt,
      subscribedAtVi: formatDateTimeVi(subscription.subscribedAt),
      trialEndAt: subscription.trialEndAt,
      trialEndAtVi: formatDateTimeVi(subscription.trialEndAt),
    },
    ledger,
    accessNote:
      "Quyền Pro/VIP chỉ có khi expires_at > NOW() trên máy chủ. Thu hồi có hiệu lực ngay; gói tặng/học bổng/dùng thử không ghi doanh thu.",
  };
}
