import { $ } from "./dom";
import { downloadAsCsv } from "../services/csvExporter";
import { downloadAsJson } from "../services/jsonExporter";
import { clearLogs } from "./notifications";
import { setState, subscribe } from "../state/store";
import { resetFileInput } from "./fileInput";

/**
 * Clears all logs and resets the OTP state.
 */
function handleClearAll(): void {
  clearLogs();
  setState(() => ({ otps: [], logCount: 0 }));
  resetFileInput();
}

/**
 * Initializes the export control buttons (Save CSV, Clear All)
 * and manages the visibility of their container.
 */
export function initExportControls(): void {
  const exportContainer = $<HTMLDivElement>("#export-container");
  const csvButton = $<HTMLButtonElement>("#download-csv-button");
  const jsonButton = $<HTMLButtonElement>("#download-json-button");
  const clearButton = $<HTMLButtonElement>("#clear-all-button");

  csvButton.addEventListener("click", downloadAsCsv);
  jsonButton.addEventListener("click", downloadAsJson);
  clearButton.addEventListener("click", handleClearAll);

  // Subscribe to state changes to control visibility
  subscribe((state) => {
    const hasOtps = state.otps.length > 0;
    const hasLogs = (state.logCount || 0) > 0;

    // Show the main container if there's anything to show/clear
    exportContainer.style.display = hasOtps || hasLogs ? "block" : "none";

    // Show download buttons only if there are OTPs
    const showDownload = hasOtps ? "inline-block" : "none";
    csvButton.style.display = showDownload;
    jsonButton.style.display = showDownload;
  });
}
