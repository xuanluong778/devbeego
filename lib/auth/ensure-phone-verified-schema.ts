import pool from "@/lib/db";

let ensured = false;

export async function ensurePhoneVerifiedColumn(): Promise<void> {
  if (ensured) return;
  try {
    await pool.query("ALTER TABLE users ADD COLUMN phone_verified TINYINT(1) NOT NULL DEFAULT 0");
  } catch {
    /* exists */
  }
  ensured = true;
}
