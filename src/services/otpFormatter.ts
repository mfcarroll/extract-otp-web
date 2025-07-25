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
  // The original Python script removes Base32 padding, so we do the same
  // to ensure compatibility and match the expected output.
  const secretText = encode(otp.secret).toString().replace(/=/g, "");
  const accountName = otp.name || "N/A"; // Use a fallback for display
  const typeInfo = getOtpTypeInfo(otp.type);
  // The label for the otpauth URL is just the account name. The issuer is a separate parameter.
  const encodedLabel = encodeURIComponent(accountName);

  const params = new URLSearchParams({
    secret: secretText,
  });
  if (otp.issuer) {
    params.set("issuer", otp.issuer);
  }
  // The protobuf library decodes int64 as a Long object. Convert it to a number.
  const counterValue = Number(otp.counter || 0);
  if (typeInfo.key === "hotp") {
    params.set("counter", counterValue.toString());
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
    counter: typeInfo.key === "hotp" ? counterValue : "",
    url: otpAuthUrl,
  };
}
