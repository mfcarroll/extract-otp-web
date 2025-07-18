# Google Authenticator OTP Secret Extractor

A simple, secure, and purely client-side web tool to extract One-Time Password (OTP) secrets from Google Authenticator QR code exports.

## [Open the tool →](https://mfcarroll.github.io/extract-otp-web/)

[https://mfcarroll.github.io/extract-otp-web/](https://mfcarroll.github.io/extract-otp-web/)

## Why is this needed?

Google Authenticator lets you transfer your accounts to a new phone, but it doesn't provide an easy way to export them to other apps like 1Password or Bitwarden. This is because it hides the original "secret" (the QR code you first scanned) for each account.

Without these secrets, moving to a new password manager means manually re-configuring 2-Factor Authentication for every single account, which is a huge pain.

While other tools exist to solve this, they often require technical steps like running scripts or installing software. This tool is designed to be a simple, secure, one-click solution that runs entirely in your browser.

## How to Use

This tool reads the QR code screenshots from Google Authenticator's export feature and gives you back the original secret for each account. You can then use these secrets to import your accounts into any other authenticator app.

1.  **Export from Google Authenticator**:

    - Open the Google Authenticator app on your phone.
    - Go to the menu and select "Transfer accounts" > "Export accounts".
    - Select the accounts you wish to export.
    - Take a screenshot of each QR code that is displayed.

2.  **Extract Secrets**:

    - [Open this tool in your web browser](https://mfcarroll.github.io/extract-otp-web/)
    - Click "Select QR Code Image(s)" or drag and drop your screenshot(s) onto the page.

3.  **Use Your Secrets**:
    - The tool will display the extracted OTP secrets, each with its own QR code and secret key.
    - You can now import these secrets into your preferred authenticator app or password manager.

## Security and Privacy

Security and privacy are the top priorities of this tool.

- **Nothing you upload ever leaves your computer.** All processing happens locally, right in your browser.
- Your QR code images and the secrets they contain are never sent to any server.
- This tool is open-source and [the code can be inspected by anyone](https://github.com/mfcarroll/extract-otp-web) to verify its safety and methodology. It is hosted on GitHub pages, providing a [secure and transparent deployment process](https://github.com/mfcarroll/extract-otp-web/deployments/github-pages).
- For maximum security, you can download the source code from GitHub and run it on a local, offline machine.

## Development

This project is built with [Vite](https://vitejs.dev/).

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
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

## Acknowledgements

This tool was created by [Matthew Carroll](https://www.linkedin.com/in/matthewfcarroll/), a developer who was frustrated with the process of migrating OTP codes from Google Authenticator into other password managers.

It was made possible by building on the work of several open-source projects, including:

- [Extract OTP Secrets](https://github.com/scito/extract_otp_secrets/#readme), the python script by [Roland Kurmann](https://scito.ch/), on which this tool is based.
- [Aegis Authenticator](https://github.com/beemdevelopment/Aegis/#readme), for the Google Authenticator export protobuf specification.
- [Google Authenticator Exporter](https://github.com/krissrex/google-authenticator-exporter/#readme), another python script solution to the same problem.

The user interface and QR code processing are powered by these excellent open-source libraries:

- [jsQR](https://github.com/cozmo/jsQR) for decoding QR codes from images.
- [protobuf.js](https://github.com/protobufjs/protobuf.js) for decoding the Google Authenticator data payload.
- [qrcode](https://github.com/soldair/node-qrcode) for generating new QR codes for each account.
- [thirty-two](https://github.com/wzrdtales/thirty-two) for Base32 encoding the OTP secrets.

[Gemini Code Assist](https://codeassist.google/) was used during the development of this tool. All AI-generated code has been carefully manually reviewed.

The development of this tool was made possible in part through the support of [Stand.earth](https://stand.earth/). If you found this useful, and want to help protect the people and places you love, please [consider making a donation](https://stand.earth/donate/) to support Stand's work.
