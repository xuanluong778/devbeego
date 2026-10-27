import pool from "@/lib/db";

let ensured = false;

export type ProActivationSource =
  | "payment"
  | "bank_transfer"
  | "gift"
  | "scholarship"
  | "trial";

export const PRO_ACTIVATION_SOURCES: ProActivationSource[] = [
  "payment",
  "bank_transfer",
  "gift",
  "scholarship",
  "trial",
];

export function activationSourceCountsAsRevenue(source: ProActivationSource): boolean {
  return source === "payment" || source === "bank_transfer";
}

export async function ensureProAdminSchema(): Promise<void> {
  if (ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_pro_plan_ledger (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      student_user_id BIGINT UNSIGNED NOT NULL,
      actor_user_id BIGINT UNSIGNED NOT NULL,
      action ENUM('activate','extend','revoke') NOT NULL,
      plan ENUM('pro','vip') NOT NULL DEFAULT 'pro',
      activation_source ENUM('payment','bank_transfer','gift','scholarship','trial') NULL,
      external_ref VARCHAR(120) NULL,
      reason VARCHAR(500) NULL,
      old_plan VARCHAR(16) NULL,
      new_plan VARCHAR(16) NULL,
      old_expires_at DATETIME NULL,
      new_expires_at DATETIME NULL,
      old_subscribed_at DATETIME NULL,
      new_subscribed_at DATETIME NULL,
      counts_as_revenue TINYINT(1) NOT NULL DEFAULT 0,
      idempotency_key VARCHAR(64) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uk_pro_idempotency (idempotency_key),
      KEY idx_pro_ledger_student (student_user_id, created_at),
      KEY idx_pro_ledger_created (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  ensured = true;
}
