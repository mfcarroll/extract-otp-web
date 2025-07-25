import { MigrationOtpParameter } from "../types";
import { processImage, getOtpUniqueKey } from "../services/qrProcessor";
import { setState, getState, subscribe } from "../state/store";
import { addUploadLog, displayError, clearLogs } from "./notifications";
import { $ } from "./dom";

let processingTimeoutId: number | null = null;

/**
 * Toggles the UI's processing state. It disables the input immediately but only
 * shows a visual "processing" indicator after a short delay. This prevents
 * UI flicker for very fast operations.
 * @param isProcessing Whether the application is currently processing files.
 */
function setProcessingState(isProcessing: boolean): void {
  const qrInput = $<HTMLInputElement>("#qr-input");
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");

  // Always disable the input immediately when processing starts to prevent re-entry.
  qrInput.disabled = isProcessing;
  fileInputLabel.classList.toggle("navigable", !isProcessing);

  if (isProcessing) {
    // Set a timeout to show the processing indicator. If processing finishes
    // before this, the timeout will be cleared and the user won't see a flicker.
    processingTimeoutId = window.setTimeout(() => {
      fileInputLabel.classList.add("processing");
      fileInputLabel.innerHTML = ""; // Clear existing content
      const icon = document.createElement("i");
      icon.className = "fa fa-spinner fa-spin";
      const text = document.createTextNode(" Processing...");
      fileInputLabel.appendChild(icon);
      fileInputLabel.appendChild(text);
      processingTimeoutId = null;
    }, 200); // 200ms delay
  } else {
    // If we are stopping the processing state, clear any pending timeout.
    if (processingTimeoutId) {
      clearTimeout(processingTimeoutId);
      processingTimeoutId = null;
    }

    // Restore the button to its original state.
    fileInputLabel.classList.remove("processing");
    fileInputLabel.innerHTML = ""; // Clear existing content
    // Restore original text and icon
    const icon = document.createElement("i");
    icon.className = "fa fa-upload";
    const text = document.createTextNode(" Select QR Code Image(s)");
    fileInputLabel.appendChild(icon);
    fileInputLabel.appendChild(text);
  }
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
  const newOtpsFromFile: MigrationOtpParameter[] = [];
  let hasDuplicatesOrErrors = false;

  try {
    const otpParameters = await processImage(file);

    if (otpParameters && otpParameters.length > 0) {
      let extractedInFile = 0;
      let duplicatesInFile = 0;

      for (const otp of otpParameters) {
        const key = getOtpUniqueKey(otp);
        if (existingAndBatchKeys.has(key)) {
          duplicatesInFile++;
        } else {
          newOtpsFromFile.push(otp);
          existingAndBatchKeys.add(key); // Mutate the set for the next file in the batch
          extractedInFile++;
        }
      }

      if (extractedInFile > 0) {
        const plural = extractedInFile > 1 ? "s" : "";
        addUploadLog(
          file.name,
          "success",
          `${extractedInFile} secret${plural} extracted.`
        );
      }
      if (duplicatesInFile > 0) {
        hasDuplicatesOrErrors = true;
        const plural = duplicatesInFile > 1 ? "s" : "";
        addUploadLog(
          file.name,
          "warning",
          `${duplicatesInFile} duplicate secret${plural} skipped.`
        );
      }
    } else if (otpParameters === null) {
      addUploadLog(file.name, "warning", "No QR code found.");
    } else {
      addUploadLog(file.name, "info", "No OTP secrets found.");
    }
  } catch (error: any) {
    hasDuplicatesOrErrors = true;
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      "An unknown error occurred.";
    console.error(`Error processing file ${file.name}:`, error);
    addUploadLog(file.name, "error", message);
  }

  return { newOtps: newOtpsFromFile, hasDuplicatesOrErrors };
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

export function initFileInput(): void {
  const qrInput = $<HTMLInputElement>("#qr-input");
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
  const dragOverlay = $<HTMLDivElement>("#drag-overlay");
  const resultsContainer = $<HTMLDivElement>("#results-container");
  let dragCounter = 0;

  qrInput.addEventListener("change", (event: Event) => {
    processFiles((event.target as HTMLInputElement).files);
  });

  subscribe((state) => {
    if (state.otps.length === 0) {
      clearLogs();
      qrInput.value = "";
    }
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
