import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";

export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }
    const body = await request.json().catch(() => ({}));
    const token = String(body.token || "").trim();
    const platform = String(body.platform || "android").slice(0, 32);
    const appVersion = body.app_version ? String(body.app_version).slice(0, 64) : null;
    if (!token || token.length < 20) {
      return NextResponse.json({ success: false, message: "Invalid FCM token." }, { status: 400 });
    }

    await pool.query(`
      CREATE TABLE IF NOT EXISTS fcm_devices (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        user_id BIGINT UNSIGNED NOT NULL,
        token VARCHAR(512) NOT NULL,
        platform VARCHAR(32) NOT NULL DEFAULT 'android',
        app_version VARCHAR(64) NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        last_seen_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uq_fcm_token (token(191)),
        KEY idx_fcm_user (user_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(
      `INSERT INTO fcm_devices (user_id, token, platform, app_version, enabled, last_seen_at)
       VALUES (?, ?, ?, ?, 1, NOW())
       ON DUPLICATE KEY UPDATE
         user_id = VALUES(user_id),
         platform = VALUES(platform),
         app_version = VALUES(app_version),
         enabled = 1,
         last_seen_at = NOW()`,
      [user.id, token, platform, appVersion]
    );

    return NextResponse.json({ success: true, message: "FCM device registered." });
  } catch (e) {
    console.error("[push/register]", e);
    return NextResponse.json({ success: false, message: "Register failed." }, { status: 500 });
  }
}
