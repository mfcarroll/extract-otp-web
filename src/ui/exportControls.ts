import { $ } from "./dom";
import { downloadAsCsv } from "../services/csvExporter";
import { downloadAsJson } from "../services/jsonExporter";
import {
  exportToGoogleAuthenticator,
  exportToLastPass,
} from "../services/otpExporter";
import {
  announceToScreenReader,
  clearLogs,
  displayError,
} from "./notifications";
import { setState, subscribe, getState } from "../state/store";
import { resetFileInput } from "./fileInput";
import { showQrModal } from "./qrModal";

/**
 * Clears all logs and resets the OTP state.
 */
function handleClearAll(): void {
  clearLogs();
  setState(() => ({ otps: [], logCount: 0 }));
  resetFileInput();
}

/**
 * A higher-order function that wraps an export action. It checks if there is
 * data to export before executing the action, handling the empty state uniformly.
 * @param action The export function to wrap.
 * @returns An event handler function.
 */
function withExportData(action: (event: MouseEvent) => Promise<void> | void) {
  return (event: MouseEvent) => {
    const { otps } = getState();
    if (otps.length === 0) {
      announceToScreenReader("No data to export.");
      return;
    }
    action(event);
  };
}
/**
 * Initializes the export control buttons (Save CSV, Clear All)
 * and manages the visibility of their container.
 */
export function initExportControls(): void {
  const exportContainer = $<HTMLDivElement>("#export-container");
  const csvButton = $<HTMLButtonElement>("#download-csv-button");
  const jsonButton = $<HTMLButtonElement>("#download-json-button");
  const googleButton = $<HTMLButtonElement>("#export-google-button");
  const lastPassButton = $<HTMLButtonElement>("#export-lastpass-button");
  const clearButton = $<HTMLButtonElement>("#clear-all-button");

  clearButton.addEventListener("click", handleClearAll);

  csvButton.addEventListener("click", withExportData(downloadAsCsv));
  jsonButton.addEventListener("click", withExportData(downloadAsJson));

  googleButton.addEventListener(
    "click",
    withExportData(async (event) => {
      try {
        const { otps } = getState();
        const url = await exportToGoogleAuthenticator(otps);
        const fromKeyboard = event.detail === 0;
        showQrModal(url, "Export to Google Authenticator", fromKeyboard);
      } catch (error: any) {
        displayError(
          error.message || "Failed to generate Google Authenticator QR code."
        );
      }
    })
  );

  lastPassButton.addEventListener(
    "click",
    withExportData(async (event) => {
      try {
        const { otps } = getState();
        const url = await exportToLastPass(otps);
        const fromKeyboard = event.detail === 0;
        showQrModal(url, "Export to LastPass", fromKeyboard);
      } catch (error: any) {
        displayError(error.message || "Failed to generate LastPass QR code.");
      }
    })
  );

  // Subscribe to state changes to control visibility
  subscribe((state) => {
    const hasOtps = state.otps.length > 0;
    const hasLogs = (state.logCount || 0) > 0;

    // Show the main container if there's anything to show/clear
    exportContainer.style.display = hasOtps || hasLogs ? "flex" : "none";

    // Show download buttons only if there are OTPs
    const showExport = hasOtps ? "inline-flex" : "none";
    csvButton.style.display = showExport;
    jsonButton.style.display = showExport;
    googleButton.style.display = showExport;
    lastPassButton.style.display = showExport;
  });
}
