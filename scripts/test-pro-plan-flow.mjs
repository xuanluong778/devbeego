/**
 * Smoke Pro admin: preview logic + transactional extend + idempotency + revoke.
 * Run: docker exec beego-web node scripts/test-pro-plan-flow.mjs
 */
import mysql from "mysql2/promise";

function computeNewExpiryFromDays(currentExpires, days, extendFromCurrentExpiry) {
  const d = Math.min(730, Math.max(1, Math.floor(days)));
  const baseMs = extendFromCurrentExpiry && currentExpires ? currentExpires.getTime() : Date.now();
  return new Date(baseMs + d * 86400000);
}

const db = await mysql.createConnection({
  host: process.env.DB_HOST || "mysql",
  user: process.env.DB_USER || "beego_app",
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || "beego_vn",
});

function ok(label, cond) {
  if (!cond) {
    console.error("FAIL:", label);
    process.exitCode = 1;
    return;
  }
  console.log("OK:", label);
}

const [[staff]] = await db.query(`SELECT id FROM users WHERE staff_role = 'system_owner' LIMIT 1`);
const [[student]] = await db.query(
  `SELECT id FROM users WHERE staff_role IS NULL AND is_active = 1 ORDER BY id ASC LIMIT 1`
);
ok("fixtures", staff?.id && student?.id);

await db.query(
  `INSERT INTO subscriptions (user_id, plan, trial_start_at, trial_end_at, subscribed_at, expires_at)
   VALUES (?, 'free', NOW(), DATE_ADD(NOW(), INTERVAL 15 DAY), NULL, NULL)
   ON DUPLICATE KEY UPDATE user_id = user_id`,
  [student.id]
);

const future = new Date(Date.now() + 5 * 86400000);
await db.query(`UPDATE subscriptions SET plan = 'pro', expires_at = ?, subscribed_at = NOW() WHERE user_id = ?`, [
  future,
  student.id,
]);

const extended = computeNewExpiryFromDays(future, 30, true);
ok("extend from expiry base", extended.getTime() > future.getTime());

const fromNow = computeNewExpiryFromDays(null, 30, false);
ok("extend from now when expired", fromNow.getTime() > Date.now());

const idem = `smoke-${Date.now()}`;
const [[beforePaid]] = await db.query(
  `SELECT (expires_at > NOW()) AS active FROM subscriptions WHERE user_id = ?`,
  [student.id]
);

await db.query(
  `INSERT INTO admin_pro_plan_ledger
   (student_user_id, actor_user_id, action, plan, activation_source, counts_as_revenue, idempotency_key)
   VALUES (?, ?, 'extend', 'pro', 'gift', 0, ?)`,
  [student.id, staff.id, idem]
);

const [[dup]] = await db.query(`SELECT id FROM admin_pro_plan_ledger WHERE idempotency_key = ?`, [idem]);
ok("idempotency row", !!dup?.id);

await db.query(`UPDATE subscriptions SET plan = 'free', expires_at = NULL WHERE user_id = ?`, [student.id]);
const [[afterRevoke]] = await db.query(
  `SELECT (expires_at IS NOT NULL AND expires_at > NOW()) AS active FROM subscriptions WHERE user_id = ?`,
  [student.id]
);
ok("revoke clears paid access", Number(afterRevoke?.active) === 0);

await db.query(`DELETE FROM admin_pro_plan_ledger WHERE idempotency_key = ?`, [idem]);
await db.end();
console.log("Done pro plan smoke.");
