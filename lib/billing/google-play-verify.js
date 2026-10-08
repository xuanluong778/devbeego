import fs from "node:fs";
import jwt from "jsonwebtoken";

const PACKAGE_NAME = process.env.GOOGLE_PLAY_PACKAGE_NAME || "vn.beego.app";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/androidpublisher";

let cachedSa = null;
let cachedAccess = null;
let cachedAccessExp = 0;

function loadServiceAccount() {
  if (cachedSa) return cachedSa;
  const inline = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
  const path = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_PATH;
  let raw = inline;
  if (!raw && path && fs.existsSync(path)) {
    raw = fs.readFileSync(path, "utf8");
  }
  if (!raw) return null;
  try {
    cachedSa = JSON.parse(raw);
    return cachedSa;
  } catch {
    return null;
  }
}

async function getAccessToken() {
  const now = Math.floor(Date.now() / 1000);
  if (cachedAccess && cachedAccessExp > now + 60) {
    return cachedAccess;
  }
  const sa = loadServiceAccount();
  if (!sa?.client_email || !sa?.private_key) return null;

  const assertion = jwt.sign(
    {
      iss: sa.client_email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: now,
      exp: now + 3600,
    },
    sa.private_key,
    { algorithm: "RS256" }
  );

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });
  if (!res.ok) return null;
  const data = await res.json();
  cachedAccess = data.access_token;
  cachedAccessExp = now + Number(data.expires_in || 3600);
  return cachedAccess;
}

function allowedProductIds() {
  const all = [
    ...String(process.env.GOOGLE_PLAY_VIP_PRODUCTS || "beego_vip_monthly,beego_vip_yearly").split(","),
    ...String(process.env.GOOGLE_PLAY_PRO_PRODUCTS || "beego_pro_monthly,beego_pro_yearly").split(","),
  ];
  return new Set(all.map((s) => s.trim()).filter(Boolean));
}

/**
 * Verify subscription purchase token with Google Play Developer API.
 * @returns {Promise<{ ok: boolean, code?: string, message?: string, data?: object }>}
 */
export async function verifyGooglePlaySubscription({ purchaseToken, productId, packageName }) {
  const pkg = String(packageName || PACKAGE_NAME).trim();
  if (pkg !== "vn.beego.app") {
    return { ok: false, code: "PACKAGE_MISMATCH", message: "Invalid package name." };
  }
  const token = String(purchaseToken || "").trim();
  const subId = String(productId || "").trim();
  if (!token || !subId) {
    return { ok: false, code: "INVALID_INPUT", message: "Missing token or product id." };
  }
  if (!allowedProductIds().has(subId)) {
    return { ok: false, code: "PRODUCT_UNKNOWN", message: "Unknown subscription product id." };
  }

  const access = await getAccessToken();
  if (!access) {
    return { ok: false, code: "NOT_CONFIGURED", message: "Google Play service account not configured." };
  }

  const url = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${encodeURIComponent(
    pkg
  )}/purchases/subscriptions/${encodeURIComponent(subId)}/tokens/${encodeURIComponent(token)}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${access}` },
  });
  if (res.status === 404) {
    return { ok: false, code: "TOKEN_NOT_FOUND", message: "Purchase token not found." };
  }
  if (!res.ok) {
    return { ok: false, code: "GOOGLE_API_ERROR", message: `Google API HTTP ${res.status}.` };
  }

  const purchase = await res.json();
  const paymentState = Number(purchase.paymentState);
  // 0 = pending, 1 = received, 2 = free trial, 3 = deferred
  if (paymentState !== 1 && paymentState !== 2) {
    return { ok: false, code: "PAYMENT_NOT_ACTIVE", message: "Subscription payment not active." };
  }

  const expiryMs = Number(purchase.expiryTimeMillis || 0);
  if (!expiryMs || expiryMs <= Date.now()) {
    return { ok: false, code: "EXPIRED", message: "Subscription expired." };
  }

  return {
    ok: true,
    data: {
      packageName: pkg,
      productId: subId,
      purchaseToken: token,
      expiryTimeMillis: expiryMs,
      paymentState,
      orderId: purchase.orderId || null,
      acknowledgementState: purchase.acknowledgementState,
      raw: purchase,
    },
  };
}

export function isGooglePlayVerifyConfigured() {
  return Boolean(loadServiceAccount());
}
