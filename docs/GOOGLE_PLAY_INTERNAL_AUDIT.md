# Google Play — Internal Testing readiness audit

**Package (fixed):** `vn.beego.app`  
**Date:** 2026-09-21  
**Goal:** Signed AAB uploadable to **Internal testing** (not Production).

## Device QA (confirmed)

| Check | Status |
|-------|--------|
| ANDROID_AUDIO_DEVICE_E2E | **PASS** |

## Play policy — target API (Sep 2026)

| Requirement | Beego |
|-------------|--------|
| New apps / updates (phone) target API **36** (from 2026-08-31) | `compileSdk` / `targetSdk` → **36** |
| Existing app discoverability floor API 35 | Met when targeting 36 |

Ref: [Target API level requirements](https://support.google.com/googleplay/android-developer/answer/11926878)

## Checklist

| Item | Status | Notes |
|------|--------|--------|
| Application ID `vn.beego.app` | PASS | |
| `versionCode` / `versionName` | PASS | See `android/app/build.gradle` |
| Release keystore (unchanged) | PASS | `/var/www/beego_vn_usr/data/secrets/android/beego-release.keystore` |
| Release signing in Gradle | PASS | Reads `keystore.properties` outside repo |
| Debuggable false (release) | PASS | |
| `webContentsDebuggingEnabled` false | PASS | `capacitor.config.json` |
| No secrets in AAB assets | VERIFY | Run `scripts/verify-android-aab.mjs` after build |
| `assetlinks.json` (debug + release SHA) | PASS | Digital Asset Links API lists both |
| App Links intent filters | PASS | `AndroidManifest.xml` |
| Google OAuth Web + Android client IDs | PASS | `.env.local` (not in repo) |
| Native OAuth `/auth/native-callback` | PASS | HTTP 200 |
| Firebase `google-services.json` | **BLOCKER until file added** | Place at `data/secrets/android/google-services.json`; copied at release prep |
| FCM client (`@capacitor/push-notifications`) | CODE READY | E2E after `google-services.json` + Firebase project |
| Play Billing (digital goods) | PARTIAL | Server `/api/billing/google-play`; native IAP bridge stub — configure products in Play Console |
| Permissions justified | PASS | INTERNET, NETWORK, RECORD_AUDIO (speak), POST_NOTIFICATIONS (Android 13+) |
| Adaptive launcher icon | PASS | Default Capacitor mipmaps (replace with brand art before public launch) |
| Splash | PASS | Capacitor SplashScreen #FFF8E7 |
| Signed AAB artifact | **BLOCKED** | `bundleRelease` fails: `keyPassword` in `keystore.properties` ≠ keystore private key (see `docs/GOOGLE_PLAY_SIGNING.md`) |
| **BEEGO_PLAY_INTERNAL_READY** | **NOT PASS** | Needs signed AAB + `google-services.json` for full FCM |

## Console-only (not code)

- Create app in Play Console → Internal testing track
- Store listing, privacy policy URL, content rating questionnaire
- Upload AAB, add testers
- Play Billing products: `beego_pro_monthly`, `beego_pro_yearly`, `beego_vip_monthly`, `beego_vip_yearly` (or env overrides)
- Link Firebase project to Play app for FCM

## Commands

```bash
cd /var/www/beego_vn_usr/data/www/beego.vn
node scripts/prepare-android-release.mjs
npm run cap:sync
cd android && ./gradlew bundleRelease
node scripts/verify-android-aab.mjs
```
