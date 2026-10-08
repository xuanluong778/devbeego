import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export async function requireAdminUser(
  request: NextRequest
): Promise<{ id: number; email: string; role: "admin" } | null> {
  const user = await getSessionUserFromRequest(request);
  if (!user || user.is_active !== 1) return null;
  const email = String(user.email || "").trim().toLowerCase();
  if (user.role !== "admin" && !isAdminUser(email)) return null;
  return { id: user.id, email, role: "admin" };
}
