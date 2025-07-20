export enum OtpType {
  HOTP = 1,
  TOTP = 2,
}

export interface OtpTypeInfo {
  key: string;
  description: string;
}

/**
 * Returns descriptive information about the OTP type.
 * Defaults to HOTP for unknown numeric types based on original logic.
 * @param type The numeric OTP type from the migration data.
 * @returns An object with a protocol 'key' and a full 'description'.
 */
export function getOtpTypeInfo(type: number): OtpTypeInfo {
  if (type === OtpType.TOTP) {
    return {
      key: "totp",
      description: "Time-based one-time password",
    };
  }
  return {
    key: "hotp",
    description: "HMAC-based one-time password",
  };
}
