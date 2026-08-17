import type { NextRequest } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { ensureOrgVocabSchema } from "@/lib/org-vocab/ensure-schema";
import type { AuthContext, OrgMemberRole } from "@/lib/org-vocab/types";

export async function getAuthContext(request: NextRequest): Promise<AuthContext | null> {
  const user = await getSessionUserFromRequest(request);
  if (!user || user.is_active !== 1) return null;
  return {
    userId: user.id,
    isSystemAdmin: user.role === "admin",
    userName: user.name,
    userEmail: user.email,
  };
}

export async function getOrgMemberRole(
  userId: number,
  organizationId: number
): Promise<OrgMemberRole | null> {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT role FROM organization_members WHERE organization_id = ? AND user_id = ? LIMIT 1`,
    [organizationId, userId]
  );
  const role = (rows as { role?: string }[])?.[0]?.role;
  if (!role) return null;
  return role as OrgMemberRole;
}

export async function isOrgStaff(userId: number, organizationId: number, isSystemAdmin: boolean) {
  if (isSystemAdmin) return true;
  const role = await getOrgMemberRole(userId, organizationId);
  return role === "owner" || role === "teacher";
}

export async function isOrgOwner(userId: number, organizationId: number, isSystemAdmin: boolean) {
  if (isSystemAdmin) return true;
  const role = await getOrgMemberRole(userId, organizationId);
  return role === "owner";
}

export async function getClassroomMeta(classroomId: number) {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT id, organization_id, teacher_user_id, name, is_active
     FROM classrooms WHERE id = ? LIMIT 1`,
    [classroomId]
  );
  return (rows as Record<string, unknown>[])?.[0] || null;
}

export async function canManageClassroom(
  auth: AuthContext,
  classroomId: number
): Promise<boolean> {
  if (auth.isSystemAdmin) return true;
  const cls = await getClassroomMeta(classroomId);
  if (!cls) return false;
  if (Number(cls.teacher_user_id) === auth.userId) return true;
  return isOrgStaff(auth.userId, Number(cls.organization_id), false);
}

export async function isStudentInClassroom(userId: number, classroomId: number): Promise<boolean> {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT 1 FROM classroom_students WHERE classroom_id = ? AND user_id = ? LIMIT 1`,
    [classroomId, userId]
  );
  return Boolean((rows as unknown[])?.[0]);
}

export async function canViewAssignment(auth: AuthContext, assignmentId: number): Promise<boolean> {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT organization_id, classroom_id, assigned_by FROM assignments WHERE id = ? LIMIT 1`,
    [assignmentId]
  );
  const row = (rows as Record<string, unknown>[])?.[0];
  if (!row) return false;
  if (auth.isSystemAdmin) return true;
  if (Number(row.assigned_by) === auth.userId) return true;
  if (await canManageClassroom(auth, Number(row.classroom_id))) return true;
  return isStudentInClassroom(auth.userId, Number(row.classroom_id));
}

export async function canManageAssignment(auth: AuthContext, assignmentId: number): Promise<boolean> {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT organization_id, classroom_id FROM assignments WHERE id = ? LIMIT 1`,
    [assignmentId]
  );
  const row = (rows as Record<string, unknown>[])?.[0];
  if (!row) return false;
  if (auth.isSystemAdmin) return true;
  return canManageClassroom(auth, Number(row.classroom_id));
}

export async function canManageVocabularySet(
  auth: AuthContext,
  setId: number
): Promise<boolean> {
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT organization_id FROM vocabulary_sets WHERE id = ? LIMIT 1`,
    [setId]
  );
  const orgId = Number((rows as { organization_id?: number }[])?.[0]?.organization_id);
  if (!orgId) return false;
  return isOrgStaff(auth.userId, orgId, auth.isSystemAdmin);
}

export async function canViewVocabularySet(auth: AuthContext, setId: number): Promise<boolean> {
  if (auth.isSystemAdmin) return true;
  if (await canManageVocabularySet(auth, setId)) return true;
  await ensureOrgVocabSchema();
  const [rows] = await pool.query(
    `SELECT a.id FROM assignments a
     INNER JOIN classroom_students cs ON cs.classroom_id = a.classroom_id AND cs.user_id = ?
     WHERE a.set_id = ? AND a.is_active = 1 LIMIT 1`,
    [auth.userId, setId]
  );
  return Boolean((rows as unknown[])?.[0]);
}

export function slugify(name: string): string {
  return String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
