import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export async function requireAdminUser(request) {
  const user = await getSessionUserFromRequest(request);
  if (!user || Number(user.is_active) !== 1) return null;

  const email = String(user.email || "").trim().toLowerCase();
  if (user.role === "admin" || isAdminUser(email)) {
    return { id: Number(user.id), email };
  }
  return null;
}
