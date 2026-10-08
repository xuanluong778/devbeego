# Release signing — `beego-release.keystore`

Gradle reads **`/var/www/beego_vn_usr/data/secrets/android/keystore.properties`** (never commit).

## If `signReleaseBundle` fails with `BadPaddingException`

Usually **`keyPassword` in `keystore.properties` is wrong** while `storePassword` still opens the keystore (`keytool -list` works).

For this project (2026-09-21): the release entry was created with the **same password for store and key**; the properties file had a mismatched `keyPassword` line. Fix: set `keyPassword` equal to `storePassword` (do not regenerate the keystore).

Verify without printing secrets:

```bash
# jarsigner must succeed with storePassword as -keypass
jarsigner ... -storepass "$SP" -keypass "$SP" ...
```

**Do not regenerate the keystore** (Play upload key / assetlinks release SHA must stay).

1. Find the original `keyPassword` saved when the keystore was created (same day as Step 1 Android setup).
2. Update only `keyPassword=` in `keystore.properties` on the VPS.
3. Re-run:

```bash
cd /var/www/beego_vn_usr/data/www/beego.vn
node scripts/prepare-android-release.mjs
npm run cap:sync
cd android && ./gradlew bundleRelease
```

Optional verify (on VPS, passwords not echoed):

```bash
keytool -list -v -keystore /var/www/beego_vn_usr/data/secrets/android/beego-release.keystore -alias beego
```

If both passwords are known, rotate key password in-place:

```bash
keytool -keypasswd -alias beego -keystore /var/www/beego_vn_usr/data/secrets/android/beego-release.keystore
```

Then update `keyPassword` in `keystore.properties` to match.
