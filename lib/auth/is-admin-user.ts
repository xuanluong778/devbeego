/** Admin identity comes from users.staff_role and explicit grant, not from emails in source. */

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim() || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function parseAdminEmailsFromEnvOnly(): string[] {
  return parseAdminEmails();
}

export function isAdminUser(email: string | null | undefined): boolean {
  const normalized = String(email || "")
    .trim()
    .toLowerCase();
  if (!normalized) return false;
  return parseAdminEmails().includes(normalized);
}

export function isAdminSessionUser(
  user:
    | {
        email?: string | null;
        role?: string | null;
        is_admin?: boolean | null;
        hide_billing_ui?: boolean | null;
      }
    | null
    | undefined
): boolean {
  if (!user) return false;
  if (user.hide_billing_ui === true) return true;
  if (user.is_admin === true) return true;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  return isAdminUser(user.email);
}
