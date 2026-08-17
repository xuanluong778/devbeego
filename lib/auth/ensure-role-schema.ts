import pool from "@/lib/db";

let ensured = false;

/** Thêm cột role an toàn — không phá schema hiện tại. */
export async function ensureRoleSchema(): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("ALTER TABLE users ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'user'");
  } catch {
    /* exists */
  }
  ensured = true;
}
