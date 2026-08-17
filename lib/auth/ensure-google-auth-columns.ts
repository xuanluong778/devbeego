import pool from "@/lib/db";
import { ensureUserProfileColumns } from "@/lib/users/ensure-user-profile-columns";

let ensured = false;

/** Thêm cột OAuth Google an toàn (ALTER try/catch — không phá schema hiện tại). */
export async function ensureGoogleAuthColumns(): Promise<void> {
  if (ensured) return;

  await ensureUserProfileColumns();

  const alters = [
    "ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE",
    "ALTER TABLE users ADD COLUMN auth_provider VARCHAR(30) NULL DEFAULT 'local'",
    "ALTER TABLE users ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0",
    "ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL",
  ];

  for (const sql of alters) {
    try {
      await pool.query(sql);
    } catch {
      /* cột đã tồn tại hoặc không có quyền ALTER */
    }
  }

  ensured = true;
}
