import { decode as thirtyTwoDecode } from "thirty-two";
import { MigrationOtpParameter } from "../types";

/**
 * Defines the structure of an account within a LastPass JSON export.
 * This is based on observed `accounts.json` files.
 */
interface LastPassAccount {
  userName: string;
  issuerName: string;
  secret: string; // Base32 encoded secret
  algorithm: string; // LastPass can support more than just SHA1
  digits: 6 | 8;
  timeStep?: number; // Indicates TOTP if present
  counter?: number; // Indicates HOTP if present
}

/**
 * Defines the overall structure of a LastPass JSON export file.
 */
interface LastPassJson {
  accounts: LastPassAccount[];
}

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
 * Processes the content of a LastPass JSON export file, converting its
 * accounts into the standard MigrationOtpParameter format.
 * @param fileContent The string content of the JSON file.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function processJson(
  fileContent: string
): Promise<MigrationOtpParameter[]> {
  const data: LastPassJson = JSON.parse(fileContent);

  if (!data || !Array.isArray(data.accounts)) {
    throw new Error(
      "Invalid LastPass JSON format: 'accounts' array not found."
    );
  }

  return data.accounts.map((acc) => {
    // The 'thirty-two' library decodes to a Buffer, which needs to be converted to Uint8Array.
    const secretBytes = new Uint8Array(thirtyTwoDecode(acc.secret));
    const algorithmValue = ALGORITHM_MAP[acc.algorithm.toUpperCase()] || 0; // Default to ALGO_INVALID
    const digitsValue = DIGITS_MAP[acc.digits] || 0; // Default to DIGIT_COUNT_UNSPECIFIED

    return {
      secret: secretBytes,
      name: acc.userName,
      issuer: acc.issuerName,
      algorithm: algorithmValue,
      digits: digitsValue,
      type: acc.timeStep ? 2 : 1, // 2 = TOTP, 1 = HOTP
      counter: acc.counter || 0,
    };
  });
}
