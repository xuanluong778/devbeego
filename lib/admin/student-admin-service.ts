import pool from "@/lib/db";
import { ensureRoleSchema } from "@/lib/auth/ensure-role-schema";
import { ensureGoogleAuthColumns } from "@/lib/auth/ensure-google-auth-columns";
import { ensurePhoneVerifiedColumn } from "@/lib/auth/ensure-phone-verified-schema";
import { ensureSubscriptionTables, type UserPlanState } from "@/lib/subscriptions/subscription-service";
import { ensureStudentAdminSchema } from "@/lib/admin/ensure-student-admin-schema";
import { listAuditForStudent, writeAdminAuditLog } from "@/lib/admin/audit-log";
import { type UserFilter, filterClause } from "@/lib/admin/users-service-filters";
import { teacherCanAccessStudent, teacherScopeSql } from "@/lib/admin/teacher-scope";
import { getStudentLearningPathView } from "@/lib/admin/student-path-service";
import { getStudentProSummary } from "@/lib/admin/pro-plan-admin-service";
import type { StaffRole } from "@/lib/admin/rbac";

export type AccountStatusFilter = "all" | "active" | "blocked";

export function studentCode(id: number): string {
  return `HV${String(id).padStart(6, "0")}`;
}

function planStateFromRow(r: Record<string, unknown>): UserPlanState {
  const now = Date.now();
  const expires = r.expires_at ? new Date(String(r.expires_at)).getTime() : 0;
  const trialEnd = r.trial_end_at ? new Date(String(r.trial_end_at)).getTime() : 0;
  const plan = String(r.plan || "free");
  if (expires > now && (plan === "pro" || plan === "vip")) return plan as UserPlanState;
  if (trialEnd > now) return "trial";
  return "expired";
}

export function resolveLoginMethod(row: Record<string, unknown>): "google" | "email" | "phone" {
  const provider = String(row.auth_provider || "local").toLowerCase();
  if (provider === "google") return "google";
  const email = row.email != null ? String(row.email).trim() : "";
  const phone = row.phone != null ? String(row.phone).trim() : "";
  if (phone && !email) return "phone";
  if (email) return "email";
  if (phone) return "phone";
  return "email";
}

export function loginMethodLabelVi(method: "google" | "email" | "phone"): string {
  if (method === "google") return "Google";
  if (method === "phone") return "Số điện thoại";
  return "Email";
}

export function verificationLabelVi(row: Record<string, unknown>): string {
  const method = resolveLoginMethod(row);
  const emailOk = Number(row.email_verified) === 1;
  const phoneOk = Number(row.phone_verified) === 1;
  if (method === "google" && emailOk) return "Đã xác minh (Google)";
  if (method === "email" && emailOk) return "Email đã xác minh";
  if (method === "phone" && phoneOk) return "SĐT đã xác minh";
  if (emailOk) return "Email đã xác minh";
  if (phoneOk) return "SĐT đã xác minh";
  return "Chưa xác minh";
}

function accountStatusClause(status: AccountStatusFilter): string {
  if (status === "active") return " AND u.is_active = 1";
  if (status === "blocked") return " AND u.is_active = 0";
  return "";
}

function mapListRow(r: Record<string, unknown>) {
  const planState = planStateFromRow(r);
  const loginMethod = resolveLoginMethod(r);
  const id = Number(r.id);
  return {
    id,
    code: studentCode(id),
    name: String(r.name || ""),
    email: r.email != null ? String(r.email) : null,
    phone: r.phone != null ? String(r.phone) : null,
    login_method: loginMethod,
    login_method_label: loginMethodLabelVi(loginMethod),
    auth_provider: r.auth_provider != null ? String(r.auth_provider) : "local",
    verification_label: verificationLabelVi(r),
    email_verified: Number(r.email_verified) === 1,
    phone_verified: Number(r.phone_verified) === 1,
    created_at: r.created_at,
    last_login_at: r.last_login_at,
    plan: String(r.plan || "free"),
    plan_state: planState,
    account_status: Number(r.is_active) === 1 ? "active" : "blocked",
    account_status_label: Number(r.is_active) === 1 ? "Hoạt động" : "Đã khóa",
  };
}

