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
  clearAlerts,
  displayError,
  displayWarning,
} from "./notifications";
import { resetFileInput } from "./fileInput";
import { setState, getState } from "../state/store";
import { getOtpUniqueKey } from "../services/qrProcessor";
import { MigrationOtpParameter } from "../types";
import { showQrModal } from "./qrModal";
import { logger } from "../services/logger";

/**
 * Clears all logs and resets the OTP state.
 */
function handleClearAll(): void {
  clearAlerts();
  clearLogs();
  setState(() => ({ otps: [], logCount: 0, selectedOtpKeys: new Set() }));
  resetFileInput();
}

/**
 * Gets the currently selected OTPs from the global state.
 * @returns An array of the selected OTP parameters.
 */
function getSelectedOtps(): MigrationOtpParameter[] {
  const { otps, selectedOtpKeys } = getState();
  return otps.filter((otp) => selectedOtpKeys.has(getOtpUniqueKey(otp)));
}

/**
 * A wrapper to safely execute an export function, handling potential errors.
 * @param exportFn The export function to call with the selected OTPs.
 * @param isQrExport If true, the result is expected to be a URL string that
 * should be displayed in a QR code modal.
 */
async function handleExport(
  exportFn: (otps: MigrationOtpParameter[]) => Promise<any>,
  isQrExport = false
) {
  const selectedOtps = getSelectedOtps();
  if (selectedOtps.length === 0) {
    announceToScreenReader("No accounts selected to export.");
    return;
  }
  try {
    const result = await exportFn(selectedOtps);
    if (isQrExport && typeof result === "string") {
      const title = result.startsWith("lpaauth")
        ? "Scan with LastPass Authenticator"
        : "Scan with Google Authenticator";
      // Show the QR modal. The `true` argument indicates that the modal was
      // opened by a user action (potentially keyboard), so focus should be
      // restored to the trigger button when the modal is closed.
      showQrModal(result, title, true /* fromKeyboard */);
    }
  } catch (error: any) {
    const message = error.message || "An unknown error occurred during export.";
    displayError(message);
    logger.error("Export failed:", error);
  }
}

/**
 * Initializes the export control buttons (Save CSV, Clear All)
 * and manages the visibility of their container.
 */
export function initExportControls(): void {
  const downloadCsvButton = $<HTMLButtonElement>("#download-csv-button")!;
  const downloadJsonButton = $<HTMLButtonElement>("#download-json-button")!;
  const exportGoogleButton = $<HTMLButtonElement>("#export-google-button")!;
  const exportLastPassButton = $<HTMLButtonElement>("#export-lastpass-button")!;
  const clearAllButton = $<HTMLButtonElement>("#clear-all-button")!;

  const selectAllButton = $<HTMLButtonElement>("#select-all-button")!;
  const deselectAllButton = $<HTMLButtonElement>("#deselect-all-button")!;

  // --- Export Button Listeners ---
  downloadCsvButton.addEventListener("click", () => {
    handleExport(async (otps) => downloadAsCsv(otps));
  });
  downloadJsonButton.addEventListener("click", () => {
    handleExport(async (otps) => downloadAsJson(otps));
  });
  exportGoogleButton.addEventListener("click", () =>
    handleExport(exportToGoogleAuthenticator, true)
  );
  exportLastPassButton.addEventListener("click", () => {
    const selectedOtps = getSelectedOtps();
    if (selectedOtps.length === 0) {
      announceToScreenReader("No accounts selected to export.");
      return;
    }

    const hotpAccounts = selectedOtps.filter((otp) => otp.type === 1); // 1 is HOTP
    const hasHotp = hotpAccounts.length > 0;
    const hasTotp = selectedOtps.some((otp) => otp.type === 2);

    // --- "Correct and Inform" Flow for Incompatible Accounts ---
    // LastPass only supports TOTP accounts in its QR export. If the user
    // has selected a mix of TOTP and HOTP accounts, we don't just fail.
    // Instead, we automatically deselect the incompatible HOTP accounts,
    // inform the user what happened and why, and then prompt them to click
    // the export button again to proceed with the corrected selection.
    // If the selection contains a mix of compatible (TOTP) and incompatible (HOTP) accounts...
    if (hasHotp && hasTotp) {
      // ...we implement the "correct and inform" flow.
      const hotpKeys = new Set(hotpAccounts.map(getOtpUniqueKey));

      // 1. Remove the incompatible HOTP items from the current selection.
      setState((s) => {
        const newSelectedKeys = new Set(s.selectedOtpKeys);
        hotpKeys.forEach((key) => newSelectedKeys.delete(key));
        return { ...s, selectedOtpKeys: newSelectedKeys };
      });

      // 2. Inform the user what happened and why, prompting them to click again.
      const plural = hotpAccounts.length > 1 ? "s were" : " was";
      const count = hotpAccounts.length == 1 ? "An" : hotpAccounts.length;
      const message = `LastPass only supports time-based (TOTP) accounts. ${count} incompatible counter-based account${plural} removed from your selection. Click "Export to LastPass" again to continue.`;
      displayWarning(message);
      return; // Stop the export this time.
    }

    // For all other cases (only TOTP, or only HOTP), let the standard export function handle it.
    // It will succeed for TOTP-only selections, and fail with a clear error for HOTP-only selections.
    handleExport(exportToLastPass, true);
  });

  // --- State-Modifying Button Listeners ---
  clearAllButton.addEventListener("click", () => {
    handleClearAll();
  });

  selectAllButton.addEventListener("click", (event) => {
    const allKeys = new Set(getState().otps.map(getOtpUniqueKey));
    setState((s) => ({ ...s, selectedOtpKeys: allKeys }));
    // For keyboard users, move focus to the opposite action button for a
    // more intuitive flow. `event.detail === 0` is a reliable way to check
    // if a click was triggered by Enter/Space.
    if (event.detail === 0) {
      deselectAllButton.focus();
    }
  });

  deselectAllButton.addEventListener("click", (event) => {
    setState((s) => ({ ...s, selectedOtpKeys: new Set() }));
    // For keyboard users, move focus to the opposite action button.
    if (event.detail === 0) {
      selectAllButton.focus();
    }
  });
}
