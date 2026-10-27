/** Run: docker exec beego-web node scripts/ensure-pro-admin-schema.mjs */
import mysql from "mysql2/promise";

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "beego_app",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "beego_vn",
});

await db.query(`
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
    KEY idx_pro_ledger_student (student_user_id, created_at)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`);

await db.end();
console.log("ensure-pro-admin-schema: OK");
