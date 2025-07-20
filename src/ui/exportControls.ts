import { $ } from "./dom";
import { downloadAsCsv } from "../services/csvExporter";
import { clearLogs } from "./notifications";
import { setState, subscribe } from "../state/store";

/**
 * Clears all logs and resets the OTP state.
 */
function handleClearAll(): void {
  clearLogs();
  setState(() => ({ otps: [] }));
}

/**
 * Initializes the export control buttons (Save CSV, Clear All)
 * and manages the visibility of their container.
 */
export function initExportControls(): void {
  const exportContainer = $<HTMLDivElement>("#export-container");
  const downloadButton = $<HTMLButtonElement>("#download-csv-button");
  const clearButton = $<HTMLButtonElement>("#clear-button");

  downloadButton.addEventListener("click", downloadAsCsv);
  clearButton.addEventListener("click", handleClearAll);

  // Subscribe to state changes to control visibility
  subscribe((state) => {
    exportContainer.style.display = state.otps.length > 0 ? "block" : "none";
  });
}