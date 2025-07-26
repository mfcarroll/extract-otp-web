import {
  LastPassFileAccount,
  LastPassFilePayload,
  MigrationOtpParameter,
  OtpData,
} from "../types";
import { mapToMigrationOtpParameter, RawOtpAccount } from "./otpDataMapper";
import { getOtpParametersFromUrl } from "./otpUrlParser";

/**
 * Processes the content of a LastPass JSON export file, converting its
 * accounts into the standard MigrationOtpParameter format.
 * @param fileContent The string content of the JSON file.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function processJson(
  fileContent: string
): Promise<MigrationOtpParameter[]> {
  const data: any = JSON.parse(fileContent);

  // Check if the data is an array, which indicates our own export format.
  if (Array.isArray(data)) {
    const otpDataArray = data as OtpData[];
    const allOtpParams: MigrationOtpParameter[] = [];

    // Process each item in the array by parsing its otpauth URL.
    for (const otpDataItem of otpDataArray) {
      if (otpDataItem.url && typeof otpDataItem.url === "string") {
        try {
          const params = await getOtpParametersFromUrl(otpDataItem.url);
          allOtpParams.push(...params);
        } catch (error) {
          // Log a warning and skip entries that can't be parsed.
          console.warn(
            `Skipping invalid entry in JSON file: ${otpDataItem.name}`,
            error
          );
        }
      }
    }
    return allOtpParams;
  }

  // Otherwise, assume it's a LastPass JSON export file.
  const lastPassPayload = data as LastPassFilePayload;
  if (lastPassPayload && Array.isArray(lastPassPayload.accounts)) {
    return lastPassPayload.accounts.map((lpAccount: LastPassFileAccount) => {
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

  // If neither format matches, throw an error.
  throw new Error(
    "Invalid JSON format: Expected an array of OTP accounts or a LastPass export object."
  );
}
