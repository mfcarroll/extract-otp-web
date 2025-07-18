# Google Authenticator OTP Secret Extractor

A simple, secure, and purely client-side web tool to extract One-Time Password (OTP) secrets from Google Authenticator QR code exports.

## Features

- **Purely Local**: No data ever leaves your computer. All processing happens directly in your browser.
- **No Installation**: It's just a [web page](https://mfcarroll.github.io/extract-otp-web/); no software to install.
- **Secure & Private**: Your OTP secrets are sensitive, and this tool is designed with privacy as the top priority.
- **Open Source**: The code is available for inspection to verify its security and methodology.

## Why is this needed?

Google Authenticator allows transferring accounts to another instance of the Google Authenticator app, but it doesn't provide an easy way to view the original secrets for each OTP. This makes it challenging to migrate to other password managers like 1Password, Bitwarden, or others without resetting 2-Factor Authentication for each account individually. This tool simplifies that migration process by extracting the secrets for you.

## How to Use

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

## Security

This application is designed to be completely client-side. No images or secret keys are ever uploaded to a server. All processing is done using JavaScript running in your browser. You can verify this by inspecting the source code.

For maximum security, you can download the source code from GitHub and run it on a local, offline machine.

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
