import { getState } from "../state/store";
import { announceToScreenReader } from "../ui/notifications";
import { convertToOtpData } from "./otpFormatter";
import { triggerDownload } from "./download";

/**
 * Exports the current OTP data as a formatted JSON file.
 */
export function downloadAsJson(): void {
  const { otps } = getState();
  if (otps.length === 0) {
    announceToScreenReader("No data to export.");
    return;
  }

  const otpDataForJson = otps.map(convertToOtpData);

  // The `null, 2` arguments format the JSON with an indent of 2 spaces for readability.
  const jsonString = JSON.stringify(otpDataForJson, null, 2);
  triggerDownload(
    "otp_secrets.json",
    jsonString,
    "application/json;charset=utf-8;"
  );
}
