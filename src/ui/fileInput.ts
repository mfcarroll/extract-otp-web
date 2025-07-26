import { MigrationOtpParameter } from "../types";
import {
  processImage,
  getOtpUniqueKey,
  filterAndLogOtps,
} from "../services/qrProcessor";
import { processJson } from "../services/jsonProcessor";
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
    } else {
      throw new Error(
        "Unsupported file type. Please select an image or a .json file."
      );
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
    const logContainer = $<HTMLDivElement>("#upload-log-container");
    if (logContainer.style.display === "none") {
      logContainer.style.display = "block";
    }

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

export function initFileInput(): void {
  qrInputElement = $<HTMLInputElement>("#qr-input");
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
  const dragOverlay = $<HTMLDivElement>("#drag-overlay");
  let dragCounter = 0;

  qrInputElement.addEventListener("change", (event: Event) => {
    processFiles((event.target as HTMLInputElement).files);
  });

  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  // Prevent default for drag events to allow drop to fire correctly.
  ["dragenter", "dragover", "dragleave"].forEach((eventName) => {
    document.body.addEventListener(eventName, preventDefaults);
  });

  document.body.addEventListener("dragenter", () => {
    dragCounter++;
    fileDropZone.classList.add("active");
    dragOverlay.classList.add("active");
  });

  document.body.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter === 0) {
      fileDropZone.classList.remove("active");
      dragOverlay.classList.remove("active");
    }
  });

  document.body.addEventListener("drop", (event: DragEvent) => {
    // We must prevent the default action for file drops to avoid the browser
    // trying to open the file. We only do this for files to avoid interfering
    // with other drag-and-drop operations like dragging text or links.
    if (event.dataTransfer?.types.includes("Files")) {
      preventDefaults(event);
    }
    dragCounter = 0;
    fileDropZone.classList.remove("active");
    dragOverlay.classList.remove("active");
    processFiles(event.dataTransfer?.files ?? null);
  });
}
