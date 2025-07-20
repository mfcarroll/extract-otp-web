import { MigrationOtpParameter } from "../types";
import { processImage, getOtpUniqueKey } from "../services/qrProcessor";
import { setState, getState, subscribe } from "../state/store";
import { addUploadLog, displayError, clearLogs } from "./notifications";
import { $ } from "./dom";

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
              newlyAddedOtps.push(otp);
              existingAndBatchKeys.add(key);
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
            anyDuplicatesOrErrors = true;
            const plural = duplicatesInFile > 1 ? "s" : "";
            addUploadLog(
              file.name,
              "warning",
              `${duplicatesInFile} duplicate secret${plural} skipped.`
            );
          }
        } else {
          if (otpParameters === null) {
            addUploadLog(file.name, "warning", "No QR code found.");
          } else {
            addUploadLog(file.name, "info", "No OTP secrets found.");
          }
        }
      } catch (error: any) {
        anyDuplicatesOrErrors = true;
        const message =
          (error instanceof Error ? error.message : String(error)) ||
          "An unknown error occurred.";
        console.error(`Error processing file ${file.name}:`, error);
        addUploadLog(file.name, "error", message);
      }
    }

    if (newlyAddedOtps.length > 0) {
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
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
  const dragOverlay = $<HTMLDivElement>("#drag-overlay");
  let dragCounter = 0;

  qrInput.addEventListener("change", (event: Event) => {
    processFiles((event.target as HTMLInputElement).files);
  });

  // Subscribe to the store to react to state changes.
  // When OTPs are cleared, reset the file input so the same files can be re-selected.
  subscribe((state) => {
    if (state.otps.length === 0) {
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
