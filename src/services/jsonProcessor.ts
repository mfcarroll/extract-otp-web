/**
 * This module is responsible for processing JSON files. It can intelligently
 * detect and parse different JSON formats, including the application's own
 * export format and the format used by LastPass Authenticator's file export.
 * It acts as a dispatcher, routing the parsed JSON data to the appropriate
 * format-specific processor.
 */
import {
  LastPassFilePayload,
  LastPassFileAccount,
  MigrationOtpParameter,
  OtpData,
} from "../types";
import { mapToMigrationOtpParameter, RawOtpAccount } from "./otpDataMapper";
import { getOtpParametersFromUrl } from "./otpUrlParser";
import { logger } from "./logger";

// --- Type Guards ---

/**
 * Type guard to check if the parsed JSON is an array of OtpData objects.
 * @param data The parsed JSON data.
 * @returns True if the data is a valid OtpData array.
 */
function isOtpDataArray(data: unknown): data is OtpData[] {
  return (
    Array.isArray(data) &&
    (data.length === 0 || (typeof data[0] === "object" && "url" in data[0]))
  );
}

/**
 * Type guard to check if the parsed JSON is a LastPass export payload.
 * @param data The parsed JSON data.
 * @returns True if the data is a valid LastPassFilePayload.
 */
function isLastPassFilePayload(data: unknown): data is LastPassFilePayload {
  return (
    typeof data === "object" &&
    data !== null &&
    Array.isArray((data as LastPassFilePayload).accounts)
  );
}

// --- Format-Specific Processors ---

/**
 * Processes an array of OtpData objects (from this tool's own export format).
 * @param otpDataArray The array of OtpData objects.
 * @returns A promise that resolves with the flattened array of OTP parameters.
 */
async function processOtpDataArray(
  otpDataArray: OtpData[]
): Promise<MigrationOtpParameter[]> {
  const promises = otpDataArray
    .filter((otp) => otp.url && typeof otp.url === "string")
    .map((otp) =>
      getOtpParametersFromUrl(otp.url).catch((error: any) => {
        logger.warn(`Skipping invalid entry in JSON file: ${otp.name}`, error);
        return []; // Return an empty array for failed items to not break Promise.all
      })
    );

  const results = await Promise.all(promises);
  return results.flat(); // Flatten the array of arrays into a single array
}

/**
 * Processes a LastPassFilePayload object.
 * @param payload The LastPassFilePayload object.
 * @returns An array of OTP parameters.
 */
function processLastPassPayload(
  payload: LastPassFilePayload
): MigrationOtpParameter[] {
  return payload.accounts.map((lpAccount: LastPassFileAccount) => {
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

/**
 * Processes a JSON string, dispatching to the correct parser based on its structure.
 * @param jsonString The raw JSON string content from a file.
 * @returns A promise that resolves with an array of OTP parameters.
 */
export async function processJson(
  jsonString: string
): Promise<MigrationOtpParameter[]> {
  const data: unknown = JSON.parse(jsonString);

  if (isOtpDataArray(data)) {
    return processOtpDataArray(data);
  }

  if (isLastPassFilePayload(data)) {
    return processLastPassPayload(data);
  }

  throw new Error(
    "Invalid JSON format: Expected an array of OTP accounts or a LastPass export object."
  );
}
