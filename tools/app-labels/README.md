# App labels

The translated instructions quote Google Authenticator's own menu labels, so
a reader can find them on their phone. The two platforms differ:

- **iOS:** "Transfer accounts" > "Export accounts"
- **Android:** "Transfer codes" > "Export codes"

[`google-authenticator.json`](google-authenticator.json) has both, read from
the apps themselves in 49 languages. `null` means the app shows English in
that language. [`lastpass-authenticator.json`](lastpass-authenticator.json)
has LastPass Authenticator's labels (Settings > "Transfer accounts" > "Export
accounts to QR code" / "Export accounts to file"), which are the same on iOS
and Android. LastPass is only translated into a few languages; in the others,
quote its English labels with a translation in brackets. Use these when adding or checking a translation.

An app's supported languages are listed on the App Store (though LastPass also
has Japanese, which its listing omits; iOS Settings > the app > Language shows
the full list):
`curl "https://itunes.apple.com/lookup?bundleId=com.google.Authenticator"`
(see `languageCodesISO2A`).

## Refreshing the labels

### Android (emulator or device, via adb)

```bash
tools/app-labels/android/extract.sh google android-labels.json
tools/app-labels/android/extract.sh lastpass lastpass-android-labels.json
```

This needs the app installed from Play and `aapt2` from the Android SDK build
tools. It reads the label strings straight from the app's resources, without
opening the app. Google Authenticator's translations are per-language packs
that Play installs only for languages in use, so for it the script sets the
app's own language list (Android 13 or later; this makes Play download them)
and resets the list afterwards. LastPass Authenticator includes every language
in the app itself.

### iOS (a real iPhone; the app isn't available in the Simulator)

The Xcode project in [`ios/`](ios) is a UI test that launches Google
Authenticator once per language (with a per-launch language setting, so the
phone's own language never changes), opens the menu, and reads the two labels.
It never taps Export, never reads account rows, and filters out anything that
looks like an email address or a code.

With the iPhone connected, unlocked and in Developer Mode:

```bash
cd tools/app-labels/ios
xcodebuild test -project LabelReader.xcodeproj -scheme LabelReader \
  -destination 'id=<device UDID>' -allowProvisioningUpdates \
  DEVELOPMENT_TEAM=<your team ID> \
  -only-testing:LabelReaderUITests/LabelReaderUITests/testReadLabels \
  | grep RESULT
```

For LastPass Authenticator, run `testReadLastPassLabels` instead and grep for
`LASTPASS`.

Approve the UI automation prompt on the phone (and Face ID, if the app asks).
Each `RESULT|language|transfer|export` line is one language; "same as English"
means the app isn't translated into it. To retry some languages, prefix the
command with `TEST_RUNNER_LABEL_LANGS=he,lv`. `xcrun devicectl list devices`
shows the UDID.
