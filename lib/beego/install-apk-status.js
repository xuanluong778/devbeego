import fs from "node:fs";
import path from "node:path";
import { emptyInstallStatus, OFFICIAL_APK_HREF, OFFICIAL_APK_RELATIVE } from "@/lib/beego/install-app";

const MIN_APK_BYTES = 500_000;

function readVersionName() {
  try {
    const gradle = fs.readFileSync(
      path.join(process.cwd(), "android/app/build.gradle"),
      "utf8"
    );
    const match = gradle.match(/versionName\s+"([^"]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function isZipMagic(filePath) {
  const fd = fs.openSync(filePath, "r");
  try {
    const head = Buffer.alloc(4);
    const n = fs.readSync(fd, head, 0, 4, 0);
    return n === 4 && head[0] === 0x50 && head[1] === 0x4b && head[2] === 0x03 && head[3] === 0x04;
  } finally {
    fs.closeSync(fd);
  }
}

/**
 * Real file check. Never invents a download URL.
 * @returns {{ apkAvailable: boolean, href: string|null, version: string|null, updatedAt: string|null, statusLabel: string|null }}
 */
export function readOfficialApkStatus() {
  const filePath = path.join(process.cwd(), "public", OFFICIAL_APK_RELATIVE);
  if (!fs.existsSync(filePath)) return emptyInstallStatus();

  let stat;
  try {
    stat = fs.statSync(filePath);
  } catch {
    return emptyInstallStatus();
  }
  if (!stat.isFile() || stat.size < MIN_APK_BYTES) return emptyInstallStatus();

  try {
    if (!isZipMagic(filePath)) return emptyInstallStatus();
  } catch {
    return emptyInstallStatus();
  }

  let version = readVersionName();
  let updatedAt = stat.mtime.toISOString().slice(0, 10);
  const metaPath = `${filePath}.json`;
  if (fs.existsSync(metaPath)) {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8"));
      if (meta?.version) version = String(meta.version);
      if (meta?.updatedAt) updatedAt = String(meta.updatedAt).slice(0, 10);
    } catch {
      /* keep file mtime + gradle version */
    }
  }

  if (!version || !updatedAt) return emptyInstallStatus();

  return {
    apkAvailable: true,
    href: OFFICIAL_APK_HREF,
    version,
    updatedAt,
    statusLabel: null,
  };
}
