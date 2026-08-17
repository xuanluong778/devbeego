/** Client-safe admin checks — rely on flags from /api/auth/me, not env. */

export function isAdminSessionUser(user) {
  if (!user) return false;
  if (user.hide_billing_ui === true) return true;
  if (user.is_admin === true) return true;
  if (String(user.role || "").toLowerCase() === "admin") return true;
  return false;
}

export function shouldHideBillingUi(user) {
  return isAdminSessionUser(user);
}
