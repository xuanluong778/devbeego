import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { getSessionUserFromRequest } from "@/lib/auth/get-session-user";
import { ensureSubscriptionTables } from "@/lib/subscriptions/subscription-service";
import { assertMutationOrigin } from "@/lib/security/csrf-origin";
import { checkRateLimit } from "@/lib/security/rate-limit";
import {
  verifyGooglePlaySubscription,
  isGooglePlayVerifyConfigured,
} from "@/lib/billing/google-play-verify";

export const dynamic = "force-dynamic";

/**
 * Android Play Billing — client sends purchaseToken after Google Play Billing Library purchase.
 * Server is source of truth for entitlement (verify with Google API when GOOGLE_PLAY_* configured).
 */
export async function POST(request) {
  try {
    const csrf = assertMutationOrigin(request);
    if (!csrf.ok) {
      return NextResponse.json({ success: false, message: csrf.message, code: csrf.code }, { status: 403 });
    }

    const rl = await checkRateLimit(request, { key: "billing_google_play", windowMs: 60_000, max: 30 });
    if (!rl.ok) {
      return NextResponse.json(
        { success: false, message: "Too many requests.", retry_after: rl.retryAfterSec },
        { status: 429, headers: { "Retry-After": String(rl.retryAfterSec || 60) } }
      );
    }

    const user = await getSessionUserFromRequest(request);
    if (!user) {
      return NextResponse.json({ success: false, message: "Not authenticated." }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const purchaseToken = String(body.purchase_token || body.purchaseToken || "").trim();
    const productId = String(body.product_id || body.productId || "").trim();
    const packageName = String(body.package_name || body.packageName || "vn.beego.app").trim();

    if (!purchaseToken || !productId) {
      return NextResponse.json(
        { success: false, message: "purchase_token and product_id required." },
        { status: 400 }
      );
    }

    await ensureSubscriptionTables();

    await pool.query(`
      CREATE TABLE IF NOT EXISTS google_play_notifications (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        notification_type VARCHAR(64) NOT NULL,
        purchase_token VARCHAR(512) NULL,
        product_id VARCHAR(128) NULL,
        raw_payload JSON NULL,
        processed_at DATETIME NULL,
        created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_gpn_token (purchase_token(191))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await pool.query(
      `INSERT INTO google_play_notifications (notification_type, purchase_token, product_id, raw_payload, processed_at)
       VALUES ('client_purchase', ?, ?, ?, NOW())`,
      [purchaseToken, productId, JSON.stringify({ packageName, user_id: user.id, body })]
    );

    // Map product → plan (configure via env)
    const vipIds = String(process.env.GOOGLE_PLAY_VIP_PRODUCTS || "beego_vip_monthly,beego_vip_yearly")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const proIds = String(process.env.GOOGLE_PLAY_PRO_PRODUCTS || "beego_pro_monthly,beego_pro_yearly")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    let plan = "pro";
    if (vipIds.includes(productId)) plan = "vip";
    else if (proIds.includes(productId)) plan = "pro";

    const packageId = process.env.GOOGLE_PLAY_PACKAGE_NAME || packageName;
    const isProd = process.env.NODE_ENV === "production";

    if (packageName !== "vn.beego.app") {
      return NextResponse.json(
        { success: false, message: "Invalid package_name.", code: "PACKAGE_MISMATCH" },
        { status: 400 }
      );
    }

    const [tokenRows] = await pool.query(
      `SELECT user_id, plan, expires_at FROM subscriptions WHERE google_purchase_token = ? LIMIT 1`,
      [purchaseToken]
    );
    if (tokenRows?.[0]) {
      const ownerId = Number(tokenRows[0].user_id);
      if (ownerId !== Number(user.id)) {
        return NextResponse.json(
          { success: false, message: "Purchase token already linked to another account.", code: "TOKEN_CLAIMED" },
          { status: 409 }
        );
      }
      return NextResponse.json({
        success: true,
        data: {
          plan: tokenRows[0].plan,
          expires_at: tokenRows[0].expires_at,
          source: "google_play",
          package_name: packageId,
          idempotent: true,
        },
      });
    }

    let verified = false;
    let expires = new Date();
    expires.setMonth(expires.getMonth() + (/year/i.test(productId) ? 12 : 1));

    if (isGooglePlayVerifyConfigured()) {
      const v = await verifyGooglePlaySubscription({
        purchaseToken,
        productId,
        packageName: packageId,
      });
      if (!v.ok) {
        return NextResponse.json(
          { success: false, message: v.message || "Verification failed.", code: v.code || "VERIFY_FAILED" },
          { status: 502 }
        );
      }
      verified = true;
      expires = new Date(v.data.expiryTimeMillis);
    } else if (!isProd && process.env.GOOGLE_PLAY_TRUST_CLIENT === "1") {
      verified = true;
    }

    if (!verified) {
      return NextResponse.json(
        {
          success: false,
          message: isProd
            ? "Google Play purchase verification is not configured."
            : "Play purchase verification required.",
          code: "VERIFY_REQUIRED",
        },
        { status: 502 }
      );
    }

    const now = new Date();
    const trialEnd = new Date(now.getTime() + 7 * 86400000);
    await pool.query(
      `INSERT INTO subscriptions
         (user_id, plan, trial_start_at, trial_end_at, subscribed_at, expires_at, google_purchase_token, google_product_id, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'google_play')
       ON DUPLICATE KEY UPDATE
         plan = VALUES(plan),
         subscribed_at = VALUES(subscribed_at),
         expires_at = GREATEST(COALESCE(expires_at, VALUES(expires_at)), VALUES(expires_at)),
         google_purchase_token = VALUES(google_purchase_token),
         google_product_id = VALUES(google_product_id),
         source = 'google_play',
         updated_at = CURRENT_TIMESTAMP`,
      [user.id, plan, now, trialEnd, now, expires, purchaseToken, productId]
    );

    try {
      await pool.query(
        `INSERT INTO payments (user_id, provider, provider_ref, amount, currency, status, plan, raw_payload)
         VALUES (?, 'google_play', ?, 0, 'VND', 'paid', ?, ?)`,
        [user.id, purchaseToken.slice(0, 250), plan, JSON.stringify({ productId, packageId })]
      );
    } catch {
      /* payments table may lack enum value until migrate */
    }

    return NextResponse.json({
      success: true,
      data: {
        plan,
        expires_at: expires.toISOString(),
        source: "google_play",
        package_name: packageId,
      },
    });
  } catch (e) {
    console.error("[billing/google-play]", e);
    return NextResponse.json({ success: false, message: "Billing sync failed." }, { status: 500 });
  }
}
