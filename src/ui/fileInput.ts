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

/**
 * Handles keyboard navigation within the results container for a grid-like experience.
 * @param event The keyboard event.
 */
function handleResultsKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  if (
    !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  ) {
    return;
  }

  const card = target.closest<HTMLElement>(".otp-card");
  if (!card) return;

  // Only prevent default if we are sure we're handling the key inside a card.
  event.preventDefault();

  const cardIndex = parseInt(card.id.replace("otp-card-", ""), 10);
  const allCards = document.querySelectorAll<HTMLElement>(".otp-card");
  const fileInputLabel = $<HTMLLabelElement>(".file-input-label");

  let row = -1,
    col = -1;
  if (target.classList.contains("secret-input")) {
    [row, col] = [0, 0];
  } else if (target.classList.contains("copy-button")) {
    col = 1;
    if (target.closest(".secret-row")) {
      row = 0;
    } else if (target.closest(".otp-url-row")) {
      row = 1;
    }
  } else if (target.classList.contains("url-input")) {
    [row, col] = [1, 0];
  } else if (target.classList.contains("qr-code-container")) {
    col = 2;
  }

  switch (event.key) {
    case "ArrowUp":
      if (row === 1) {
        // From URL row to Secret row in the same card
        const selector =
          col === 0 ? ".secret-input" : ".secret-row .copy-button";
        card.querySelector<HTMLElement>(selector)?.focus();
      } else {
        // From Secret row or QR code up to previous card's QR or select button
        if (cardIndex > 0) {
          allCards[cardIndex - 1]
            .querySelector<HTMLElement>(".qr-code-container")
            ?.focus();
        } else {
          fileInputLabel.focus();
        }
      }
      break;

    case "ArrowDown":
      if (row === 0) {
        // From Secret row to URL row in the same card
        const selector = col === 0 ? ".url-input" : ".otp-url-row .copy-button";
        card.querySelector<HTMLElement>(selector)?.focus();
      } else {
        // From URL row or QR code down to next card's secret input
        if (cardIndex < allCards.length - 1) {
          allCards[cardIndex + 1]
            .querySelector<HTMLElement>(".secret-input")
            ?.focus();
        }
      }
      break;

    case "ArrowLeft":
      if (col === 2) {
        card.querySelector<HTMLElement>(".otp-url-row .copy-button")?.focus();
      } else if (col === 1) {
        const selector = row === 0 ? ".secret-input" : ".url-input";
        card.querySelector<HTMLElement>(selector)?.focus();
      }
      break;

    case "ArrowRight":
      if (col === 0) {
        const selector =
          row === 0 ? ".secret-row .copy-button" : ".otp-url-row .copy-button";
        card.querySelector<HTMLElement>(selector)?.focus();
      } else if (col === 1) {
        card.querySelector<HTMLElement>(".qr-code-container")?.focus();
      }
      break;
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

  fileInputLabel.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      const activeTab =
        document.querySelector<HTMLButtonElement>(".tab-button.active");

      if (activeTab?.dataset.tab === "faq") {
        const faqButtons = document.querySelectorAll<HTMLButtonElement>(
          "#tab-faq .faq-button"
        );
        if (faqButtons.length > 0) {
          faqButtons[faqButtons.length - 1].focus();
        } else {
          activeTab.focus();
        }
      } else if (activeTab) {
        activeTab.focus();
      }
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      // Focus the first secret input in the first OTP card.
      const firstSecretInput = document.querySelector<HTMLInputElement>(
        ".otp-card .secret-input"
      );
      firstSecretInput?.focus();
    } else if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      qrInput.click();
    }
  });

  resultsContainer.addEventListener("keydown", handleResultsKeydown);

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
