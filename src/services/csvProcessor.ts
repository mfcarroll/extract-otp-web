import { MigrationOtpParameter } from "../types";
import { getOtpParametersFromUrl } from "./otpUrlParser";

/**
 * A simple CSV row parser that handles fields enclosed in double quotes.
 * It supports escaped double quotes ("") inside a quoted field.
 * @param row A single line from a CSV file.
 * @returns An array of strings representing the fields in the row.
 */
function parseCsvRow(row: string): string[] {
  const fields: string[] = [];
  let currentField = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];

    if (char === '"') {
      // Check for an escaped quote ("")
      if (inQuotes && row[i + 1] === '"') {
        currentField += '"';
        i++; // Skip the second quote of the pair
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      fields.push(currentField);
      currentField = "";
    } else {
      currentField += char;
    }
  }
  fields.push(currentField); // Add the last field

  return fields;
}

/**
 * Processes the content of one of our own CSV export files.
 * @param fileContent The string content of the CSV file.
 * @returns A promise that resolves to an array of OTP parameters.
 */
export async function processCsv(
  fileContent: string
): Promise<MigrationOtpParameter[]> {
  const rows = fileContent.trim().split(/\r?\n/);
  if (rows.length < 2) return []; // Not enough rows for a header and data.

  const headers = rows[0].split(",").map((h) => h.trim());
  const urlIndex = headers.indexOf("url");

  if (urlIndex === -1) return []; // 'url' column is required.

  const allOtpParams: MigrationOtpParameter[] = [];
  for (const row of rows.slice(1)) {
    if (!row.trim()) continue;
    const fields = parseCsvRow(row);
    const otpUrl = fields[urlIndex];
    if (otpUrl) allOtpParams.push(...(await getOtpParametersFromUrl(otpUrl)));
  }
  return allOtpParams;
}
