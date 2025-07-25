import { encode } from "thirty-two";
import { OtpData, MigrationOtpParameter } from "../types";

/**
 * Converts a raw MigrationOtpParameter from the QR code payload into a
 * user-friendly OtpData object, with an encoded secret and a generated URL.
 * @param otp The raw OTP parameter.
 * @returns A formatted OtpData object.
 */
export function convertToOtpData(otp: MigrationOtpParameter): OtpData {
  const secretText = encode(otp.secret);
  const accountName = otp.name || "N/A";
  const typeText = otp.type === 2 ? "totp" : "hotp";

  let label = accountName;
  if (otp.issuer) {
    label = `${otp.issuer}:${accountName}`;
  }
  const encodedLabel = encodeURIComponent(label);

  let otpAuthUrl = `otpauth://${typeText}/${encodedLabel}?secret=${secretText}`;
  if (otp.issuer) {
    otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
  }
  if (typeText === "hotp") {
    otpAuthUrl += `&counter=${otp.counter || 0}`;
  }

  return {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || "",
    type: typeText,
    counter: typeText === "hotp" ? otp.counter || 0 : "",
    url: decodeURIComponent(otpAuthUrl),
  };
}
