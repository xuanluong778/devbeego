#!/usr/bin/env bash
# Copy signed release APK to public/downloads/beego.apk (official sideload URL).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
DEST="$ROOT/public/downloads/beego.apk"
META="$DEST.json"

if [[ ! -f "$SRC" ]]; then
  echo "Missing APK: $SRC — run: cd android && ./gradlew assembleRelease" >&2
  exit 1
fi
mkdir -p "$(dirname "$DEST")"
cp -f "$SRC" "$DEST"
chmod 644 "$DEST"
VERSION="$(grep -m1 'versionName' "$ROOT/android/app/build.gradle" | sed 's/.*"\([^"]*\)".*/\1/')"
DATE="$(date +%Y-%m-%d)"
cat > "$META" <<EOF
{"version":"$VERSION","updatedAt":"$DATE","label":"Beego Android"}
EOF
chmod 644 "$META"
echo "Published $DEST ($(du -h "$DEST" | cut -f1)) version=$VERSION"
