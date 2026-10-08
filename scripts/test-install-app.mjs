#!/usr/bin/env node
/**
 * Install offer: platform copy + real APK file check. No fake download URL.
 */
import { detectInstallPlatform, installOfferModel, emptyInstallStatus } from "../lib/beego/install-app.js";
import { readOfficialApkStatus } from "../lib/beego/install-apk-status.js";

const fail = [];
const check = (name, ok) => {
  if (!ok) fail.push(name);
  console.log((ok ? "PASS" : "FAIL") + " " + name);
};

const ios = installOfferModel("ios", emptyInstallStatus());
const android = installOfferModel("android", emptyInstallStatus());
const desktop = installOfferModel("desktop", emptyInstallStatus());
const androidLive = installOfferModel("android", {
  apkAvailable: true,
  href: "/downloads/beego.apk",
  version: "1.0.1",
  updatedAt: "2026-09-21",
});
const iosLive = installOfferModel("ios", {
  apkAvailable: true,
  href: "/downloads/beego.apk",
  version: "1.0.1",
  updatedAt: "2026-09-21",
});

check("detect ios", detectInstallPlatform("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)") === "ios");
check("detect android", detectInstallPlatform("Mozilla/5.0 (Linux; Android 14)") === "android");
check("detect desktop", detectInstallPlatform("Mozilla/5.0 (Windows NT 10.0)") === "desktop");
check("ios steps no apk", ios.showIosSteps && !ios.showApkButton && ios.apkHref == null);
check("android coming soon", android.showComingSoon && !android.showApkButton && android.apkHref == null);
check("desktop no apk button", !desktop.showApkButton && desktop.apkHref == null);
check("android real file shows button", androidLive.showApkButton && androidLive.apkHref === "/downloads/beego.apk" && androidLive.version === "1.0.1");
check("iphone never shows apk even if file exists", !iosLive.showApkButton && iosLive.showIosSteps);

const disk = readOfficialApkStatus();
check(
  "disk status official apk",
  disk.apkAvailable === true &&
    disk.href === "/downloads/beego.apk" &&
    disk.version === "1.0.1" &&
    Boolean(disk.updatedAt)
);

const base = process.env.BEEGO_TEST_BASE || "https://beego.vn";
async function head(url) {
  const res = await fetch(url, { method: "GET", redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  return {
    status: res.status,
    type: res.headers.get("content-type") || "",
    start: buf.subarray(0, 8).toString("latin1"),
    png: buf.length >= 4 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47,
  };
}

const api = await fetch(`${base}/api/app/install`, { cache: "no-store" }).then((r) => r.json());
check(
  "live api apk ready",
  api?.success === true &&
    api.data?.apkAvailable === true &&
    api.data?.href === "/downloads/beego.apk" &&
    api.data?.version === "1.0.1"
);

const manifest = await head(`${base}/manifest.webmanifest`);
check("manifest", manifest.status === 200 && manifest.type.includes("json") && manifest.start.includes("{"));

for (const icon of ["beego-180.png", "beego-192.png", "beego-512.png"]) {
  const hit = await head(`${base}/icons/${icon}`);
  check("icon " + icon, hit.status === 200 && hit.type.includes("image/png") && hit.png);
}

const apk = await head(`${base}/downloads/beego.apk`);
check(
  "official apk download",
  apk.status === 200 &&
    !apk.type.includes("text/html") &&
    apk.start.charCodeAt(0) === 0x50 &&
    apk.start.charCodeAt(1) === 0x4b
);

if (fail.length) {
  console.log("INSTALL_APP_TEST=FAIL " + fail.join(","));
  process.exit(1);
}
console.log("INSTALL_APP_TEST=PASS");
