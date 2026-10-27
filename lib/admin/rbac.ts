export type StaffRole = "system_owner" | "support_staff" | "teacher";

export type AdminPermission =
  | "students.list"
  | "students.view"
  | "students.edit"
  | "students.lock"
  | "students.notes.read"
  | "students.notes.write"
  | "students.plan"
  | "audit.read"
  | "paths.catalog.read"
  | "paths.templates.read"
  | "paths.templates.write"
  | "paths.templates.publish"
  | "paths.assign"
  | "paths.assign.personal"
  | "paths.apply_update"
  | "teacher.scope.manage"
  | "dashboard.read"
  | "admin.access";

const ALL: AdminPermission[] = [
  "admin.access",
  "students.list",
  "students.view",
  "students.edit",
  "students.lock",
  "students.notes.read",
  "students.notes.write",
  "students.plan",
  "audit.read",
  "paths.catalog.read",
  "paths.templates.read",
  "paths.templates.write",
  "paths.templates.publish",
  "paths.assign",
  "paths.assign.personal",
  "paths.apply_update",
  "teacher.scope.manage",
  "dashboard.read",
];

const ROLE_PERMISSIONS: Record<StaffRole, AdminPermission[]> = {
  system_owner: ALL,
  support_staff: [
    "admin.access",
    "students.list",
    "students.view",
    "students.edit",
    "students.lock",
    "students.notes.read",
    "students.notes.write",
    "students.plan",
    "audit.read",
    "dashboard.read",
  ],
  teacher: [
    "admin.access",
    "students.list",
    "students.view",
    "students.notes.read",
    "students.notes.write",
    "audit.read",
    "paths.catalog.read",
    "dashboard.read",
  ],
};

export function normalizeStaffRole(raw: unknown, _email?: string): StaffRole | null {
  const value = String(raw || "").trim().toLowerCase();
  if (value === "system_owner" || value === "support_staff" || value === "teacher") {
    return value;
  }
  return null;
}

export function permissionsForRole(role: StaffRole | null): AdminPermission[] {
  if (!role) return [];
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role: StaffRole | null, permission: AdminPermission): boolean {
  return permissionsForRole(role).includes(permission);
}

export function staffRoleLabelVi(role: StaffRole | null): string {
  if (role === "system_owner") return "Chủ hệ thống";
  if (role === "support_staff") return "Nhân viên hỗ trợ";
  if (role === "teacher") return "Giáo viên";
  return "—";
}
