import type { NextRequest } from "next/server";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";

export async function requireAdminUser(
  request: NextRequest
): Promise<{ id: number; email: string; role: "admin" } | null> {
  const user = await getSessionUserFromRequest(request);
  if (!user || user.role !== "admin" || user.is_active !== 1) return null;
  return { id: user.id, email: String(user.email || ""), role: "admin" };
}
