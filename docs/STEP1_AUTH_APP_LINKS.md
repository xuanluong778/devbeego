# Step 1 Report — SHA256 + App Links + Google OAuth

**Backup:** `data/backups/beego.vn.source.pre-android-step1.20260921_121128.tar.gz`

## TEST_RESULT

| Check | Result |
|-------|--------|
| Debug + Release SHA256 generated | PASS |
| `/.well-known/assetlinks.json` (2 fingerprints, `vn.beego.app`) | PASS |
| Google Digital Asset Links API sees statements | PASS |
| AndroidManifest App Links + pathPrefix OAuth | PASS |
| Native OAuth bridge `/auth/native-callback` + `/api/auth/native-exchange` | PASS (code live, page 200) |
| Password Bearer login / refresh / revoke | PASS |
| `/api/auth/me` Bearer | PASS (after fix) |
| Google OAuth end-to-end login | **BLOCKED** |
| **AUTH_APP_LINKS** | **BLOCKED** |

## BLOCKER (dừng đúng bước 1)

`.env.local` hiện:

- `GOOGLE_CLIENT_ID=` **EMPTY**
- `GOOGLE_CLIENT_SECRET=` **EMPTY**
- `GOOGLE_CALLBACK_URL=https://beego.vn/api/auth/google/callback` OK

Không thể hoàn tất Google OAuth / test login Google thật → **không sang bước 2**.

### Bạn cần thao tác (Google Cloud Console)

Chi tiết: `docs/GOOGLE_OAUTH_APP_LINKS.md`

1. Tạo OAuth **Web** client → Redirect: `https://beego.vn/api/auth/google/callback`
2. Tạo OAuth **Android** client → package `vn.beego.app` + SHA256:
   - Debug: `08:2B:25:F0:AE:32:E5:3C:98:61:C0:CA:BD:06:1A:D2:DD:06:24:FB:85:37:62:A7:66:39:F7:B6:D0:F8:15:9D`
   - Release: `03:D7:08:50:34:E1:9A:D4:19:C4:E1:90:3A:93:68:62:01:4F:6E:D4:14:C6:71:7B:D8:61:0A:E8:EC:96:2C:F8`
3. Điền vào `.env.local` trên server (không commit), rồi `pm2 restart beego --update-env`
4. Báo lại khi đã set → sẽ verify Google login → `AUTH_APP_LINKS=PASS` rồi mới FCM

## FILES_CHANGED

- `public/.well-known/assetlinks.json`, `.well-known/assetlinks.json`
- `android/app/src/main/AndroidManifest.xml`
- `lib/auth/google-oauth-android.js`
- `app/api/auth/google/route.ts`, `callback/route.ts`
- `app/api/auth/native-exchange/route.js`
- `app/auth/native-callback/*`
- `app/api/auth/me/route.js` (Bearer)
- `app/auth/page.js`, `middleware.ts`, `NativeBootstrap.jsx`
- `docs/GOOGLE_OAUTH_APP_LINKS.md`, `.gitignore`
- Keystores (ngoài web root): `/var/www/beego_vn_usr/data/secrets/android/`

## CONFIG_CHANGED

- OpenJDK 17 installed (keytool)
- Debug keystore: `~/.android/debug.keystore`
- Release keystore: `/var/www/beego_vn_usr/data/secrets/android/beego-release.keystore` (không commit)
- Env Google vẫn EMPTY (chưa đổi — chờ bạn)
