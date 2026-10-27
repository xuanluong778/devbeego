import pool from "@/lib/db";
import { ensureStudentAdminSchema } from "@/lib/admin/ensure-student-admin-schema";

const SECRET_KEYS = /password|token|secret|hash|otp|authorization|cookie/i;

function sanitizeMeta(meta: Record<string, unknown> | null | undefined): Record<string, unknown> | null {
  if (!meta || typeof meta !== "object") return null;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SECRET_KEYS.test(key)) continue;
    if (value == null) {
      out[key] = value;
      continue;
    }
    if (typeof value === "string" && value.length > 400) {
      out[key] = `${value.slice(0, 400)}…`;
      continue;
    }
    out[key] = value;
  }
  return Object.keys(out).length ? out : null;
}

export async function writeAdminAuditLog(params: {
  actorUserId: number;
  targetUserId?: number | null;
  action: string;
  reason?: string | null;
  meta?: Record<string, unknown> | null;
}) {
  await ensureStudentAdminSchema();
  const reason = String(params.reason || "").trim().slice(0, 500) || null;
  const meta = sanitizeMeta(params.meta);
  await pool.query(
    `INSERT INTO admin_audit_log (actor_user_id, target_user_id, action, reason, meta_json)
     VALUES (?, ?, ?, ?, ?)`,
    [
      params.actorUserId,
      params.targetUserId ?? null,
      String(params.action || "").slice(0, 64),
      reason,
      meta ? JSON.stringify(meta) : null,
    ]
  );
}

export async function listAuditForStudent(studentUserId: number, limit = 50) {
  await ensureStudentAdminSchema();
  const [rows] = await pool.query(
    `SELECT a.id, a.action, a.reason, a.meta_json, a.created_at,
            u.name AS actor_name, u.email AS actor_email, u.staff_role AS actor_staff_role
     FROM admin_audit_log a
     INNER JOIN users u ON u.id = a.actor_user_id
     WHERE a.target_user_id = ?
     ORDER BY a.created_at DESC
     LIMIT ?`,
    [studentUserId, Math.min(100, Math.max(1, limit))]
  );
  return (rows as Record<string, unknown>[]).map((row) => ({
    id: Number(row.id),
    action: String(row.action || ""),
    reason: row.reason != null ? String(row.reason) : null,
    meta: row.meta_json,
    created_at: row.created_at,
    actor: {
      name: String(row.actor_name || ""),
      email: row.actor_email != null ? String(row.actor_email) : null,
      staff_role: row.actor_staff_role != null ? String(row.actor_staff_role) : null,
    },
  }));
}
