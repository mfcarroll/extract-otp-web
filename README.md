# One-Time Password Secret Extractor

A simple, secure tool that extracts one-time password (OTP) secrets, the codes used for two-factor authentication (2FA), from Google Authenticator and LastPass Authenticator exports. It runs entirely in your browser: there's nothing to install, and no data ever leaves your device.

## [Open the tool →](https://mfcarroll.github.io/extract-otp-web/)

[https://mfcarroll.github.io/extract-otp-web/](https://mfcarroll.github.io/extract-otp-web/)

Also available in [العربية](https://mfcarroll.github.io/extract-otp-web/ar/), [Català](https://mfcarroll.github.io/extract-otp-web/ca/), [Čeština](https://mfcarroll.github.io/extract-otp-web/cs/), [Dansk](https://mfcarroll.github.io/extract-otp-web/da/), [Deutsch](https://mfcarroll.github.io/extract-otp-web/de/), [Ελληνικά](https://mfcarroll.github.io/extract-otp-web/el/), [Español](https://mfcarroll.github.io/extract-otp-web/es/), [Suomi](https://mfcarroll.github.io/extract-otp-web/fi/), [Français](https://mfcarroll.github.io/extract-otp-web/fr/), [עברית](https://mfcarroll.github.io/extract-otp-web/he/), [हिन्दी](https://mfcarroll.github.io/extract-otp-web/hi/), [Hrvatski](https://mfcarroll.github.io/extract-otp-web/hr/), [Magyar](https://mfcarroll.github.io/extract-otp-web/hu/), [Bahasa Indonesia](https://mfcarroll.github.io/extract-otp-web/id/), [Italiano](https://mfcarroll.github.io/extract-otp-web/it/), [日本語](https://mfcarroll.github.io/extract-otp-web/ja/), [한국어](https://mfcarroll.github.io/extract-otp-web/ko/), [Bahasa Melayu](https://mfcarroll.github.io/extract-otp-web/ms/), [Norsk bokmål](https://mfcarroll.github.io/extract-otp-web/nb/), [Nederlands](https://mfcarroll.github.io/extract-otp-web/nl/), [Polski](https://mfcarroll.github.io/extract-otp-web/pl/), [Português](https://mfcarroll.github.io/extract-otp-web/pt/), [Română](https://mfcarroll.github.io/extract-otp-web/ro/), [Русский](https://mfcarroll.github.io/extract-otp-web/ru/), [Slovenčina](https://mfcarroll.github.io/extract-otp-web/sk/), [Svenska](https://mfcarroll.github.io/extract-otp-web/sv/), [ไทย](https://mfcarroll.github.io/extract-otp-web/th/), [Türkçe](https://mfcarroll.github.io/extract-otp-web/tr/), [Українська](https://mfcarroll.github.io/extract-otp-web/uk/), [Tiếng Việt](https://mfcarroll.github.io/extract-otp-web/vi/), [简体中文](https://mfcarroll.github.io/extract-otp-web/zh/), [繁體中文](https://mfcarroll.github.io/extract-otp-web/zh-hant/). These are machine translations, so please [help improve them](CONTRIBUTING.md#translations).

## Features

- **Scan with your camera**: point your computer's camera at the export QR codes on your phone. No screenshots needed.
- **Open files or drag and drop**: screenshots of export QR codes, LastPass export files (JSON), or this tool's own saved files (CSV or JSON).
- **Enter a code**: paste a secret key or `otpauth://` setup link and get its setup QR code back.
- **Reads**:
  - Google Authenticator export QR codes (`otpauth-migration://`)
  - LastPass Authenticator export QR codes and export files
  - Individual setup QR codes from any app (`otpauth://`)
  - Text files with one secret key or setup link per line
- **Shows** each account's secret key, setup link and a scannable QR code.
- **Saves** your accounts as CSV or JSON, which you can open here again later.
- **Exports** selected accounts back to Google Authenticator or LastPass Authenticator as a transfer QR code.

## Why is this needed?

Google Authenticator lets you transfer your accounts to a new phone, but it doesn't provide an easy way to export them to other apps like 1Password or Bitwarden. This is because it hides the original "secret" (the QR code you first scanned) for each account.

Without these secrets, moving to a new password manager means manually re-configuring 2FA for every single account, which is a huge pain.

While other tools exist to solve this, they often require technical steps like running scripts or installing software. This tool is designed to be a simple, secure solution that anyone can use.

## How to use

1. **Export from your one-time password app**

   _Google Authenticator_: open the app on your phone, go to the menu and select "Transfer accounts" > "Export accounts" (on Android: "Transfer codes" > "Export codes"), then select the accounts you want to export.

   _LastPass Authenticator_: open the app on your phone, tap the cog and select "Transfer accounts" > "Export accounts to QR code". You can also choose "Export accounts to file" and open that file in the tool instead.

2. **Extract the secrets**

   [Open the tool](https://mfcarroll.github.io/extract-otp-web/) on your computer or a second device, and click "Scan QR" to scan the export QR codes on your phone directly. This is the most convenient option, and it avoids storing screenshots of your secrets.

   Alternatively, take a screenshot of each QR code, then click "Open File(s)" or drag and drop the screenshots onto the page.

3. **Use your secrets**

   The tool shows each account with its own QR code and secret key, ready to import into your preferred authenticator app or password manager. You can also save them as CSV or JSON, or export them to Google Authenticator or LastPass Authenticator.

4. **Clean up**

   Any screenshots or saved files contain your secrets **unencrypted**. Store them securely, or delete them when you're done, including from your "Trash", "Recycle Bin", "Recently Deleted" and any cloud photo backups.

## Security and privacy

Security and privacy are the top priorities of this tool.

- **Nothing you do here ever leaves your device.** All processing happens locally, offline, right in your browser. Your QR code images and secrets are never sent to any server.
- For the most privacy, use "Scan QR" to read the codes straight from your phone, without taking screenshots.
- This tool is open source, so [the code can be inspected by anyone](https://github.com/mfcarroll/extract-otp-web) to verify its safety and methodology. It is hosted on GitHub Pages, providing a [secure and transparent deployment process](https://github.com/mfcarroll/extract-otp-web/deployments/github-pages).
- For maximum security, you can download the source code and run it on an offline computer (see [Running locally](#running-locally)).

## Contributing

Contributions are very welcome, and most don't need any coding:

- **Found a problem?** [Report it](https://github.com/mfcarroll/extract-otp-web/issues/new/choose).
- **Speak another language?** You can [improve a translation or add a new language](CONTRIBUTING.md#translations), just by pointing out wording or filling in a spreadsheet.
- **Want to change the code?** See [CONTRIBUTING.md](CONTRIBUTING.md#code).

## Running locally

You'll need [Node.js](https://nodejs.org/) 22 or later.

```bash
git clone https://github.com/mfcarroll/extract-otp-web.git
cd extract-otp-web
npm install
npm run dev
```

Then open the local address it prints. To run the built site with no network access, run `npm run build` and serve the `dist` folder, or use `npm run preview`.

## Acknowledgements

This tool was created by [Matthew Carroll](https://www.linkedin.com/in/matthewfcarroll/), a developer who was frustrated with the process of migrating OTP codes from Google Authenticator into other password managers.

It builds on the work of several open-source projects, including:

- [Extract OTP Secrets](https://github.com/scito/extract_otp_secrets/#readme), the Python script by [Roland Kurmann](https://scito.ch/), on which this tool is based.
- [Aegis Authenticator](https://github.com/beemdevelopment/Aegis/#readme) and [Chris van Marle](https://github.com/qistoph/otp_export/#readme), for the export protobuf specification.
- [Google Authenticator Exporter](https://github.com/krissrex/google-authenticator-exporter/#readme), another Python script solution to the same problem.

The user interface and QR code processing are powered by these open-source libraries:

- [jsQR](https://github.com/cozmo/jsQR#readme) for decoding QR codes from images.
- [protobuf.js](https://github.com/protobufjs/protobuf.js#readme) for decoding the Google Authenticator data payload.
- [pica](https://github.com/nodeca/pica#readme) for high-quality image resizing.
- [QR Scanner](https://github.com/nimiq/qr-scanner/#readme) for scanning QR codes using the camera.
- [node-qrcode](https://github.com/soldair/node-qrcode#readme) for generating new QR codes for each account.
- [thirty-two](https://github.com/wzrdtales/thirty-two#readme) for Base32 encoding the OTP secrets.
- [Font Awesome](https://github.com/FortAwesome/Font-Awesome#readme) for the icons used in the UI.

Translations are credited on the tool's Acknowledgements page, and in each language's file in [`src/i18n/translations`](src/i18n/translations).

[Gemini Code Assist](https://codeassist.google/) and [Claude Code](https://claude.com/claude-code) were used during the development of this tool. All AI-generated code has been carefully manually reviewed.

The development of this tool was made possible in part through the support of [Stand.earth](https://stand.earth/). If you find this useful, please [consider making a donation](https://stand.earth/donate/) to support Stand's work.
