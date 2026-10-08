# Google OAuth + App Links — thao tác trên Google Cloud / Play

## Trạng thái server

- `GOOGLE_CALLBACK_URL=https://beego.vn/api/auth/google/callback` ✅
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` ❌ **EMPTY** → Google login chưa bật
- `assetlinks.json` đã có SHA256 debug + release cho `vn.beego.app`
- Android OAuth callback → `/auth/native-callback?code=…` → Bearer tokens

## Bạn cần làm trên Google Cloud Console

1. Mở https://console.cloud.google.com/ → chọn/tạo project **Beego**
2. **APIs & Services → Credentials**
3. Tạo **OAuth client ID** loại **Web application**:
   - Authorized redirect URIs: `https://beego.vn/api/auth/google/callback`
   - Copy Client ID + Client Secret
4. Tạo thêm **OAuth client ID** loại **Android**:
   - Package name: `vn.beego.app`
   - SHA-1 hoặc SHA-256 của debug keystore (và release khi có):
     - Debug SHA256: `08:2B:25:F0:AE:32:E5:3C:98:61:C0:CA:BD:06:1A:D2:DD:06:24:FB:85:37:62:A7:66:39:F7:B6:D0:F8:15:9D`
     - Release SHA256: `03:D7:08:50:34:E1:9A:D4:19:C4:E1:90:3A:93:68:62:01:4F:6E:D4:14:C6:71:7B:D8:61:0A:E8:EC:96:2C:F8`
5. Đưa vào server `.env.local` (không commit):

```bash
GOOGLE_CLIENT_ID=<Web client ID>
GOOGLE_CLIENT_SECRET=<Web client secret>
GOOGLE_ANDROID_CLIENT_ID=<Android client ID>   # optional metadata
GOOGLE_CALLBACK_URL=https://beego.vn/api/auth/google/callback
```

6. `pm2 restart beego --update-env` sau khi lưu env
7. OAuth consent screen: thêm test users nếu app ở External/Testing

## Kiểm tra App Links

```bash
curl -sS https://beego.vn/.well-known/assetlinks.json
# Digital Asset Links API:
# https://digitalassetlinks.googleapis.com/v1/statements:list?source.web.site=https://beego.vn&relation=delegate_permission/common.handle_all_urls
```

Trên thiết bị: `adb shell pm get-app-links vn.beego.app`
