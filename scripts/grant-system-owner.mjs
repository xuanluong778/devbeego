/**
 * Cấp system_owner có kiểm soát — chạy tay, không gắn vào request.
 * Không thu hồi owner khác.
 *
 * docker exec -e GRANT_EMAIL=user@example.com beego-web node scripts/grant-system-owner.mjs
 */
import mysql from "mysql2/promise";

const email = String(process.env.GRANT_EMAIL || "").trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Set GRANT_EMAIL to the account email.");
  process.exit(1);
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "beego_app",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "beego_vn",
});

await db.query(`
  CREATE TABLE IF NOT EXISTS admin_staff_bootstrap_block (
    email VARCHAR(255) NOT NULL PRIMARY KEY,
    reason VARCHAR(200) NULL,
    blocked_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
`);

const [users] = await db.query(`SELECT id, staff_role FROM users WHERE LOWER(TRIM(email)) = ? LIMIT 1`, [email]);
if (!users.length) {
  console.error("User not found.");
  process.exit(1);
}

await db.query(`DELETE FROM admin_staff_bootstrap_block WHERE email = ?`, [email]);
await db.query(
  `UPDATE users SET staff_role = 'system_owner', role = 'admin' WHERE LOWER(TRIM(email)) = ?`,
  [email]
);
console.log(`Granted system_owner to user id ${users[0].id}. Previous staff_role was ${users[0].staff_role || "(empty)"}.`);
await db.end();
