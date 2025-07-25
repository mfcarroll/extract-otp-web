export interface OtpData {
  name: string;
  secret: string;
  issuer: string;
  type: string;
  typeDescription: string;
  counter: number | "";
  url: string;
}

// Define a more specific type for the raw OTP data from the protobuf payload.
export interface MigrationOtpParameter {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: number; // ALGORITHM_UNSPECIFIED (0), SHA1 (1)
  digits: number; // DIGITS_UNSPECIFIED (0), SIX (1), EIGHT (2)
  type: number; // TYPE_UNSPECIFIED (0), HOTP (1), TOTP (2)
  counter: number;
}
