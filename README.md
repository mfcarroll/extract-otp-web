# One-Time Password Secret Extractor

A simple, secure, and purely client-side web tool to extract One-Time Password (OTP) secrets from Google Authenticator and LastPass Authenticator QR code exports.

## [Open the tool →](https://mfcarroll.github.io/extract-otp-web/)

[https://mfcarroll.github.io/extract-otp-web/](https://mfcarroll.github.io/extract-otp-web/)

## Features

- Load from Google Authenticator bulk QR codes
- Load from LastPass Authenticator bulk QR codes
- Load from regular otpauth QR codes
- Load from LastPass Authenticator JSON export
- Display individual OTP secrets and QR codes
- Save to CSV
- Save to JSON
- Export to Google Authenticator bulk QR code
- Export to LastPass Authenticator bulk QR code
- Scan direct from camera

## Why is this needed?

Google Authenticator lets you transfer your accounts to a new phone, but it doesn't provide an easy way to export them to other apps like 1Password or Bitwarden. This is because it hides the original "secret" (the QR code you first scanned) for each account.

Without these secrets, moving to a new password manager means manually re-configuring 2-Factor Authentication for every single account, which is a huge pain.

While other tools exist to solve this, they often require technical steps like running scripts or installing software. This tool is designed to be a simple, secure, one-click solution that runs entirely in your browser.

## How to Use

This tool reads the QR code screenshots from Google Authenticator or LastPass Authenticator's export feature and gives you back the original secret for each account. You can then use these secrets to import your accounts into any other authenticator app.

1.  **Export from your One-Time Password App**:

    _Export from Google Authenticator_:
    - Open the Google Authenticator app on your phone.
    - Go to the menu and select "Transfer accounts" > "Export accounts".
    - Select the accounts you wish to export.
    - Take a screenshot of each QR code that is displayed.

    _Export from LastPass_:
    - Open the LastPass Authenticator on your phone.
    - Click on the cog and select "Transfer accounts" > "Export accounts to QR code".
    - Take a screenshot of each QR code that is displayed.

    (For lastpass, you can also choose "Export accounts to file" and upload that instead. This tool supports both formats.)

2.  **Extract Secrets**:
    - [Open this tool in your web browser](https://mfcarroll.github.io/extract-otp-web/)
    - Click "Select QR Code Image(s)" or drag and drop your screenshot(s) onto the page.

3.  **Use Your Secrets**:
    - The tool will display the extracted OTP secrets, each with its own QR code and secret key.
    - You can now import these secrets into your preferred authenticator app or password manager.

## Security and Privacy

Security and privacy are the top priorities of this tool.

- **Nothing you upload ever leaves your device.** All processing happens locally, right in your browser.
- Your QR code images and the secrets they contain are never sent to any server.
- This tool is open-source and [the code can be inspected by anyone](https://github.com/mfcarroll/extract-otp-web) to verify its safety and methodology. It is hosted on GitHub pages, providing a [secure and transparent deployment process](https://github.com/mfcarroll/extract-otp-web/deployments/github-pages).
- For maximum security, you can download the source code from GitHub and run it on a local, offline machine.

## Development

This project is built with [Vite](https://vitejs.dev/).

### Prerequisites

- [Node.js](https://nodejs.org/) (version 22 or higher)
- npm, pnpm, or yarn

### Running Locally

1.  Clone the repository:

    ```bash
    git clone https://github.com/mfcarroll/extract-otp-web.git
    cd extract-otp-web
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Start the development server:

    ```bash
    npm run dev
    ```

4.  Open your browser to the local URL provided.

### Translations

English is written once. Page text lives in `index.html`, where each translatable element has a `data-i18n="key"` attribute (or `data-i18n-attr="attribute:key"`). Messages the app shows while running live in `src/i18n/en.json` and are looked up in code with `t('key')`.

Each other language is a single file, `src/i18n/translations/<code>.json`, which starts with a `language` block (its name, `lang` and `published` flag, plus optional `contributors`, who are credited in the Acknowledgements). Each contributor needs a `name` or `github` username, and may add a `url`. Empty fields are ignored, so `{ "name": "", "github": "", "url": "" }` works as a template to fill in. The credit shows their name if given (otherwise their username), linked to their `url` if given (otherwise their GitHub profile). Languages are found by scanning that folder, so adding one changes no shared file, and the footer language links are generated from them. The build generates a separate page for each language (for example `/fr/`), so search engines index every language. On the development server, every language is available, including drafts.

- `npm run i18n -- add fr Français fr-CA fr` starts a new language as a draft.
- `npm run i18n -- check` validates all translations. CI runs this.
- `npm run i18n -- todo fr` prints the English that still needs translating, or that changed since it was translated, as JSON.
- `npm run i18n -- import fr file.json` merges translations in that same shape into the language file.
- `npm run i18n -- confirm all <key>` marks translations as still correct after an English edit that doesn't affect them, such as a typo fix.

Translations may only use a few inline tags (`<a>`, `<strong>`, `<em>`, `<code>`, `<br>`), and links may only point to URLs the English already uses. A language is only built and linked once `published` is set to `true` in its file. To preview draft languages in a production build, run `I18N_DRAFTS=1 npm run build`.

## Acknowledgements

This tool was created by [Matthew Carroll](https://www.linkedin.com/in/matthewfcarroll/), a developer who was frustrated with the process of migrating OTP codes from Google Authenticator into other password managers.

It was made possible by building on the work of several open-source projects, including:

- [Extract OTP Secrets](https://github.com/scito/extract_otp_secrets/#readme), the python script by [Roland Kurmann](https://scito.ch/), on which this tool is based.
- [Aegis Authenticator](https://github.com/beemdevelopment/Aegis/#readme), for the Google Authenticator export protobuf specification.
- [Google Authenticator Exporter](https://github.com/krissrex/google-authenticator-exporter/#readme), another python script solution to the same problem.

The user interface and QR code processing are powered by these excellent open-source libraries:

- [jsQR](https://github.com/cozmo/jsQR#readme) for decoding QR codes from images.
- [protobuf.js](https://github.com/protobufjs/protobuf.js#readme) for decoding the Google Authenticator data payload.
- [pica](https://github.com/nodeca/pica#readme) for high-quality image resizing.
- [QR Scanner](https://github.com/nimiq/qr-scanner/#readme) for scanning QR codes using the camera.
- [node-qrcode](https://github.com/soldair/node-qrcode#readme) for generating new QR codes for each account.
- [thirty-two](https://github.com/wzrdtales/thirty-two#readme) for Base32 encoding the OTP secrets.
- [Font Awesome](https://github.com/FortAwesome/Font-Awesome#readme) for the icons used in the UI.

[Gemini Code Assist](https://codeassist.google/) was used during the development of this tool. All AI-generated code has been carefully manually reviewed.

The development of this tool was made possible in part through the support of [Stand.earth](https://stand.earth/). If you find this useful, please [consider making a donation](https://stand.earth/donate/) to support Stand's work.
