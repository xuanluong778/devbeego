import pool from "@/lib/db";
import { ensurePathAdminSchema } from "@/lib/admin/ensure-path-admin-schema";
import type { StaffRole } from "@/lib/admin/rbac";

export async function teacherCanAccessStudent(
  staffUserId: number,
  staffRole: StaffRole,
  studentUserId: number
): Promise<boolean> {
  if (staffRole === "system_owner" || staffRole === "support_staff") return true;
  if (staffRole !== "teacher") return false;
  await ensurePathAdminSchema();
  const [rows] = await pool.query(
    `SELECT 1 FROM admin_teacher_student_scope
     WHERE teacher_user_id = ? AND student_user_id = ? LIMIT 1`,
    [staffUserId, studentUserId]
  );
  return (rows as unknown[]).length > 0;
}

export function teacherScopeSql(alias = "u", staffUserId?: number): { clause: string; params: number[] } {
  if (!staffUserId) return { clause: "", params: [] };
  return {
    clause: ` AND EXISTS (
      SELECT 1 FROM admin_teacher_student_scope sc
      WHERE sc.student_user_id = ${alias}.id AND sc.teacher_user_id = ?
    )`,
    params: [staffUserId],
  };
}

export async function setTeacherStudentScope(params: {
  teacherUserId: number;
  studentUserIds: number[];
  assignedBy: number;
}) {
  await ensurePathAdminSchema();
  const teacherId = params.teacherUserId;
  const ids = [...new Set(params.studentUserIds.map((n) => Number(n)).filter((n) => n > 0))];
  await pool.query(`DELETE FROM admin_teacher_student_scope WHERE teacher_user_id = ?`, [teacherId]);
  for (const studentId of ids) {
    await pool.query(
      `INSERT INTO admin_teacher_student_scope (teacher_user_id, student_user_id, assigned_by)
       VALUES (?, ?, ?)`,
      [teacherId, studentId, params.assignedBy]
    );
  }
  return { count: ids.length };
}

export async function listTeacherScope(teacherUserId: number) {
  await ensurePathAdminSchema();
  const [rows] = await pool.query(
    `SELECT sc.student_user_id, u.name, u.email
     FROM admin_teacher_student_scope sc
     INNER JOIN users u ON u.id = sc.student_user_id
     WHERE sc.teacher_user_id = ?
     ORDER BY u.name ASC`,
    [teacherUserId]
  );
  return rows as { student_user_id: number; name: string; email: string | null }[];
}
