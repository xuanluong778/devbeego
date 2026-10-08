#!/usr/bin/env node
/**
 * Copy release-only Android files from VPS secrets (never committed).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secretsDir = "/var/www/beego_vn_usr/data/secrets/android";
const appDir = path.join(root, "android", "app");

const keystoreProps = path.join(secretsDir, "keystore.properties");
const googleServices = path.join(secretsDir, "google-services.json");
const destGoogle = path.join(appDir, "google-services.json");

if (!fs.existsSync(keystoreProps)) {
  console.error("[prepare-android-release] Missing keystore.properties at", keystoreProps);
  process.exit(1);
}

if (fs.existsSync(googleServices)) {
  fs.copyFileSync(googleServices, destGoogle);
  console.log("[prepare-android-release] Copied google-services.json → android/app/");
} else {
  if (fs.existsSync(destGoogle)) fs.unlinkSync(destGoogle);
  console.warn(
    "[prepare-android-release] google-services.json not in secrets — FCM disabled; AAB can still build."
  );
}

console.log("[prepare-android-release] OK");
