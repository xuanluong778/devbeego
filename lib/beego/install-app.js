/**
 * Install-offer helpers (web). Official APK is only public/downloads/beego.apk.
 * A missing or non-APK file must not produce a download URL.
 */

export const INSTALL_CARD_DISMISS_KEY = "beego:install-card-dismissed";
export const OFFICIAL_APK_HREF = "/downloads/beego.apk";
export const OFFICIAL_APK_RELATIVE = "downloads/beego.apk";

/** @param {string} ua */
export function detectInstallPlatform(ua = "") {
  const s = String(ua || "");
  if (/iPhone|iPad|iPod/i.test(s)) return "ios";
  if (/Android/i.test(s)) return "android";
  return "desktop";
}

export function emptyInstallStatus() {
  return {
    apkAvailable: false,
    href: null,
    version: null,
    updatedAt: null,
    statusLabel: "Sắp ra mắt",
  };
}

/** What the offer may render. APK control is Android-only and only when a real file exists. */
export function installOfferModel(platform, info) {
  const status = info?.apkAvailable ? info : emptyInstallStatus();
  const showApkButton = platform === "android" && status.apkAvailable === true && Boolean(status.href);
  return {
    platform,
    showApkButton,
    apkHref: showApkButton ? status.href : null,
    showIosSteps: platform === "ios",
    showComingSoon: platform === "android" && !showApkButton,
    version: showApkButton ? status.version : null,
    updatedAt: showApkButton ? status.updatedAt : null,
  };
}
