import pool from "@/lib/db";
import { isAdminUser } from "@/lib/auth/is-admin-user";

export async function requireAdminUser(request) {
  const token = request.cookies.get("session_token")?.value;
  if (!token) return null;

  const [rows] = await pool.query(
    `SELECT u.id, u.name, u.email, u.role, u.is_active
     FROM user_sessions s
     INNER JOIN users u ON u.id = s.user_id
     WHERE s.token = ? AND s.expires_at > NOW()
     LIMIT 1`,
    [token]
  );
  const user = rows[0] || null;
  if (!user || Number(user.is_active) !== 1) return null;

  const email = String(user.email || "").trim().toLowerCase();
  if (String(user.role || "") === "admin" || isAdminUser(email)) {
    if (String(user.role || "") !== "admin") {
      await pool.query("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
    }
    return { id: Number(user.id), email };
  }
  return null;
}
