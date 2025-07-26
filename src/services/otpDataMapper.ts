import { decode as thirtyTwoDecode } from "thirty-two";
import { MigrationOtpParameter } from "../types";

// Shared constants for mapping OTP algorithm and digit counts.
export const ALGORITHM_MAP: { [key: string]: number } = {
  SHA1: 1,
  "SHA1-256": 2, // LastPass proprietary name for SHA256
  SHA256: 2,
  SHA512: 3,
  MD5: 4,
};

export const DIGITS_MAP: { [key: number]: number } = {
  6: 1, // DIGIT_COUNT_SIX
  8: 2, // DIGIT_COUNT_EIGHT
};

// A generic representation of an account from various sources
export interface RawOtpAccount {
  name: string;
  issuer: string;
  secret: string; // Base32 encoded
  algorithm: string;
  digits: 6 | 8;
  type: "totp" | "hotp";
  counter?: number;
}

/**
 * Converts a raw account object from various sources into the standard
 * MigrationOtpParameter format.
 * @param acc The raw account object.
 * @returns A MigrationOtpParameter object.
 */
export function mapToMigrationOtpParameter(
  acc: RawOtpAccount
): MigrationOtpParameter {
  const secretBytes = new Uint8Array(thirtyTwoDecode(acc.secret));
  const algorithmValue = ALGORITHM_MAP[acc.algorithm.toUpperCase()] || 0;
  const digitsValue = DIGITS_MAP[acc.digits] || 0;

  return {
    secret: secretBytes,
    name: acc.name,
    issuer: acc.issuer,
    algorithm: algorithmValue,
    digits: digitsValue,
    type: acc.type === "totp" ? 2 : 1,
    counter: acc.counter || 0,
  };
}
