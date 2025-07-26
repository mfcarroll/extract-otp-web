import {
  LastPassQrAccount,
  LastPassQrPayload,
  MigrationOtpParameter,
} from "../types";
import { mapToMigrationOtpParameter, RawOtpAccount } from "./otpDataMapper";

/**
 * Processes the proprietary JSON format from a LastPass QR code, converting its
 * accounts into the standard MigrationOtpParameter format.
 * @param jsonString The string content of the final JSON payload.
 * @returns An array of OTP parameters.
 */
export function processLastPassQrJson(
  jsonString: string
): MigrationOtpParameter[] {
  const data: LastPassQrPayload = JSON.parse(jsonString);

  // The LastPass QR format can vary. The mobile export has a simple `{ a: [...] }`
  // structure. The browser extension export (which we now generate) has a more
  // complex structure. This logic handles both by finding the 'a' (accounts) array,
  // which is present in both formats.
  const accounts = data.a;
  if (!accounts || !Array.isArray(accounts)) {
    throw new Error(
      "Invalid LastPass QR JSON format: 'a' (accounts) array not found."
    );
  }

  return accounts.map((lpAccount: LastPassQrAccount) => {
    const rawAccount: RawOtpAccount = {
      name: lpAccount.oUN,
      issuer: lpAccount.oIN,
      secret: lpAccount.s,
      algorithm: lpAccount.a,
      digits: lpAccount.d,
      // LastPass QR codes seem to only support TOTP
      type: "totp",
    };
    return mapToMigrationOtpParameter(rawAccount);
  });
}
