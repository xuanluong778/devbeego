/**
 * Log client-side billing funnel events (requires login).
 * @param {"paywall_shown" | "upgrade_clicked"} event
 */
export async function trackBillingClientEvent(event, metadata) {
  try {
    await fetch("/api/billing/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({
        event,
        metadata: metadata && typeof metadata === "object" ? metadata : {},
      }),
    });
  } catch {
    /* non-blocking */
  }
}

import { isNativeApp } from "@/lib/beego/native-bridge";
import { isPlayBillingAvailable, startPlayBillingCheckout } from "@/lib/beego/play-billing";

/**
 * Web: Stripe Checkout. Android app: Google Play Billing when plugin is available.
 * @param {"pro" | "vip"} plan
 * @param {{ billingPeriod?: "monthly" | "yearly" }} [options]
 */
export async function startStripeCheckout(plan, options) {
  const billingPeriod =
    options && options.billingPeriod === "yearly" ? "yearly" : "monthly";
  await trackBillingClientEvent("upgrade_clicked", { plan, billing_period: billingPeriod });

  if (isNativeApp() && isPlayBillingAvailable()) {
    await startPlayBillingCheckout(plan, { billingPeriod });
    return;
  }

  const res = await fetch("/api/billing/checkout", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify({ plan, billing_period: billingPeriod }),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.success || !json.data?.url) {
    const msg = json.message || (res.status === 401 ? "Please sign in to upgrade." : "Could not start checkout.");
    throw new Error(msg);
  }
  window.location.assign(json.data.url);
}

/** API JSON shape from entitlement routes. */
export function isPaywallResponse(json) {
  return Boolean(json && json.code === "PAYWALL");
}
