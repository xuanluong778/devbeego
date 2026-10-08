# Firebase / FCM — Android (`vn.beego.app`)

## 1. Firebase Console

1. Create or open project **Beego**.
2. Add Android app: package **`vn.beego.app`**.
3. Download **`google-services.json`**.
4. Link Firebase project to **Google Play** app (Play Console → Setup → API access).

## 2. VPS (secrets, not git)

```bash
cp google-services.json /var/www/beego_vn_usr/data/secrets/android/google-services.json
chmod 600 /var/www/beego_vn_usr/data/secrets/android/google-services.json
```

Release prep copies it into the Android module:

```bash
node scripts/prepare-android-release.mjs
```

## 3. Server env (optional, for admin send later)

Add to `.env.local` (not committed):

- `FCM_SERVER_KEY` or service account JSON path for HTTP v1 send API

Backend registration endpoint (live): **`POST /api/push/register`** (Bearer or session).

## 4. Client

- `@capacitor/push-notifications` + `lib/beego/native-push.js`
- Triggered from `NativeBootstrap` on Android

## 5. Verify on device

1. Install release or debug build with `google-services.json` baked in.
2. Allow notifications when prompted.
3. Check DB table `fcm_devices` for new token row after login.

**FCM_E2E=PASS** only after token registration + test push received.
