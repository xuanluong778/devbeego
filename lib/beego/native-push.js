/**
 * FCM registration for Capacitor Android → POST /api/push/register
 */
import { isNativeApp, apiFetch } from "@/lib/beego/native-bridge";

let started = false;

export async function initNativePush() {
  if (!isNativeApp() || started) return { ok: false, reason: "skip" };
  if (typeof window === "undefined") return { ok: false, reason: "ssr" };
  started = true;

  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    const perm = await PushNotifications.checkPermissions();
    if (perm.receive !== "granted") {
      const req = await PushNotifications.requestPermissions();
      if (req.receive !== "granted") {
        return { ok: false, reason: "permission_denied" };
      }
    }

    await PushNotifications.addListener("registration", async (token) => {
      const value = token?.value;
      if (!value) return;
      try {
        await apiFetch("/api/push/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: value,
            platform: "android",
            app_version: process.env.NEXT_PUBLIC_APP_VERSION || "1.0.1",
          }),
        });
      } catch {
        /* retry on next launch */
      }
    });

    await PushNotifications.addListener("registrationError", () => {
      started = false;
    });

    await PushNotifications.register();
    return { ok: true };
  } catch (e) {
    started = false;
    return { ok: false, reason: e?.message || "plugin_error" };
  }
}
