import pako from "pako";
import { decode as thirtyTwoDecode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { base64ToUint8Array, decodeProtobufPayload } from "./protobufProcessor";
import { processLastPassQrJson } from "./lastPassFormatter";

const ALGORITHM_MAP: { [key: string]: number } = {
  SHA1: 1,
  SHA256: 2,
  SHA512: 3,
  MD5: 4,
};

const DIGITS_MAP: { [key: number]: number } = {
  6: 1, // DIGIT_COUNT_SIX
  8: 2, // DIGIT_COUNT_EIGHT
};

/**
 * Decodes a standard otpauth:// URL into OTP parameters.
 * This is used for single-account QR codes, sometimes exported by apps like LastPass.
 * @param otpUrlString The full otpauth:// URL.
 */
async function decodeStandardOtpAuthUrl(
  otpUrlString: string
): Promise<MigrationOtpParameter[]> {
  const url = new URL(otpUrlString);

  const type = url.hostname.toLowerCase(); // 'totp' or 'hotp'
  if (type !== "totp" && type !== "hotp") {
    throw new Error(`Unsupported OTP type in URL: ${type}`);
  }

  const label = decodeURIComponent(url.pathname.substring(1));
  const params = url.searchParams;

  const secretB32 = params.get("secret");
  if (!secretB32) {
    throw new Error("Missing 'secret' parameter in otpauth URL.");
  }
  const secretBytes = new Uint8Array(thirtyTwoDecode(secretB32));

  let issuer = params.get("issuer");
  let name = label;

  if (issuer) {
    // If issuer is in params, it's the authority.
    // The label might still contain the issuer. If so, remove it for a cleaner name.
    if (name.startsWith(`${issuer}:`)) {
      name = name.substring(issuer.length + 1).trim();
    }
  } else {
    // If issuer is not in params, try to extract from label "Issuer:Name".
    const parts = label.split(":");
    if (parts.length > 1) {
      issuer = parts[0];
      name = parts.slice(1).join(":").trim();
    }
  }

  const algorithmStr = (params.get("algorithm") || "SHA1").toUpperCase();
  const algorithm = ALGORITHM_MAP[algorithmStr] || 0; // 0 for invalid/unspecified

  const digitsStr = params.get("digits") || "6";
  const digits = DIGITS_MAP[parseInt(digitsStr, 10)] || 0; // 0 for unspecified

  const otp: MigrationOtpParameter = {
    secret: secretBytes,
    name: name,
    issuer: issuer || "",
    algorithm: algorithm,
    digits: digits,
    type: type === "totp" ? 2 : 1, // 2 for TOTP, 1 for HOTP
    counter: 0, // Default counter
  };

  if (type === "hotp") {
    const counterStr = params.get("counter");
    if (!counterStr) {
      throw new Error(
        "Missing 'counter' parameter for hotp type in otpauth URL."
      );
    }
    otp.counter = parseInt(counterStr, 10);
  }

  return [otp];
}

/**
 * Decodes a standard Google Authenticator payload.
 * Format: Base64(Protobuf)
 * @param dataBase64 The base64 data from the URL.
 */
async function decodeGoogleAuthenticatorPayload(
  dataBase64: string
): Promise<MigrationOtpParameter[]> {
  const protobufData = base64ToUint8Array(dataBase64);
  return decodeProtobufPayload(protobufData);
}

/**
 * Decodes a LastPass Authenticator payload.
 * The format is a gzipped JSON string, which itself contains a
 * base64-encoded, gzipped JSON payload.
 * Format: Base64(Gzip(JSON({ content: Base64(Gzip(JSON_final)) })))
 * @param dataBase64 The base64 data from the URL.
 */
async function decodeLastPassPayload(
  dataBase64: string
): Promise<MigrationOtpParameter[]> {
  console.log("[LastPass Import] Step 1: Received Base64 data", dataBase64);
  const decodedBytes = base64ToUint8Array(dataBase64);
  console.log(
    "[LastPass Import] Step 2: Decoded Base64 to Uint8Array",
    decodedBytes
  );

  try {
    // The outer layer is Gzipped JSON.
    const jsonWrapperBytes = pako.inflate(decodedBytes);
    console.log(
      "[LastPass Import] Step 3: Inflated outer payload",
      jsonWrapperBytes
    );
    const jsonWrapperString = new TextDecoder().decode(jsonWrapperBytes);
    console.log(
      "[LastPass Import] Step 4: Decoded outer payload to JSON string",
      jsonWrapperString
    );
    const jsonWrapper = JSON.parse(jsonWrapperString);

    if (jsonWrapper.content && typeof jsonWrapper.content === "string") {
      const contentBase64 = jsonWrapper.content;
      console.log(
        "[LastPass Import] Step 5: Extracted inner Base64 content",
        contentBase64
      );

      // The 'content' field is a Base64 encoded, Gzipped JSON string.
      const gzippedInnerPayload = base64ToUint8Array(contentBase64);
      const finalJsonBytes = pako.inflate(gzippedInnerPayload);
      const finalJsonString = new TextDecoder().decode(finalJsonBytes);
      console.log(
        "[LastPass Import] Step 6: Decoded final inner JSON string",
        finalJsonString
      );

      // The final JSON string can be processed by our formatter.
      return processLastPassQrJson(finalJsonString);
    }

    // If we are here, the 'content' property was missing from the outer JSON.
    throw new Error(
      "Invalid LastPass QR code: 'content' property not found in payload."
    );
  } catch (e) {
    console.error("Failed to decode or decompress LastPass payload:", e);
    throw new Error(
      "Failed to decode LastPass QR code. The data format is not recognized or is corrupted."
    );
  }
}

/**
 * Extracts OTP parameters from an authenticator export URL.
 * @param otpUrl The full otpauth-migration or lpaauth-migration URL from the QR code.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function getOtpParametersFromUrl(
  otpUrl: string
): Promise<MigrationOtpParameter[]> {
  const trimmedUrl = otpUrl.trim();
  const isLastPass = trimmedUrl.startsWith("lpaauth-migration://");
  const isGoogleAuth = trimmedUrl.startsWith("otpauth-migration://");
  const isStandardOtp = trimmedUrl.startsWith("otpauth://");

  if (isStandardOtp) {
    return decodeStandardOtpAuthUrl(trimmedUrl);
  }

  if (!isLastPass && !isGoogleAuth) {
    throw new Error(
      "QR code is not a supported OTP export format (Google, LastPass, or standard otpauth)."
    );
  }

  const url = new URL(otpUrl);
  const dataBase64 = url.searchParams.get("data");

  if (!dataBase64) {
    throw new Error('Invalid OTP URL: Missing "data" parameter.');
  }

  if (isLastPass) {
    return decodeLastPassPayload(dataBase64);
  } else {
    return decodeGoogleAuthenticatorPayload(dataBase64);
  }
}