export async function listStudents(params: {
  q?: string;
  filter?: UserFilter;
  accountStatus?: AccountStatusFilter;
  page?: number;
  limit?: number;
  staffUserId?: number;
  staffRole?: StaffRole;
}) {
  await ensureStudentAdminSchema();
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  await ensurePhoneVerifiedColumn();
  await ensureSubscriptionTables();

  const q = String(params.q || "").trim().toLowerCase();
  const filter = (params.filter || "all") as UserFilter;
  const accountStatus = (params.accountStatus || "all") as AccountStatusFilter;
  const page = Math.max(1, Number(params.page || 1));
  const limit = Math.min(100, Math.max(5, Number(params.limit || 20)));
  const offset = (page - 1) * limit;

  const searchClause =
    q === ""
      ? ""
      : ` AND (
          LOWER(u.name) LIKE CONCAT('%', ?, '%')
          OR LOWER(IFNULL(u.email,'')) LIKE CONCAT('%', ?, '%')
          OR IFNULL(u.phone,'') LIKE CONCAT('%', ?, '%')
          OR CAST(u.id AS CHAR) LIKE CONCAT('%', ?, '%')
        )`;
  const searchParams: unknown[] = q === "" ? [] : [q, q, q, q.replace(/^hv0*/i, "")];
  const fClause = filterClause(filter);
  const aClause = accountStatusClause(accountStatus);
  const scope =
    params.staffRole === "teacher" && params.staffUserId
      ? teacherScopeSql("u", params.staffUserId)
      : { clause: "", params: [] as number[] };
  const whereParams = [...searchParams, ...scope.params];

  const [countRows] = await pool.query(
    `SELECT COUNT(DISTINCT u.id) AS total
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.staff_role IS NULL ${searchClause} ${fClause} ${aClause}${scope.clause}`,
    whereParams
  );
  const total = Number((countRows as { total: number }[])[0]?.total || 0);

  const [rows] = await pool.query(
    `SELECT
       u.id, u.name, u.email, u.phone, u.is_active, u.created_at, u.last_login_at,
       u.auth_provider, u.email_verified, u.phone_verified,
       s.plan, s.trial_end_at, s.expires_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.staff_role IS NULL ${searchClause} ${fClause} ${aClause}${scope.clause}
     ORDER BY u.created_at DESC
     LIMIT ? OFFSET ?`,
    [...whereParams, limit, offset]
  );

  return {
    items: (rows as Record<string, unknown>[]).map(mapListRow),
    total,
    page,
    limit,
    total_pages: Math.max(1, Math.ceil(total / limit)),
  };
}

export async function getStudentProfile(
  studentId: number,
  staff?: { userId: number; role: StaffRole }
) {
  if (staff && !(await teacherCanAccessStudent(staff.userId, staff.role, studentId))) {
    return null;
  }
  await ensureStudentAdminSchema();
  await ensureRoleSchema();
  await ensureGoogleAuthColumns();
  await ensurePhoneVerifiedColumn();
  await ensureSubscriptionTables();

  const [userRows] = await pool.query(
    `SELECT u.*, s.plan, s.trial_start_at, s.trial_end_at, s.expires_at, s.subscribed_at
     FROM users u
     LEFT JOIN subscriptions s ON s.user_id = u.id
     WHERE u.id = ? AND u.staff_role IS NULL
     LIMIT 1`,
    [studentId]
  );
  const u = (userRows as Record<string, unknown>[])[0];
  if (!u) return null;

  const [noteRows] = await pool.query(
    `SELECT n.id, n.body, n.created_at, n.updated_at,
            a.name AS author_name, a.staff_role AS author_staff_role
     FROM admin_student_notes n
     INNER JOIN users a ON a.id = n.author_user_id
     WHERE n.student_user_id = ?
     ORDER BY n.created_at DESC
     LIMIT 100`,
    [studentId]
  );

  const audit = await listAuditForStudent(studentId, 50);
  const learningPath = await getStudentLearningPathView(studentId);
  const proPlan = await getStudentProSummary(studentId);
  const loginMethod = resolveLoginMethod(u);
  const id = Number(u.id);

  return {
    student: {
      ...mapListRow(u),
      code: studentCode(id),
      avatar_url: u.avatar_url != null ? String(u.avatar_url) : null,
      date_of_birth: u.date_of_birth ?? null,
    },
    subscription: {
      plan: proPlan.subscription.plan,
      plan_state: proPlan.subscription.planState,
      trial_end_at: proPlan.subscription.trialEndAt,
      expires_at: proPlan.subscription.expiresAt,
      subscribed_at: proPlan.subscription.subscribedAt,
      expires_at_vi: proPlan.subscription.expiresAtVi,
      subscribed_at_vi: proPlan.subscription.subscribedAtVi,
      trial_end_at_vi: proPlan.subscription.trialEndAtVi,
      paid_active: proPlan.subscription.paidActive,
    },
    proPlan,
    notes: (noteRows as Record<string, unknown>[]).map((n) => ({
      id: Number(n.id),
      body: String(n.body || ""),
      created_at: n.created_at,
      updated_at: n.updated_at,
      author_name: String(n.author_name || ""),
      author_staff_role: n.author_staff_role != null ? String(n.author_staff_role) : null,
    })),
    audit,
    learningPath,
    tabs: {
      learning_path: { ready: true },
      pro_plan: { ready: true },
    },
  };
}

