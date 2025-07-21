import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { $ } from "./dom";
import { getOtpTypeInfo, OtpType } from "./otp";
import { subscribe } from "../state/store";

// --- Accessibility Enhancement: Store focus before modal opens ---
let elementThatOpenedModal: HTMLElement | null = null;

function getQrCodeColors() {
  const computedStyles = getComputedStyle(document.documentElement);
  return {
    dark: computedStyles.getPropertyValue("--text-color").trim(),
    light: computedStyles.getPropertyValue("--card-background").trim(),
  };
}

function showQrModal(otpAuthUrl: string, title: string): void {
  // --- Accessibility Enhancement: Store the element that had focus ---
  elementThatOpenedModal = document.activeElement as HTMLElement;

  const modal = $<HTMLDivElement>("#qr-modal");
  const modalContent = $<HTMLDivElement>("#modal-content");
  const modalCloseButton = $<HTMLButtonElement>(".modal-close");

  modalContent.innerHTML = "";

  const modalCanvas = document.createElement("canvas");
  const viewportSize = Math.min(window.innerWidth, window.innerHeight);
  const canvasSize = Math.floor(viewportSize * 0.8);

  QRCode.toCanvas(modalCanvas, otpAuthUrl, {
    width: canvasSize,
    margin: 2,
    // modal QR is always white on black for ease of scanning regardless of theme
    color: { dark: "#000000", light: "#ffffff" },
  });

  modalContent.appendChild(modalCanvas);

  const titleElement = document.createElement("p");
  titleElement.className = "modal-title";
  titleElement.textContent = title;
  modalContent.appendChild(titleElement);

  modal.style.display = "flex";
  // --- Accessibility Enhancement: Add keydown listener to the modal itself ---
  modal.addEventListener("keydown", handleModalKeydown);
  // --- Accessibility Enhancement: Focus the close button for keyboard users ---
  modalCloseButton.focus();
}

function hideQrModal(): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  modal.style.display = "none";
  $<HTMLDivElement>("#modal-content").innerHTML = "";
  modal.removeEventListener("keydown", handleModalKeydown);

  // --- Accessibility Enhancement: Restore focus to the element that opened the modal ---
  if (elementThatOpenedModal) {
    elementThatOpenedModal.focus();
    elementThatOpenedModal = null;
  }
}

function handleModalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    hideQrModal();
  }
}

const copyToClipboard = (text: string, buttonElement: HTMLElement): void => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      buttonElement.classList.add("copied");
      setTimeout(() => buttonElement.classList.remove("copied"), 1500);
    })
    .catch((err) => {
      console.error("Could not copy text: ", err);
    });
};

const handleCopy = (event: MouseEvent) => {
  const triggerElement = event.target as HTMLElement;
  const container = triggerElement.closest(
    ".secret-container, .otp-url-container"
  );
  if (!container) return;

  const input = container.querySelector<HTMLInputElement>(".text-input");
  const button = container.querySelector<HTMLButtonElement>(".copy-button");
  if (!input || !button) return;

  const textToCopy = triggerElement.matches(".copy-button, .copy-button i")
    ? button.dataset.copyText || input.value
    : input.value;

  input.select();
  copyToClipboard(textToCopy, button);
};

const cardTemplate = $<HTMLTemplateElement>("#otp-card-template");

/**
 * Populates a detail field in the OTP card, handling missing values.
 * @param cardElement The parent card element.
 * @param field The data-value attribute of the target span.
 * @param value The value to display.
 */
function populateDetail(
  cardElement: HTMLElement,
  field: string,
  value: string | undefined | null
): void {
  const element = cardElement.querySelector<HTMLSpanElement>(
    `[data-value="${field}"]`
  );
  if (!element) return;

  element.textContent = value || "Not available";
  element.classList.toggle("value-missing", !value);
}

/**
 * Creates an HTML element for a single OTP entry by cloning a template.
 */
