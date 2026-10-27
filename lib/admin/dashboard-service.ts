import pool from "@/lib/db";
import { ensureSubscriptionTables } from "@/lib/subscriptions/subscription-service";
import { ensurePathAdminSchema } from "@/lib/admin/ensure-path-admin-schema";
import { teacherScopeSql } from "@/lib/admin/teacher-scope";
import type { StaffRole } from "@/lib/admin/rbac";

export type DashboardStats = {
  scope: "all" | "teacher";
  definitions: Record<string, string>;
  students: {
    total: number;
    registeredLast7Days: number;
    registeredLast30Days: number;
    activeLast7Days: number;
    activeLast30Days: number;
  };
  pro: {
    activePaid: number;
    expiringWithin7Days: number;
  };
  generatedAt: string;
};

function studentBaseWhere(staffUserId?: number, staffRole?: StaffRole): { sql: string; params: number[] } {
  let sql = ` FROM users u WHERE u.staff_role IS NULL `;
  const params: number[] = [];
  if (staffRole === "teacher" && staffUserId) {
    const scope = teacherScopeSql("u", staffUserId);
    sql += scope.clause;
    params.push(...scope.params);
  }
  return { sql, params };
}

export async function getAdminDashboardStats(staff?: {
  userId: number;
  role: StaffRole;
}): Promise<DashboardStats> {
  await ensureSubscriptionTables();
  await ensurePathAdminSchema();

  const scopeRole = staff?.role;
  const scopeUser = staff?.userId;
  const scoped = scopeRole === "teacher" && scopeUser;
  const base = studentBaseWhere(scoped ? scopeUser : undefined, scopeRole);

  const [[totalRow]] = await pool.query(
    `SELECT COUNT(*) AS c ${base.sql}`,
    base.params
  );

  const [[reg7]] = await pool.query(
    `SELECT COUNT(*) AS c ${base.sql} AND u.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    base.params
  );

  const [[reg30]] = await pool.query(
    `SELECT COUNT(*) AS c ${base.sql} AND u.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    base.params
  );

  const activeJoin = scoped
    ? `INNER JOIN admin_teacher_student_scope sc ON sc.student_user_id = u.id AND sc.teacher_user_id = ?`
    : "";
  const activeParams = scoped ? [scopeUser!] : [];

  const [[act7]] = await pool.query(
    `SELECT COUNT(DISTINCT u.id) AS c
     FROM users u
     ${activeJoin}
     INNER JOIN user_stats st ON st.user_id = u.id
     WHERE u.staff_role IS NULL
       AND st.last_answer_at IS NOT NULL
       AND st.last_answer_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)`,
    activeParams
  );

  const [[act30]] = await pool.query(
    `SELECT COUNT(DISTINCT u.id) AS c
     FROM users u
     ${activeJoin}
     INNER JOIN user_stats st ON st.user_id = u.id
     WHERE u.staff_role IS NULL
       AND st.last_answer_at IS NOT NULL
       AND st.last_answer_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)`,
    activeParams
  );

  const proJoin = scoped
    ? `INNER JOIN admin_teacher_student_scope sc ON sc.student_user_id = s.user_id AND sc.teacher_user_id = ?`
    : "";
  const proParams = scoped ? [scopeUser!] : [];

  const [[proActive]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM subscriptions s
     INNER JOIN users u ON u.id = s.user_id AND u.staff_role IS NULL
     ${proJoin}
     WHERE s.plan IN ('pro','vip') AND s.expires_at IS NOT NULL AND s.expires_at > NOW()`,
    proParams
  );

  const [[proExpiring]] = await pool.query(
    `SELECT COUNT(*) AS c
     FROM subscriptions s
     INNER JOIN users u ON u.id = s.user_id AND u.staff_role IS NULL
     ${proJoin}
     WHERE s.plan IN ('pro','vip')
       AND s.expires_at IS NOT NULL
       AND s.expires_at > NOW()
       AND s.expires_at <= DATE_ADD(NOW(), INTERVAL 7 DAY)`,
    proParams
  );

  return {
    scope: scoped ? "teacher" : "all",
    definitions: {
      students_total: "Số tài khoản học viên (không tính staff).",
      registered_last_7d: "Học viên đăng ký từ 7 ngày trước đến nay (created_at).",
      registered_last_30d: "Học viên đăng ký từ 30 ngày trước đến nay.",
      active_last_7d: "Có last_answer_at trên user_stats trong 7 ngày (đã tương tác học).",
      active_last_30d: "Có last_answer_at trong 30 ngày.",
      pro_active: "subscriptions.plan pro/vip và expires_at > NOW() (giờ máy chủ DB).",
      pro_expiring_7d: "Pro/VIP còn hạn nhưng hết hạn trong 7 ngày tới.",
    },
    students: {
      total: Number(totalRow?.c || 0),
      registeredLast7Days: Number(reg7?.c || 0),
      registeredLast30Days: Number(reg30?.c || 0),
      activeLast7Days: Number(act7?.c || 0),
      activeLast30Days: Number(act30?.c || 0),
    },
    pro: {
      activePaid: Number(proActive?.c || 0),
      expiringWithin7Days: Number(proExpiring?.c || 0),
    },
    generatedAt: new Date().toISOString(),
  };
}
