import pool from "@/lib/db";
import { parseAdminEmailsFromEnvOnly } from "@/lib/auth/is-admin-user";

let ensured = false;

export async function ensureStudentAdminSchema(): Promise<void> {
  if (ensured) return;

  try {
    await pool.query(
      "ALTER TABLE users ADD COLUMN staff_role VARCHAR(32) NULL COMMENT 'system_owner|support_staff|teacher'"
    );
  } catch {
    /* exists */
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_student_notes (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_user_id BIGINT UNSIGNED NOT NULL,
      author_user_id BIGINT UNSIGNED NOT NULL,
      body TEXT NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      KEY idx_asn_student (student_user_id, created_at),
      KEY idx_asn_author (author_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_audit_log (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      target_user_id BIGINT UNSIGNED NULL,
      action VARCHAR(64) NOT NULL,
      reason VARCHAR(500) NULL,
      meta_json JSON NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_aal_target (target_user_id, created_at),
      KEY idx_aal_actor (actor_user_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_staff_bootstrap_block (
      email VARCHAR(255) NOT NULL PRIMARY KEY,
      reason VARCHAR(200) NULL,
      blocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  ensured = true;
}

/**
 * Không gọi từ request. Chỉ dùng khi vận hành chủ động.
 * Không ghi đè staff_role đã có. Không gỡ owner khác.
 */
export async function bootstrapSystemOwnerStaffRoles(): Promise<void> {
  const emails = parseAdminEmailsFromEnvOnly();
  for (const email of emails) {
    await pool.query(
      `UPDATE users
       SET staff_role = 'system_owner', role = 'admin'
       WHERE LOWER(TRIM(email)) = ?
         AND (staff_role IS NULL OR TRIM(staff_role) = '')
         AND NOT EXISTS (
           SELECT 1 FROM admin_staff_bootstrap_block b WHERE b.email = LOWER(TRIM(?))
         )`,
      [email.toLowerCase(), email.toLowerCase()]
    );
  }
}
