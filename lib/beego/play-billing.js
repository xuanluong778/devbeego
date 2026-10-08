/**
 * Google Play Billing on Android (Internal Testing).
 * Web keeps Stripe via checkout-client.js.
 */
import { isNativeApp, apiFetch } from "@/lib/beego/native-bridge";

const DEFAULT_PRODUCTS = {
  pro: { monthly: "beego_pro_monthly", yearly: "beego_pro_yearly" },
  vip: { monthly: "beego_vip_monthly", yearly: "beego_vip_yearly" },
};

function productIdFor(plan, billingPeriod) {
  const p = DEFAULT_PRODUCTS[plan === "vip" ? "vip" : "pro"];
  return billingPeriod === "yearly" ? p.yearly : p.monthly;
}

/**
 * @param {"pro"|"vip"} plan
 * @param {{ billingPeriod?: "monthly"|"yearly" }} options
 */
export async function startPlayBillingCheckout(plan, options = {}) {
  if (!isNativeApp()) {
    throw new Error("Play Billing is Android-only.");
  }
  const billingPeriod = options.billingPeriod === "yearly" ? "yearly" : "monthly";
  const productId = productIdFor(plan, billingPeriod);

  // Native bridge: BeegoPlayBilling Capacitor plugin (Play Billing Library 7)
  const plugin = window.Capacitor?.Plugins?.BeegoPlayBilling;
  if (!plugin?.purchase) {
    throw new Error(
      "Google Play Billing chưa sẵn sàng trên bản build này. Dùng gói trên web hoặc chờ bản cập nhật."
    );
  }

  const result = await plugin.purchase({ productId });
  const purchaseToken = result?.purchaseToken || result?.purchase_token;
  if (!purchaseToken) {
    throw new Error("Không nhận được purchase token từ Google Play.");
  }

  const res = await apiFetch("/api/billing/google-play", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: productId,
      purchase_token: purchaseToken,
      package_name: "vn.beego.app",
    }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success) {
    throw new Error(json.message || "Không đồng bộ được gói học với tài khoản.");
  }
  return json;
}

export function isPlayBillingAvailable() {
  return Boolean(isNativeApp() && window.Capacitor?.Plugins?.BeegoPlayBilling?.purchase);
}
