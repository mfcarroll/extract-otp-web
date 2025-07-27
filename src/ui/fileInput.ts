import { MigrationOtpParameter } from "../types";
import {
  processImage,
  getOtpUniqueKey,
  filterAndLogOtps,
} from "../services/qrProcessor";
import { processJson } from "../services/jsonProcessor";
import { processCsv } from "../services/csvProcessor";
import { setState, getState } from "../state/store";
import { addUploadLog, displayError } from "./notifications";
import { $ } from "./dom";

/**
 * Toggles the UI's processing state. It disables the input immediately but only
 * shows a visual "processing" indicator after a short delay. This prevents
 * UI flicker for very fast operations.
 * @param isProcessing Whether the application is currently processing files.
 */
function setProcessingState(isProcessing: boolean): void {
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");
  const qrInput = $<HTMLInputElement>("#qr-input");

  fileInputLabel.classList.toggle("processing", isProcessing);
  // A processing label is not interactive.
  fileInputLabel.classList.toggle("navigable", !isProcessing);
  qrInput.disabled = isProcessing;
}

/**
 * Processes a single file, extracts OTPs, logs results, and handles duplicates.
 * @param file The file to process.
 * @param existingAndBatchKeys A Set containing keys of already processed OTPs.
 * @returns A promise that resolves with any newly found OTPs and a flag indicating if duplicates or errors were found.
 */
async function processSingleFile(
  file: File,
  existingAndBatchKeys: Set<string>
): Promise<{
  newOtps: MigrationOtpParameter[];
  hasDuplicatesOrErrors: boolean;
}> {
  try {
    let otpParameters: MigrationOtpParameter[] | null = null;

    if (file.type.startsWith("image/")) {
      otpParameters = await processImage(file);
    } else if (
      file.type === "application/json" ||
      file.name.endsWith(".json")
    ) {
      const fileContent = await file.text();
      otpParameters = await processJson(fileContent);
    } else if (file.type === "text/csv" || file.name.endsWith(".csv")) {
      const fileContent = await file.text();
      otpParameters = await processCsv(fileContent);
    } else {
      throw new Error("Unsupported file type.");
    }

    if (otpParameters && otpParameters.length > 0) {
      const { newOtps, duplicatesFound } = filterAndLogOtps(
        otpParameters,
        existingAndBatchKeys,
        file.name
      );
      return { newOtps, hasDuplicatesOrErrors: duplicatesFound > 0 };
    } else if (otpParameters === null) {
      // This case is specific to image processing where no QR code is found.
      addUploadLog(file.name, "warning", "No QR code found.");
      return { newOtps: [], hasDuplicatesOrErrors: true };
    } else {
      // This case handles empty but valid files (e.g., empty JSON array).
      addUploadLog(file.name, "info", "No OTP secrets found.");
      return { newOtps: [], hasDuplicatesOrErrors: false };
    }
  } catch (error: any) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      "An unknown error occurred.";
    console.error(`Error processing file ${file.name}:`, error);
    addUploadLog(file.name, "error", message);
    return { newOtps: [], hasDuplicatesOrErrors: true };
  }
}

async function processFiles(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;

  setProcessingState(true);
  const fileArray = Array.from(files);

  try {
    // Ensure the log container is visible once files are processed.
    $<HTMLDivElement>("#upload-log-container").classList.add("visible");

    const currentOtps = getState().otps;
    const firstNewIndex = currentOtps.length;
    const newlyAddedOtps: MigrationOtpParameter[] = [];
    let anyDuplicatesOrErrors = false;

    const existingAndBatchKeys = new Set(currentOtps.map(getOtpUniqueKey));

    for (const file of fileArray) {
      const result = await processSingleFile(file, existingAndBatchKeys);
      newlyAddedOtps.push(...result.newOtps);
      if (result.hasDuplicatesOrErrors) {
        anyDuplicatesOrErrors = true;
      }
    }

    if (newlyAddedOtps.length > 0) {
      const wasEmpty = getState().otps.length === 0;
      setState((currentState) => ({
        otps: [...currentState.otps, ...newlyAddedOtps],
      }));

      const firstNewCard = document.getElementById(`otp-card-${firstNewIndex}`);
      if (!anyDuplicatesOrErrors && firstNewCard) {
        firstNewCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    if (anyDuplicatesOrErrors) {
      const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
      fileDropZone.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error: any) {
    displayError(
      error.message || "An unexpected error occurred while processing files."
    );
  } finally {
    setProcessingState(false);
  }
}

let qrInputElement: HTMLInputElement | null = null;

/** Resets the file input element, clearing its selection. */
export function resetFileInput(): void {
  if (qrInputElement) {
    qrInputElement.value = "";
  }
}

/**
 * Initializes the file input and drag-and-drop functionality.
 * Sets up event listeners for file selection, drag enter, drag leave, and drop events.
 */
export function initFileInput(): void {
  qrInputElement = $<HTMLInputElement>("#qr-input"); // Assign to module-level variable
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
  const dragOverlay = $<HTMLDivElement>("#drag-overlay");
  let dragCounter = 0;

  // --- Helper Functions ---

  const preventDefaults = (e: Event) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const showDragUI = () => {
    fileDropZone.classList.add("active");
    dragOverlay.classList.add("active");
  };

  const hideDragUI = () => {
    fileDropZone.classList.remove("active");
    dragOverlay.classList.remove("active");
  };

  // --- Event Listeners ---

  // 1. Standard file input change
  qrInputElement.addEventListener("change", (event: Event) => {
    processFiles((event.target as HTMLInputElement).files);
  });

  // 2. Drag and Drop listeners on the whole body for a better user experience.
  document.body.addEventListener("dragenter", (e: DragEvent) => {
    preventDefaults(e);
    // Only show the UI if files are being dragged in. This prevents the UI
    // from appearing when dragging other things like text.
    if (e.dataTransfer?.types.includes("Files")) {
      dragCounter++;
      showDragUI();
    }
  });

  document.body.addEventListener("dragover", (e: DragEvent) => {
    // We must prevent default on dragover to allow the drop event to fire.
    preventDefaults(e);
  });

  document.body.addEventListener("dragleave", (e: DragEvent) => {
    preventDefaults(e);
    dragCounter--;
    if (dragCounter <= 0) {
      dragCounter = 0; // Reset in case of weird event firing
      hideDragUI();
    }
  });

  document.body.addEventListener("drop", (event: DragEvent) => {
    // We must prevent the default action for file drops to avoid the browser
    // trying to open the file.
    preventDefaults(event);
    dragCounter = 0;
    hideDragUI();
    processFiles(event.dataTransfer?.files ?? null);
  });
}
