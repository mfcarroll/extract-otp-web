import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { $ } from "./dom";
import { getOtpTypeInfo, OtpType } from "./otp";
import { Navigation } from "./navigation";
import { subscribe, getState } from "../state/store";

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
    event.stopPropagation(); // Prevent the global handler from also firing
    hideQrModal();
  }
}

export const copyToClipboard = (
  text: string,
  buttonElement: HTMLElement
): void => {
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

  const input = container.querySelector<HTMLInputElement>("input");
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

  const secretInput =
    cardElement.querySelector<HTMLInputElement>(".secret-input")!;
  secretInput.value = secretText;

  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  urlInput.value = decodeURIComponent(otpAuthUrl);
  urlInput.nextElementSibling!.setAttribute("data-copy-text", otpAuthUrl);

  const secretCopy = cardElement.querySelector<HTMLButtonElement>(
    ".secret-container .copy-button"
  )!;
  const urlCopy = cardElement.querySelector<HTMLButtonElement>(
    ".otp-url-container .copy-button"
  )!;

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;
  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
    width: 220,
    margin: 1,
    color: getQrCodeColors(),
  });

  const qrCodeContainer =
    cardElement.querySelector<HTMLDivElement>(".qr-code-container")!;
  qrCodeContainer.setAttribute("aria-label", `Show QR code for ${titleText}`);
  qrCodeContainer.addEventListener("click", () => {
    const modalTitle = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;
    showQrModal(otpAuthUrl, modalTitle);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", handleCopy);

  // --- Register Navigation Rules ---
  const secretContainer =
    cardElement.querySelector<HTMLDivElement>(".secret-container")!;
  const urlContainer =
    cardElement.querySelector<HTMLDivElement>(".otp-url-container")!;

  Navigation.registerRule(secretInput, "right", () =>
    secretContainer.querySelector(".copy-button")
  );
  Navigation.registerRule(urlInput, "right", () =>
    urlContainer.querySelector(".copy-button")
  );

  Navigation.registerRule(secretCopy, "left", () => secretInput);
  Navigation.registerRule(urlCopy, "left", () => urlInput);

  return cardElement;
}

function render(otps: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>("#results-container");

  resultsContainer.innerHTML = "";
  if (!otps || otps.length === 0) {
    resultsContainer.style.display = "none"; // Hide container if no results
    return;
  }
  resultsContainer.style.display = "block"; // Show container if there are results

  const fragment = document.createDocumentFragment();
  otps.forEach((otp, index) => {
    const cardElement = createOtpCard(otp, index);
    fragment.appendChild(cardElement);
  });

  resultsContainer.appendChild(fragment);
}

export function initResults() {
  // Get initial state to determine the starting count.
  let previousOtpCount = getState().otps.length;

  // Re-render whenever the otps in the store change
  subscribe((state) => {
    render(state.otps);
    if (state.otps.length === 0 && previousOtpCount > 0) {
      $<HTMLLabelElement>(".file-input-label")?.focus();
    }
    // Update for the next change
    previousOtpCount = state.otps.length;
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

  // --- Register Navigation Prioritizer ---
  // This rule provides a semantic entry point into the results grid.
  // It says: "When navigating DOWN into any result card from outside that card,
  // the destination should always be the 'secret' input field."
  Navigation.registerPrioritizer((candidates, direction, from) => {
    // This rule only applies when moving down.
    if (direction !== "down") {
      return null;
    }

    const bestCandidate = candidates[0];
    if (!bestCandidate) {
      return null;
    }

    // Find the card we are trying to navigate into.
    const targetCard = bestCandidate.closest<HTMLElement>(".otp-card");
    if (!targetCard) {
      return null; // Not navigating into a card.
    }

    // Find the card we are navigating from.
    const sourceCard = from.closest<HTMLElement>(".otp-card");

    // If we are already inside the card we are navigating to, do nothing.
    // This allows normal spatial navigation within a card.
    if (sourceCard === targetCard) {
      return null;
    }

    // If we are entering a card from above, force focus to its secret input field.
    return targetCard.querySelector<HTMLElement>(".secret-input");
  });
}
