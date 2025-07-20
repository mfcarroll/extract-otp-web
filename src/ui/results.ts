import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { $ } from "./dom";
import { subscribe } from "../state/store";

function getQrCodeColors() {
  const computedStyles = getComputedStyle(document.documentElement);
  return {
    dark: computedStyles.getPropertyValue("--text-color").trim(),
    light: computedStyles.getPropertyValue("--card-background").trim(),
  };
}

function showQrModal(otpAuthUrl: string, title: string): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  const modalContent = $<HTMLDivElement>("#modal-content");

  modalContent.innerHTML = "";

  const modalCanvas = document.createElement("canvas");
  const viewportSize = Math.min(window.innerWidth, window.innerHeight);
  const canvasSize = Math.floor(viewportSize * 0.8);

  QRCode.toCanvas(modalCanvas, otpAuthUrl, {
    width: canvasSize,
    margin: 2,
    color: { dark: "#000000", light: "#ffffff" },
  });

  modalContent.appendChild(modalCanvas);

  const titleElement = document.createElement("p");
  titleElement.className = "modal-title";
  titleElement.textContent = title;
  modalContent.appendChild(titleElement);
  modal.style.display = "flex";
}

function hideQrModal(): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  modal.style.display = "none";
  $<HTMLDivElement>("#modal-content").innerHTML = "";
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
 * Creates an HTML element for a single OTP entry by cloning a template.
 */
function createOtpCard(
  otp: MigrationOtpParameter,
  index: number
): HTMLDivElement {
  const secretText = encode(otp.secret);
  const issuerText = otp.issuer || "N/A";
  const accountName = otp.name || "N/A";
  const typeText = otp.type === 2 ? "totp" : "hotp";

  let label = accountName;
  if (otp.issuer) label = `${otp.issuer}:${accountName}`;
  const encodedLabel = encodeURIComponent(label);

  let otpAuthUrl = `otpauth://${typeText}/${encodedLabel}?secret=${secretText}`;
  if (otp.issuer) otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
  if (typeText === "hotp") otpAuthUrl += `&counter=${otp.counter || 0}`;

  const cardFragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const cardElement = cardFragment.querySelector<HTMLDivElement>(".otp-card")!;
  cardElement.id = `otp-card-${index}`;

  // Populate the details from the template
  const titleText = otp.issuer ? `${issuerText}: ${accountName}` : accountName;
  cardElement.querySelector<HTMLHeadingElement>(".otp-title")!.textContent = `${
    index + 1
  }. ${titleText}`;
  cardElement.querySelector<HTMLSpanElement>(
    '[data-value="name"]'
  )!.textContent = accountName;
  cardElement.querySelector<HTMLSpanElement>(
    '[data-value="issuer"]'
  )!.textContent = issuerText;
  cardElement.querySelector<HTMLSpanElement>(
    '[data-value="type"]'
  )!.textContent = typeText;

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
    const modalTitle = otp.issuer
      ? `${issuerText}: ${accountName}`
      : accountName;
    showQrModal(otpAuthUrl, modalTitle);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", handleCopy);

  return cardElement;
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
  modal.addEventListener("click", hideQrModal);
  document.addEventListener("keydown", (event) => {
    if (modal.style.display !== "none") {
      event.preventDefault();
      hideQrModal();
    }
  });
}
