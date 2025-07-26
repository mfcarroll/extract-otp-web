import { encode } from "thirty-two";
import { OtpData, MigrationOtpParameter } from "../types";
import { getOtpTypeInfo } from "../ui/otp";

const ALGORITHM_STRING_MAP: { [key: number]: string } = {
  1: "SHA1",
  2: "SHA256",
  3: "SHA512",
  4: "MD5",
};

const DIGITS_VALUE_MAP: { [key: number]: number } = {
  1: 6, // DIGIT_COUNT_SIX
  2: 8, // DIGIT_COUNT_EIGHT
};

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

  // Add algorithm if it's not the default (SHA1)
  if (otp.algorithm && otp.algorithm !== 1) {
    const algoString = ALGORITHM_STRING_MAP[otp.algorithm];
    if (algoString) {
      params.set("algorithm", algoString);
    }
  }

  // Add digits if it's not the default (6)
  if (otp.digits && otp.digits !== 1) {
    const digitValue = DIGITS_VALUE_MAP[otp.digits];
    if (digitValue) {
      params.set("digits", String(digitValue));
    }
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
