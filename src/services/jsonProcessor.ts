import {
  LastPassFileAccount,
  LastPassFilePayload,
  MigrationOtpParameter,
} from "../types";
import { mapToMigrationOtpParameter, RawOtpAccount } from "./otpDataMapper";

/**
 * Processes the content of a LastPass JSON export file, converting its
 * accounts into the standard MigrationOtpParameter format.
 * @param fileContent The string content of the JSON file.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function processJson(
  fileContent: string
): Promise<MigrationOtpParameter[]> {
  const data: LastPassFilePayload = JSON.parse(fileContent);

  if (!data || !Array.isArray(data.accounts)) {
    throw new Error(
      "Invalid LastPass JSON format: 'accounts' array not found."
    );
  }

  return data.accounts.map((lpAccount: LastPassFileAccount) => {
    const rawAccount: RawOtpAccount = {
      name: lpAccount.userName,
      issuer: lpAccount.issuerName,
      secret: lpAccount.secret,
      algorithm: lpAccount.algorithm,
      digits: lpAccount.digits,
      type: lpAccount.timeStep ? "totp" : "hotp",
      counter: lpAccount.counter,
    };
    return mapToMigrationOtpParameter(rawAccount);
  });
}
