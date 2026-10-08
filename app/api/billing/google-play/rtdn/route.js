import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ensureSubscriptionTables } from "@/lib/subscriptions/subscription-service";
import { verifyGooglePlaySubscription } from "@/lib/billing/google-play-verify";

export const dynamic = "force-dynamic";

function decodePubSubBody(body) {
  const b64 = body?.message?.data;
  if (!b64 || typeof b64 !== "string") return null;
  try {
    return JSON.parse(Buffer.from(b64, "base64").toString("utf8"));
  } catch {
    return null;
  }
}

async function ensureRtdnTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS google_play_rtdn_dedupe (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      dedupe_key VARCHAR(512) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_rtdn_dedupe (dedupe_key(191))
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

/**
 * Google Play Real-time developer notifications (Pub/Sub push).
 * Configure GOOGLE_PLAY_RTDN_SECRET on push subscription as ?token=...
 */
export async function POST(request) {
  try {
    const secret = process.env.GOOGLE_PLAY_RTDN_SECRET || "";
    if (secret) {
      const url = new URL(request.url);
      if (url.searchParams.get("token") !== secret) {
        return NextResponse.json({ success: false, message: "Forbidden." }, { status: 403 });
      }
    }

    const body = await request.json().catch(() => ({}));
    const payload = decodePubSubBody(body);
    if (!payload) {
      return NextResponse.json({ success: false, message: "Invalid Pub/Sub payload." }, { status: 400 });
    }

    await ensureSubscriptionTables();
    await ensureRtdnTable();

    const subNote = payload.subscriptionNotification || payload.oneTimeProductNotification;
    const purchaseToken = subNote?.purchaseToken || payload.purchaseToken || "";
    const productId = subNote?.subscriptionId || subNote?.sku || "";
    const notificationType = String(subNote?.notificationType ?? payload.notificationType ?? "unknown");

    const dedupeKey = `${notificationType}:${purchaseToken}:${body?.message?.messageId || ""}`;
    try {
      await pool.query(`INSERT INTO google_play_rtdn_dedupe (dedupe_key) VALUES (?)`, [dedupeKey]);
    } catch (e) {
      if (e?.code === "ER_DUP_ENTRY") {
        return NextResponse.json({ success: true, data: { duplicate: true } });
      }
      throw e;
    }

    await pool.query(
      `INSERT INTO google_play_notifications (notification_type, purchase_token, product_id, raw_payload, processed_at)
       VALUES (?, ?, ?, ?, NULL)`,
      [`rtdn_${notificationType}`, purchaseToken, productId, JSON.stringify({ body, payload })]
    );

    if (!purchaseToken || !productId) {
      return NextResponse.json({ success: true, data: { stored: true, verified: false } });
    }

    const verify = await verifyGooglePlaySubscription({
      purchaseToken,
      productId,
      packageName: "vn.beego.app",
    });

    if (!verify.ok) {
      await pool.query(
        `UPDATE google_play_notifications SET processed_at = NOW() WHERE purchase_token = ? ORDER BY id DESC LIMIT 1`,
        [purchaseToken]
      );
      return NextResponse.json({ success: true, data: { verified: false, code: verify.code } });
    }

    const expiry = new Date(verify.data.expiryTimeMillis);
    const [subs] = await pool.query(
      `SELECT user_id FROM subscriptions WHERE google_purchase_token = ? LIMIT 1`,
      [purchaseToken]
    );
    const userId = subs?.[0]?.user_id;
    if (userId) {
      await pool.query(
        `UPDATE subscriptions SET expires_at = GREATEST(COALESCE(expires_at, ?), ?), updated_at = CURRENT_TIMESTAMP
         WHERE user_id = ? AND google_purchase_token = ?`,
        [expiry, expiry, userId, purchaseToken]
      );
    }

    await pool.query(
      `UPDATE google_play_notifications SET processed_at = NOW() WHERE purchase_token = ? ORDER BY id DESC LIMIT 1`,
      [purchaseToken]
    );

    return NextResponse.json({ success: true, data: { verified: true, user_id: userId || null } });
  } catch (e) {
    console.error("[billing/google-play/rtdn]", e);
    return NextResponse.json({ success: false, message: "RTDN processing failed." }, { status: 500 });
  }
}
