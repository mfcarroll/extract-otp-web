import { decode as thirtyTwoDecode } from "thirty-two";
import { MigrationOtpParameter } from "../types";

// This interface is based on the JSON structure found inside
// the gzipped 'content' field of a LastPass QR code.
interface LastPassQrAccount {
  oUN: string; // Original user name
  oIN: string; // Original issuer name
  s: string; // Base32 encoded secret
  a: string; // Algorithm (e.g., "SHA1")
  d: 6 | 8; // Digits
  tS: number; // Time step
}

/**
 * Defines the overall structure of the JSON payload from a LastPass QR code.
 */
interface LastPassQrJson {
  a: LastPassQrAccount[];
}

// These maps are similar to the ones in jsonProcessor.ts
const ALGORITHM_MAP: { [key: string]: number } = {
  SHA1: 1,
  SHA256: 2,
  "SHA1-256": 2, // Add this line to handle LastPass's proprietary name for SHA256
  SHA512: 3,
  MD5: 4,
};

const DIGITS_MAP: { [key: number]: number } = {
  6: 1, // DIGIT_COUNT_SIX
  8: 2, // DIGIT_COUNT_EIGHT
};

/**
 * Processes the proprietary JSON format from a LastPass QR code, converting its
 * accounts into the standard MigrationOtpParameter format.
 * @param jsonString The string content of the final JSON payload.
 * @returns An array of OTP parameters.
 */
export function processLastPassQrJson(
  jsonString: string
): MigrationOtpParameter[] {
  const data: LastPassQrJson = JSON.parse(jsonString);

  if (!data || !Array.isArray(data.a)) {
    throw new Error("Invalid LastPass QR JSON format: 'a' array not found.");
  }

  return data.a.map((acc) => {
    // The 'thirty-two' library decodes to a Buffer, which needs to be converted to Uint8Array.
    const secretBytes = new Uint8Array(thirtyTwoDecode(acc.s));
    const algorithmValue = ALGORITHM_MAP[acc.a.toUpperCase()] || 0; // Default to ALGO_INVALID
    const digitsValue = DIGITS_MAP[acc.d] || 0; // Default to DIGIT_COUNT_UNSPECIFIED

    return {
      secret: secretBytes,
      name: acc.oUN,
      issuer: acc.oIN,
      algorithm: algorithmValue,
      digits: digitsValue,
      // LastPass QR codes seem to only support TOTP
      type: 2, // 2 = TOTP
    };
  });
}
