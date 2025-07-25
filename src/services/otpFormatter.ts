import { encode } from "thirty-two";
import { OtpData, MigrationOtpParameter } from "../types";
import { getOtpTypeInfo } from "../ui/otp";

/**
 * Converts a raw MigrationOtpParameter from the QR code payload into a
 * user-friendly OtpData object, with an encoded secret and a generated URL.
 * @param otp The raw OTP parameter.
 * @returns A formatted OtpData object.
 */
export function convertToOtpData(otp: MigrationOtpParameter): OtpData {
  const secretText = encode(otp.secret).toString();
  const accountName = otp.name || "N/A"; // Use a fallback for display
  const typeInfo = getOtpTypeInfo(otp.type);

  let label = accountName;
  if (otp.issuer) {
    label = `${otp.issuer}:${accountName}`;
  }
  const encodedLabel = encodeURIComponent(label);

  const params = new URLSearchParams({
    secret: secretText,
  });
  if (otp.issuer) {
    params.set("issuer", otp.issuer);
  }
  if (typeInfo.key === "hotp") {
    params.set("counter", (otp.counter || 0).toString());
  }
  const otpAuthUrl = `otpauth://${
    typeInfo.key
  }/${encodedLabel}?${params.toString()}`;

  return {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || "",
    type: typeInfo.key,
    typeDescription: typeInfo.description,
    counter: typeInfo.key === "hotp" ? otp.counter || 0 : "",
    url: otpAuthUrl,
  };
}