function createOtpCard(
  otp: MigrationOtpParameter,
  index: number
): HTMLDivElement {
  const secretText = encode(otp.secret);
  const typeInfo = getOtpTypeInfo(otp.type);

  // Construct a display-friendly title and a URL-friendly label.
  const titleText = otp.issuer
    ? `${otp.issuer}${otp.name ? `: ${otp.name}` : ""}`
    : otp.name || "Untitled Account";
  const urlLabel = otp.issuer
    ? `${otp.issuer}:${otp.name || ""}`
    : otp.name || "Untitled Account";
  const encodedLabel = encodeURIComponent(urlLabel);

  let otpAuthUrl = `otpauth://${typeInfo.key}/${encodedLabel}?secret=${secretText}`;
  if (otp.issuer) otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
  if (otp.type === OtpType.HOTP) otpAuthUrl += `&counter=${otp.counter || 0}`;

  const cardFragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const cardElement = cardFragment.querySelector<HTMLDivElement>(".otp-card")!;
  cardElement.id = `otp-card-${index}`;

  // Populate the details from the template
  cardElement.querySelector<HTMLHeadingElement>(".otp-title")!.textContent = `${
    index + 1
  }. ${titleText}`;
  populateDetail(cardElement, "name", otp.name);
  populateDetail(cardElement, "issuer", otp.issuer);
  populateDetail(cardElement, "type", typeInfo.description);

  cardElement.querySelector<HTMLInputElement>(".secret-input")!.value =
    secretText;

  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  urlInput.value = decodeURIComponent(otpAuthUrl);
  urlInput.nextElementSibling!.setAttribute("data-copy-text", otpAuthUrl);

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;

  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
    width: 220,
    margin: 1,
    color: getQrCodeColors(),
  });

  // Add event listeners
  const qrCodeContainer =
    cardElement.querySelector<HTMLDivElement>(".qr-code-container")!;
  qrCodeContainer.addEventListener("click", () => {
    const modalTitle = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;
    showQrModal(otpAuthUrl, modalTitle);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", handleCopy);

  return cardElement;
}

/**
 * Handles keyboard navigation within the results grid, following ARIA grid patterns.
 * This includes roving tabindex for arrow keys and activation for Enter/Space.
 * @param event The keyboard event.
 */
function handleResultsKeydown(event: KeyboardEvent): void {
  const target = event.target as HTMLElement;
  const resultsContainer = $<HTMLDivElement>("#results-container");

  // Ensure the event target is a gridcell within our grid
  if (
    !target.matches('[role="gridcell"]') ||
    !resultsContainer.contains(target)
  ) {
    return;
  }

  // Handle activation with Enter or Space
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    // For inputs, the copy handler is on a parent. For others, a direct click works.
    if (target.matches(".secret-input, .url-input")) {
      target.parentElement?.click();
    } else {
      target.click();
    }
    return;
  }

  const allRows = Array.from(
    resultsContainer.querySelectorAll('[role="row"]')
  ) as HTMLElement[];
  const currentRow = target.closest('[role="row"]') as HTMLElement;
  if (!currentRow) return;

  const currentRowIndex = allRows.indexOf(currentRow);
  const cellsInCurrentRow = Array.from(
    currentRow.querySelectorAll('[role="gridcell"]')
  ) as HTMLElement[];
  const currentCellIndex = cellsInCurrentRow.indexOf(target);

  let nextCell: HTMLElement | null = null;

  switch (event.key) {
    case "ArrowRight":
      event.preventDefault();
      if (currentCellIndex < cellsInCurrentRow.length - 1) {
        nextCell = cellsInCurrentRow[currentCellIndex + 1];
      }
      break;

    case "ArrowLeft":
      event.preventDefault();
      if (currentCellIndex > 0) {
        nextCell = cellsInCurrentRow[currentCellIndex - 1];
      }
      break;

    case "ArrowDown":
      event.preventDefault();
      if (currentRowIndex < allRows.length - 1) {
        const nextRow = allRows[currentRowIndex + 1];
        const cellsInNextRow = Array.from(
          nextRow.querySelectorAll('[role="gridcell"]')
        ) as HTMLElement[];
        nextCell =
          cellsInNextRow[Math.min(currentCellIndex, cellsInNextRow.length - 1)];
      } else {
        // Move focus out of the grid downwards to the export button
        $<HTMLButtonElement>("#download-csv-button")?.focus();
      }
      break;

    case "ArrowUp":
      event.preventDefault();
      if (currentRowIndex > 0) {
        const prevRow = allRows[currentRowIndex - 1];
        const cellsInPrevRow = Array.from(
          prevRow.querySelectorAll('[role="gridcell"]')
        ) as HTMLElement[];
        nextCell =
          cellsInPrevRow[Math.min(currentCellIndex, cellsInPrevRow.length - 1)];
      } else {
        // Move focus out of the grid upwards to the file input button
        $<HTMLLabelElement>(".file-input-label")?.focus();
      }
      break;

    case "Home":
      event.preventDefault();
      nextCell = event.ctrlKey
        ? allRows[0].querySelector('[role="gridcell"]')
        : cellsInCurrentRow[0];
      break;

    case "End":
      event.preventDefault();
      if (event.ctrlKey) {
        const lastRow = allRows[allRows.length - 1];
        const cellsInLastRow = lastRow.querySelectorAll('[role="gridcell"]');
        nextCell = cellsInLastRow[cellsInLastRow.length - 1] as HTMLElement;
      } else {
        nextCell = cellsInCurrentRow[cellsInCurrentRow.length - 1];
      }
      break;
  }

  if (nextCell) {
    // Roving tabindex: move the focus and update tabindex
    target.tabIndex = -1;
    nextCell.tabIndex = 0;
    nextCell.focus();
  }
}

function render(otps: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>("#results-container");

  resultsContainer.innerHTML = "";
  if (!otps || otps.length === 0) {
    return;
  }

  const fragment = document.createDocumentFragment();
  otps.forEach((otp, index) => {
    const cardElement = createOtpCard(otp, index);
    fragment.appendChild(cardElement);
  });
  resultsContainer.appendChild(fragment);
}

export function initResults() {
  // Re-render whenever the otps in the store change
  subscribe((state) => {
    render(state.otps);
  });

  // Setup modal listeners
  const modal = $<HTMLDivElement>("#qr-modal");
  const modalCloseButton = $<HTMLButtonElement>(".modal-close");

  // Close modal on overlay click
  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      hideQrModal();
    }
  });

  // Close modal on button click
  modalCloseButton.addEventListener("click", hideQrModal);

  // --- Accessibility Enhancement: Close modal with Enter or Space on the close button ---
  modalCloseButton.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hideQrModal();
    }
  });

  // Add keyboard navigation for the results list
  const resultsContainer = $<HTMLDivElement>("#results-container");
  resultsContainer.addEventListener("keydown", handleResultsKeydown);
}
