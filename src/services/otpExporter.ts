import { encode as base32Encode } from "thirty-two";
import pako from "pako";
import protobuf from "protobufjs";
import { LastPassQrAccount, MigrationOtpParameter } from "../types";
import { uint8ArrayToBase64 } from "./protobufProcessor";

// --- Protobuf and Data Mapping Setup ---

const protobufRoot = protobuf.load("otp_migration.proto");

const ALGORITHM_STRING_MAP: { [key: number]: string } = {
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
  4: "MD5",
};

const DIGITS_VALUE_MAP: { [key: number]: 6 | 8 } = {
  1: 6, // DIGIT_COUNT_SIX
  2: 8, // DIGIT_COUNT_EIGHT
};

// --- Google Authenticator Export ---

/**
 * Creates a Google Authenticator migration URL from a list of OTP parameters.
 * @param otps The list of OTP parameters to export.
 * @returns A promise that resolves to the otpauth-migration URL string.
 */
export async function exportToGoogleAuthenticator(
  otps: MigrationOtpParameter[]
): Promise<string> {
  const root = await protobufRoot;
  const MigrationPayload = root.lookupType("MigrationPayload");

  // The protobuf payload expects the otpParameters field.
  const payload = {
    otpParameters: otps,
    version: 1,
    batchSize: 1,
    batchIndex: 0,
    // Generate a random 32-bit integer for the batch ID.
    batchId: Math.floor(Math.random() * 2 ** 32),
  };

  const errMsg = MigrationPayload.verify(payload);
  if (errMsg) {
    throw new Error(`Protobuf verification failed: ${errMsg}`);
  }

  const message = MigrationPayload.create(payload);
  const buffer = MigrationPayload.encode(message).finish();

  const base64Data = uint8ArrayToBase64(buffer);
  const url = `otpauth-migration://offline?data=${encodeURIComponent(
    base64Data
  )}`;
  return url;
}

// --- LastPass Authenticator Export ---

/**
 * Creates a LastPass Authenticator migration URL from a list of OTP parameters.
 * This version mimics the complex structure observed in LastPass browser extension exports
 * to ensure maximum compatibility.
 * @param otps The list of OTP parameters to export.
 * @returns A promise that resolves to the lpaauth-migration URL string.
 */
export async function exportToLastPass(
  otps: MigrationOtpParameter[]
): Promise<string> {
  // --- Step 1: Map OTPs to the complex LastPass account format ---
  // We mimic the detailed structure seen in your import logs, including a unique ID and timestamp.
  const lastPassAccounts: LastPassQrAccount[] = otps
    .map((otp, index) => {
      if (otp.type !== 2) {
        // LastPass only seems to handle TOTP
        return null;
      }

      const secretText = base32Encode(otp.secret).toString().replace(/=/g, "");
      const algorithm = ALGORITHM_STRING_MAP[otp.algorithm] || "SHA1";
      const digits = DIGITS_VALUE_MAP[otp.digits] || 6;

      const account: LastPassQrAccount = {
        // Essential OTP data
        oUN: otp.name,
        oIN: otp.issuer,
        s: secretText,
        a: algorithm,
        d: digits,
        tS: 30, // LastPass seems to default to a 30-second time step.
        // Mimicked fields from your import log for compatibility
        uN: otp.name,
        iN: otp.issuer,
        aId: crypto.randomUUID().toUpperCase(), // Generate a unique ID for the account
        cT: Date.now(), // Set creation time to now
        iF: false,
        pN: false,
        fD: { folderId: 0, position: index },
      };
      return account;
    })
    .filter((acc): acc is LastPassQrAccount => acc !== null);

  if (lastPassAccounts.length === 0) {
    throw new Error("No compatible (TOTP) accounts found for LastPass export.");
  }

  // --- Step 2: Create the complex inner JSON payload ---
  // This matches the structure from your log's "Step 6".
  const finalJsonPayload = {
    dS: "",
    dId: "",
    a: lastPassAccounts,
    f: [
      // Default folder structure seen in logs
      { iO: true, i: 1, n: "Favorites" },
      { iO: true, i: 0, n: "Other Accounts" },
    ],
  };
  const finalJsonString = JSON.stringify(finalJsonPayload);

  // --- Step 3: Gzip and Base64 encode the inner payload ---
  const finalJsonBytes = new TextEncoder().encode(finalJsonString);
  const gzippedInnerPayload = pako.gzip(finalJsonBytes);
  const contentBase64 = uint8ArrayToBase64(gzippedInnerPayload);

  // --- Step 4: Create the complex outer JSON wrapper ---
  // This matches the structure from your log's "Step 4".
  const jsonWrapper = {
    batchId: crypto.randomUUID().toUpperCase(),
    batchSize: 1,
    version: 3, // Matches the imported version
    batchIndex: 0,
    content: contentBase64,
  };
  const jsonWrapperString = JSON.stringify(jsonWrapper);

  // --- Step 5: Gzip and Base64 encode the outer wrapper ---
  const jsonWrapperBytes = new TextEncoder().encode(jsonWrapperString);
  const gzippedOuterPayload = pako.gzip(jsonWrapperBytes);
  const finalBase64Data = uint8ArrayToBase64(gzippedOuterPayload);

  // --- Step 6: Construct the final URL with the correct '/offline' path ---
  const url = `lpaauth-migration://offline?data=${encodeURIComponent(
    finalBase64Data
  )}`;

  console.log("[LastPass Export] Final URL constructed:", url);
  return url;
}
