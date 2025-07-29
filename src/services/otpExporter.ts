/**
 * This module handles the logic for exporting OTP secrets into various formats,
 * specifically for Google Authenticator and LastPass Authenticator. It constructs
 * the complex, proprietary `otpauth-migration://` and `lpaauth-migration://`
 * URLs that these apps use for their QR code-based account transfer features.
 * This involves data mapping, protobuf serialization for Google, and a nested,
 * gzipped JSON structure for LastPass.
 */
import { encode as base32Encode } from "thirty-two";
import pako from "pako";
import protobuf from "protobufjs";
import { LastPassQrAccount, MigrationOtpParameter } from "../types";
import { uint8ArrayToBase64 } from "./protobufProcessor";
import { generateUUID } from "./uuid";
import { logger } from "./logger";

// --- Constants ---

/**
 * Default values for the Google Authenticator protobuf payload.
 * These are based on observed exports and seem to be constant.
 */
const GOOGLE_PAYLOAD_DEFAULTS = {
  VERSION: 1,
  BATCH_SIZE: 1,
  BATCH_INDEX: 0,
};

/**
 * Default values used when constructing a LastPass Authenticator export.
 */
const LASTPASS_DEFAULTS = {
  VERSION: 3,
  TIME_STEP: 30,
  DEFAULT_FOLDER_ID: 0,
};

// --- Protobuf and Data Mapping Setup ---

// Pre-load the protobuf definition once for better performance.
const protobufRoot = protobuf.load("otp_migration.proto");

/**
 * Maps the internal algorithm enum (number) back to the string representation
 * required by the `otpauth://` URL standard.
 */
const ALGORITHM_STRING_MAP: { [key: number]: string } = {
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
  4: "MD5",
};

/**
 * Maps the internal digits enum (number) back to the actual number of digits
 * (6 or 8) required by the `otpauth://` URL standard.
 */
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
    version: GOOGLE_PAYLOAD_DEFAULTS.VERSION,
    batchSize: GOOGLE_PAYLOAD_DEFAULTS.BATCH_SIZE,
    batchIndex: GOOGLE_PAYLOAD_DEFAULTS.BATCH_INDEX,
    // The batch ID seems to be a random 32-bit integer. We generate one here
    // to mimic the behavior of the official app.
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

/**
 * Helper function to stringify, gzip, and Base64 encode a JSON payload.
 * @param payload The JSON object to process.
 * @returns The final Base64 encoded string.
 */
function gzipAndBase64Encode(payload: object): string {
  const jsonString = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(jsonString);
  const gzippedPayload = pako.gzip(jsonBytes);
  return uint8ArrayToBase64(gzippedPayload);
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
  const lastPassAccounts: LastPassQrAccount[] = otps
    .map((otp, index) => {
      if (otp.type !== 2) {
        // LastPass QR code exports only support TOTP accounts.
        // Filter out any incompatible HOTP accounts.
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
        tS: LASTPASS_DEFAULTS.TIME_STEP, // LastPass seems to default to a 30-second time step.
        uN: otp.name,
        iN: otp.issuer,
        aId: generateUUID().toUpperCase(), // Generate a unique ID for the account
        cT: Date.now(), // Set creation time to now
        iF: false,
        pN: false,
        fD: { folderId: LASTPASS_DEFAULTS.DEFAULT_FOLDER_ID, position: index },
      };
      return account;
    })
    .filter((acc): acc is LastPassQrAccount => acc !== null);

  if (lastPassAccounts.length === 0) {
    throw new Error(
      "No compatible (TOTP) accounts selected for LastPass export."
    );
  }

  // --- Step 2: Create the complex inner JSON payload ---
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

  // --- Step 3: Gzip and Base64 encode the inner payload ---
  const contentBase64 = gzipAndBase64Encode(finalJsonPayload);

  // --- Step 4: Create the complex outer JSON wrapper ---
  const jsonWrapper = {
    batchId: generateUUID().toUpperCase(),
    batchSize: 1,
    version: LASTPASS_DEFAULTS.VERSION, // Matches the imported version
    batchIndex: 0,
    content: contentBase64,
  };

  // --- Step 5: Gzip and Base64 encode the outer wrapper ---
  const finalBase64Data = gzipAndBase64Encode(jsonWrapper);

  // --- Step 6: Construct the final URL with the correct '/offline' path ---
  const url = `lpaauth-migration://offline?data=${encodeURIComponent(
    finalBase64Data
  )}`;

  // This log is useful for debugging the complex nested structure.
  logger.debug("[LastPass Export] Final URL constructed:", url);
  return url;
}
