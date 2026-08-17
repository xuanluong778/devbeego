/** Central admin allowlist — configure via ADMIN_EMAILS in .env (comma-separated). */

export const DEFAULT_ADMIN_EMAILS = [
  "xuanluong778@gmail.com",
  "xuanluongmarketing@gmail.com",
];

export function parseAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS?.trim() || process.env.ADMIN_EMAIL?.trim() || "";
  const fromEnv = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (fromEnv.length) return fromEnv;
  return DEFAULT_ADMIN_EMAILS.map((e) => e.toLowerCase());
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
