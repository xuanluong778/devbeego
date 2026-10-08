#!/usr/bin/env node
/**
 * Verify signed release AAB metadata (bundletool + cert + secret scan).
 * Does not print secrets or keystore passwords.
 */
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execSync } from "node:child_process";

const aabPath =
  process.argv[2] ||
  "/var/www/beego_vn_usr/data/artifacts/android/beego-release.aab";

const EXPECT = {
  package: "vn.beego.app",
  versionCode: "2",
  versionName: "1.0.1",
  minTargetSdk: 36,
  minCompileSdk: 36,
  sha256:
    "03:D7:08:50:34:E1:9A:D4:19:C4:E1:90:3A:93:68:62:01:4F:6E:D4:14:C6:71:7B:D8:61:0A:E8:EC:96:2C:F8",
  firebaseProjectId: "beego-498605",
  firebaseAppIdSuffix: "457738688586:android:e059160443f0e34b942eb3",
};

const BUNDLETOOL =
  process.env.BUNDLETOOL_JAR || "/opt/android-sdk/bundletool.jar";

function sh(cmd, opts = {}) {
  return execSync(cmd, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts }).trim();
}

function ensureBundletool() {
  if (fs.existsSync(BUNDLETOOL)) return;
  const url =
    "https://github.com/google/bundletool/releases/download/1.17.2/bundletool-all-1.17.2.jar";
  fs.mkdirSync(path.dirname(BUNDLETOOL), { recursive: true });
  sh(`curl -fsSL -o "${BUNDLETOOL}" "${url}"`);
}

function parseManifestXml(xml) {
  const attr = (name) => {
    const m = xml.match(new RegExp(`${name}="([^"]+)"`));
    return m ? m[1] : undefined;
  };
  const manifestTarget = xml.match(/<uses-sdk[^>]*android:targetSdkVersion="(\d+)"/);
  const manifestCompile = xml.match(/android:compileSdkVersion="(\d+)"/);
  const appDebug = /android:debuggable="true"/.test(xml);
  return {
    package: attr("package"),
    versionCode: attr("versionCode"),
    versionName: attr("versionName"),
    targetSdk: manifestTarget ? Number(manifestTarget[1]) : undefined,
    compileSdk: manifestCompile ? Number(manifestCompile[1]) : undefined,
    debuggable: appDebug,
    xml,
  };
}

function certSha256FromAab(aab) {
  const listing = sh(`unzip -Z1 "${aab}"`);
  const rsa = listing.split("\n").find((l) => /^META-INF\/.*\.RSA$/i.test(l.trim()));
  if (!rsa) throw new Error("META-INF/*.RSA not found in AAB");
  const tmp = path.join(os.tmpdir(), `beego-cert-${process.pid}.rsa`);
  sh(`unzip -p "${aab}" "${rsa.trim()}" > "${tmp}"`);
  try {
    const out = sh(`keytool -printcert -file "${tmp}" 2>/dev/null`);
    const m = out.match(/SHA256:\s*([0-9A-Fa-f:]+)/);
    if (!m) throw new Error("SHA256 not in printcert output");
    return m[1].replace(/\s/g, "").toUpperCase();
  } finally {
    try {
      fs.unlinkSync(tmp);
    } catch {
      /* ignore */
    }
  }
}

function secretScan(aab) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "beego-aab-"));
  try {
    sh(`unzip -q -o "${aab}" -d "${tmp}"`);
    const forbidden = [
      /\.env\.local/i,
      /keystore\.properties/i,
      /beego-release\.keystore/i,
      /GOOGLE_CLIENT_SECRET/i,
      /GOCSPX-/i,
    ];
    const hits = [];
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        const st = fs.statSync(p);
        if (st.isDirectory()) walk(p);
        else if (st.size < 5_000_000) {
          try {
            const text = fs.readFileSync(p).toString("utf8", 0, Math.min(st.size, 200_000));
            for (const re of forbidden) {
              if (re.test(text) || re.test(name)) hits.push(name);
            }
          } catch {
            /* binary */
          }
        }
      }
    }
    walk(tmp);
    return hits;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