export async function updateStudentProfile(params: {
  studentId: number;
  actorUserId: number;
  name?: string;
  phone?: string | null;
  reason?: string;
}) {
  const [rows] = await pool.query(
    `SELECT id, name, phone, auth_provider, email FROM users WHERE id = ? AND staff_role IS NULL LIMIT 1`,
    [params.studentId]
  );
  const before = (rows as Record<string, unknown>[])[0];
  if (!before) return { ok: false as const, code: "NOT_FOUND" };

  const provider = String(before.auth_provider || "local").toLowerCase();
  const updates: string[] = [];
  const values: unknown[] = [];
  const meta: Record<string, unknown> = {};

  const name = params.name != null ? String(params.name).trim().slice(0, 100) : null;
  if (name && name !== String(before.name || "")) {
    updates.push("name = ?");
    values.push(name);
    meta.name = { from: before.name, to: name };
  }

  if (params.phone !== undefined) {
    if (provider === "google") {
      return { ok: false as const, code: "GOOGLE_ACCOUNT", message: "Tài khoản Google không đổi SĐT tại đây." };
    }
    const phone = params.phone == null ? null : String(params.phone).trim().slice(0, 30);
    updates.push("phone = ?");
    values.push(phone || null);
    meta.phone = { from: before.phone, to: phone };
  }

  if (!updates.length) {
    return { ok: true as const, changed: false };
  }

  const reason = String(params.reason || "").trim();
  if (!reason) {
    return { ok: false as const, code: "REASON_REQUIRED", message: "Cần ghi lý do khi sửa thông tin." };
  }

  values.push(params.studentId);
  await pool.query(`UPDATE users SET ${updates.join(", ")} WHERE id = ?`, values);
  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentId,
    action: "student.update",
    reason: params.reason,
    meta,
  });
  return { ok: true as const, changed: true };
}

export async function setStudentBlocked(params: {
  studentId: number;
  actorUserId: number;
  block: boolean;
  reason: string;
}) {
  const reason = String(params.reason || "").trim();
  if (!reason) {
    return { ok: false as const, code: "REASON_REQUIRED", message: "Cần ghi lý do khóa/mở khóa." };
  }
  if (params.studentId === params.actorUserId) {
    return { ok: false as const, code: "SELF", message: "Không thể khóa chính mình." };
  }

  const [rows] = await pool.query(
    `SELECT id, is_active FROM users WHERE id = ? AND staff_role IS NULL LIMIT 1`,
    [params.studentId]
  );
  if (!(rows as unknown[]).length) {
    return { ok: false as const, code: "NOT_FOUND", message: "Không tìm thấy học viên." };
  }

  const block = params.block !== false;
  await pool.query("UPDATE users SET is_active = ? WHERE id = ?", [block ? 0 : 1, params.studentId]);
  if (block) {
    await pool.query("DELETE FROM user_sessions WHERE user_id = ?", [params.studentId]);
  }
  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentId,
    action: block ? "student.block" : "student.unblock",
    reason,
    meta: { is_active: block ? 0 : 1 },
  });
  return { ok: true as const, block };
}

export async function addStudentNote(params: {
  studentId: number;
  actorUserId: number;
  body: string;
}) {
  const body = String(params.body || "").trim();
  if (!body) return { ok: false as const, code: "EMPTY", message: "Nội dung ghi chú không được trống." };

  const [exists] = await pool.query(
    `SELECT id FROM users WHERE id = ? AND staff_role IS NULL LIMIT 1`,
    [params.studentId]
  );
  if (!(exists as unknown[]).length) {
    return { ok: false as const, code: "NOT_FOUND" };
  }

  const [result] = await pool.query(
    `INSERT INTO admin_student_notes (student_user_id, author_user_id, body) VALUES (?, ?, ?)`,
    [params.studentId, params.actorUserId, body.slice(0, 8000)]
  );
  const insertId = Number((result as { insertId?: number }).insertId || 0);
  await writeAdminAuditLog({
    actorUserId: params.actorUserId,
    targetUserId: params.studentId,
    action: "student.note.add",
    meta: { note_id: insertId },
  });
  return { ok: true as const, id: insertId };
}
