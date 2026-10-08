#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-/opt/android-sdk}"
export ANDROID_SDK_ROOT="$ANDROID_HOME"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-17-openjdk-amd64}"
export PATH="$JAVA_HOME/bin:$ANDROID_HOME/cmdline-tools/latest/bin:$PATH"

cd "$ROOT"
node scripts/prepare-android-release.mjs
npm run cap:sync
cd android
./gradlew bundleRelease --no-daemon

ART="/var/www/beego_vn_usr/data/artifacts/android"
mkdir -p "$ART"
cp -f app/build/outputs/bundle/release/app-release.aab "$ART/beego-release.aab"
node "$ROOT/scripts/verify-android-aab.mjs" "$ART/beego-release.aab"
ls -lh "$ART/beego-release.aab"
