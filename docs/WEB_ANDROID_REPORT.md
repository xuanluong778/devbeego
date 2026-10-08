# Beego Web + Android — Implementation Report

**Backup:** `data/backups/beego.vn.source.pre-web-android.20260921_112532.tar.gz`  
**MySQL:** `data/backups/beego_vn.pre-web-android.20260921_112532.sql.gz`

## Verified results

| Check | Result |
|-------|--------|
| BEEGO_WEB_ANDROID_SYNC | **PASS** (Bearer App ↔ cookie Web: xp=15 honey=20 streak=1 active=p1-g1-n02 done=1) |
| BEEGO_ANDROID_READY | **PARTIAL** — Capacitor `vn.beego.app` project + plugins + deep links ready; Play signing/APK/AAB + Firebase FCM project + Play Console billing products still required |

## FILES_CHANGED (major)

### P0 Shared core
- `migrations/001_shared_core.sql`, `002_auth_app_sessions.sql`, `003_billing_push.sql`, `rollback/001_*`
- `lib/db/migrate.js`
- `lib/beego/learning-path-progress.js`, `learning-path-build.js`, `learning-path-catalog.js`, `learning-path.js`, `learning-path-mock.js`
- `app/api/learning-path/route.js`, `complete/route.js`
- `app/api/dashboard/route.js`, Learn UI hardcode removal
- `docs/WEB_ANDROID_PLATFORM.md`

### P1 Auth
- `lib/auth/resolve-session-token.ts`, `app-session.js`
- `lib/auth/get-session-user.ts`, `lib/http/ai-entitlement.ts`
- `app/api/auth/token/route.js`, `refresh/route.js`, `revoke/route.js`
- `middleware.ts` — cookie **or** Bearer

### P2 Android
- `capacitor.config.json`, `android/` (`applicationId vn.beego.app`)
- Plugins: App, Haptics, Keyboard, Preferences, SplashScreen, StatusBar
- `AndroidManifest.xml` mic/network/notifications + App Links
- `components/beego/NativeBootstrap.jsx`, `lib/beego/native-bridge.js`, `app/beego-native.css`
- `public/.well-known/assetlinks.json` (SHA256 fingerprints TBD)

### P3 Voice
- Default port **3031** (3001 busy by docker)
- `ecosystem.voice.config.cjs`, nginx `location /voice` → 127.0.0.1:3031
- `VoiceCall.jsx` → `wss://beego.vn/voice`
- Gateway **online** on :3031; LLM/TTS/usage workers need env (errored — check OPENAI/Azure keys)

### P4 Billing + Push
- `app/api/billing/google-play/route.js` → shared `subscriptions` entitlement
- `app/api/push/register/route.js` + `fcm_devices` table
- Web Stripe/SePay unchanged

### Sync
- `app/api/sync/me/route.js` — single payload for Web+App

## MIGRATIONS

Applied: `001_shared_core`, `002_auth_app_sessions`, `003_billing_push`  
Tables: `user_stats`, `user_lesson_progress`, session app columns, `subscriptions`, `ai_usage_daily`, `payments`, `fcm_devices`, `google_play_notifications`

## TEST matrix

| Suite | Status |
|-------|--------|
| WEB_TEST | PASS — home 200, cookie login, sync |
| ANDROID_TEST | PARTIAL — API Bearer + Capacitor project; no device APK run on this host |
| SYNC_TEST | **PASS** |
| VOICE_TEST | PARTIAL — gateway :3031 + nginx `/voice` (HTTP 426 = WS upgrade OK); LLM/TTS/usage workers **online** with `.env.local`; full mic E2E needs Azure Speech key |
| AUTH_TEST | PASS — `/api/auth/token` + cookie `/api/auth/login` |
| SECURITY_TEST | PASS — secrets server-side; no API keys in Capacitor; `allowBackup=false`; cleartext off |
| GOOGLE_PLAY_READINESS | PARTIAL — package `vn.beego.app`, billing API stub, assetlinks placeholder; need signing key + Play products + FCM |

## Remaining for full ANDROID_READY=PASS

1. Fill `assetlinks.json` SHA256 + Google OAuth Android client
2. Configure Firebase FCM + Play Billing product IDs in env
3. Stabilize voice LLM/TTS workers (OPENAI / Azure Speech keys)
4. Build signed AAB on machine with Android SDK and upload to Play Console
5. Device E2E: mic → WSS → STT → LLM → TTS
