import pool from "@/lib/db";

let ensured = false;

export async function ensureUserProfileColumns(): Promise<void> {
  if (ensured) return;
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN avatar_url VARCHAR(512) NULL`);
  } catch {
    /* exists */
  }
  try {
    await pool.query(`ALTER TABLE users ADD COLUMN date_of_birth DATE NULL`);
  } catch {
    /* exists */
  }
  ensured = true;
}
