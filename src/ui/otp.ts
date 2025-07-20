export enum OtpType {
  HOTP = 1,
  TOTP = 2,
}

export interface OtpTypeInfo {
  short: string;
  full: string;
}

/**
 * Returns descriptive information about the OTP type.
 * Defaults to HOTP for unknown numeric types based on original logic.
 * @param type The numeric OTP type from the migration data.
 * @returns An object with 'short' and 'full' name strings.
 */
export function getOtpTypeInfo(type: number): OtpTypeInfo {
  if (type === OtpType.TOTP) {
    return {
      short: "totp",
      full: "Time-based one-time password",
    };
  }
  return {
    short: "hotp",
    full: "HMAC-based one-time password",
  };
}
