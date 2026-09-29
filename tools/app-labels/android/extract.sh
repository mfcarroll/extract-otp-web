#!/usr/bin/env bash
# Reads Google Authenticator's "Transfer codes" > "Export codes" labels in
# every language from an Android emulator or device (via adb), and writes
# them as JSON keyed by Android resource qualifier (e.g. "fr-rCA").
#
# Usage: tools/app-labels/android/extract.sh [out.json]
#
# The app's translations come in per-language packs that Play only installs
# for the languages in use, so this sets the app's own language list
# (Android 13+), which makes Play download them, and resets it afterwards.
set -euo pipefail
PKG=com.google.android.apps.authenticator2
OUT=${1:-android-labels.json}
LANGS="en,fr,fr-CA,es,es-419,pt-BR,pt-PT,de,it,nl,ja,ko,zh-CN,zh-TW,zh-HK,ru,uk,pl,tr,id,ms,vi,th,hi,bn,ar,he,fa,ro,cs,sk,hu,el,sv,da,nb,fi,ca,hr,bg,sr,sl,lt,lv,et,fil,ur,ta,sw"
AAPT2=$(ls "${ANDROID_HOME:-$HOME/Library/Android/sdk}"/build-tools/*/aapt2 | tail -1)
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"; adb shell cmd locale set-app-locales $PKG --user 0 --locales "" >/dev/null' EXIT

adb shell cmd locale set-app-locales $PKG --user 0 --locales "$LANGS"
echo "Waiting for Play to install the language packs..."
for _ in $(seq 1 20); do
  sleep 15
  n=$(adb shell pm path $PKG | grep -c split_config || true)
  echo "  $n packs"
  [ "$n" -ge 44 ] && break
done

DIR=$(adb shell pm path $PKG | head -1 | sed 's/package://; s/base.apk//' | tr -d '\r')
for apk in $(adb shell pm path $PKG | sed 's/.*\///' | tr -d '\r'); do
  adb pull "$DIR$apk" "$WORK/" >/dev/null
  "$AAPT2" dump resources "$WORK/$apk" >> "$WORK/all.txt" 2>/dev/null || true
done

# string/migration is the menu item; the export button is on the next screen.
node - "$WORK/all.txt" "$OUT" <<'JS'
const fs = require('fs');
const [file, out] = process.argv.slice(2);
const want = {
  'string/migration': 'transfer',
  'string/migration_page_introduction_export_heading': 'export',
};
const labels = {};
let current = null;
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  const resource = line.match(/resource 0x[0-9a-f]+ (\S+)$/);
  if (resource) { current = want[resource[1]] ?? null; continue; }
  const value = current && line.match(/^\s+\(([^)]*)\) "(.*)"$/);
  if (value) (labels[value[1] || 'default'] ??= {})[current] = value[2];
}
fs.writeFileSync(out, JSON.stringify(labels, null, 2) + '\n');
console.log(`Wrote ${Object.keys(labels).length} languages to ${out}`);
JS
