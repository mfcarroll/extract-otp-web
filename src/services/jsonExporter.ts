import { getState } from "../state/store";
import { announceToScreenReader } from "../ui/notifications";
import { convertToOtpData } from "./otpFormatter";

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
  const blob = new Blob([jsonString], {
    type: "application/json;charset=utf-8;",
  });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "otp_secrets.json");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
