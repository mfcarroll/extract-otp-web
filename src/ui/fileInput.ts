import { MigrationOtpParameter } from "../types";
import { processImage, getOtpUniqueKey } from "../services/qrProcessor";
import { setState, getState, subscribe } from "../state/store";
import { addUploadLog, displayError, clearLogs } from "./notifications";
import { $ } from "./dom";

/**
 * Toggles the UI's processing state to provide user feedback and prevent concurrent uploads.
 * @param isProcessing Whether the application is currently processing files.
 */
function setProcessingState(isProcessing: boolean): void {
  const qrInput = $<HTMLInputElement>("#qr-input");
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");

  qrInput.disabled = isProcessing;
  fileInputLabel.classList.toggle("processing", isProcessing);
  // Prevent keyboard interaction while processing
  fileInputLabel.classList.toggle("navigable", !isProcessing);

  if (isProcessing) {
    fileInputLabel.innerHTML = `<i class="fa fa-spinner fa-spin"></i> Processing...`;
  } else {
    // Restore original text and icon
    fileInputLabel.innerHTML = `<i class="fa fa-upload"></i> Select QR Code Image(s)`;
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

  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
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
    dragCounter = 0;
    fileDropZone.classList.remove("active");
    dragOverlay.classList.remove("active");
    processFiles(event.dataTransfer?.files ?? null);
  });
}