function bundleStringsContain(aab, needles) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "beego-aab-str-"));
  try {
    sh(`unzip -q -o "${aab}" -d "${tmp}"`);
    const found = new Set();
    function walk(dir) {
      for (const name of fs.readdirSync(dir)) {
        const p = path.join(dir, name);
        if (fs.statSync(p).isDirectory()) walk(p);
        else {
          try {
            const buf = fs.readFileSync(p);
            const text = buf.toString("latin1");
            for (const n of needles) {
              if (text.includes(n)) found.add(n);
            }
          } catch {
            /* ignore */
          }
        }
      }
    }
    walk(tmp);
    return found;
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

if (!fs.existsSync(aabPath)) {
  console.error("AAB not found:", aabPath);
  process.exit(1);
}

const stat = fs.statSync(aabPath);
ensureBundletool();

const manifestRaw = sh(`java -jar "${BUNDLETOOL}" dump manifest --bundle="${aabPath}"`);
const meta = parseManifestXml(manifestRaw);

const hits = secretScan(aabPath);
const secretOk = hits.length === 0;

let certSha;
try {
  certSha = certSha256FromAab(aabPath);
} catch (e) {
  certSha = "";
}

const stringsFound = bundleStringsContain(aabPath, [
  EXPECT.package,
  EXPECT.firebaseProjectId,
  EXPECT.firebaseAppIdSuffix,
]);

const fcmInManifest =
  /pushnotifications\.MessagingService/.test(manifestRaw) &&
  /FirebaseMessagingService/.test(manifestRaw) &&
  /com\.google\.firebase\.MESSAGING_EVENT/.test(manifestRaw);

const firebaseConfigOk =
  stringsFound.has(EXPECT.package) &&
  stringsFound.has(EXPECT.firebaseProjectId) &&
  stringsFound.has(EXPECT.firebaseAppIdSuffix);

const pkgOk = meta.package === EXPECT.package;
const vcOk = meta.versionCode === EXPECT.versionCode;
const vnOk = meta.versionName === EXPECT.versionName;
const targetOk = (meta.targetSdk ?? 0) >= EXPECT.minTargetSdk;
const compileOk = (meta.compileSdk ?? 0) >= EXPECT.minCompileSdk;
const debugOk = !meta.debuggable;
const certOk = certSha === EXPECT.sha256;
let releaseSigningOk = false;
try {
  const jv = sh(`jarsigner -verify "${aabPath}" 2>&1`);
  releaseSigningOk = /jar verified/i.test(jv);
} catch {
  releaseSigningOk = false;
}

const allPass =
  secretOk &&
  pkgOk &&
  vcOk &&
  vnOk &&
  targetOk &&
  compileOk &&
  debugOk &&
  certOk &&
  releaseSigningOk &&
  firebaseConfigOk &&
  fcmInManifest;

console.log("PACKAGE=" + (meta.package ?? ""));
console.log("VERSION_CODE=" + (meta.versionCode ?? ""));
console.log("VERSION_NAME=" + (meta.versionName ?? ""));
console.log("TARGET_SDK=" + (meta.targetSdk ?? ""));
console.log("COMPILE_SDK=" + (meta.compileSdk ?? ""));
console.log("DEBUGGABLE=" + (meta.debuggable ? "true" : "false"));
console.log("FIREBASE_CONFIG=" + (firebaseConfigOk ? "PASS" : "FAIL"));
console.log("FCM_CLIENT=" + (fcmInManifest ? "PASS" : "FAIL"));
console.log("RELEASE_SIGNING=" + (releaseSigningOk ? "PASS" : "FAIL"));
console.log("CERT_MATCH=" + (certOk ? "PASS" : "FAIL"));
console.log("SECRET_SCAN=" + (secretOk ? "PASS" : "FAIL"));
console.log("AAB_PATH=" + aabPath);
console.log("AAB_SIZE=" + stat.size);
console.log("FCM_DEVICE_E2E=PENDING");
console.log("BEEGO_PLAY_INTERNAL_READY=" + (allPass ? "PASS" : "FAIL"));
console.log("VERIFY_AAB=" + (allPass ? "PASS" : "FAIL"));

if (!allPass) {
  if (!secretOk) console.error("SECRET_HITS", [...new Set(hits)].slice(0, 10));
  process.exit(1);
}
