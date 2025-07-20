import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter, OtpData } from "../types";
import { $ } from "./dom";
import { subscribe } from "../state/store";

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

/**
 * Creates an HTML element for a single OTP entry.
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

  const cardElement = document.createElement("div");
  cardElement.className = "otp-card";
  cardElement.id = `otp-card-${index}`;

  const qrCodeCanvas = document.createElement("canvas");
  const computedStyles = getComputedStyle(document.documentElement);
  const qrDarkColor = computedStyles.getPropertyValue("--text-color").trim();
  const qrLightColor = computedStyles
    .getPropertyValue("--card-background")
    .trim();

  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
    width: 220,
    margin: 1,
    color: { dark: qrDarkColor, light: qrLightColor },
  });

  const qrCodeContainer = document.createElement("div");
  qrCodeContainer.className = "qr-code-container";
  qrCodeContainer.addEventListener("click", () => {
    const modalTitle = otp.issuer
      ? `${issuerText}: ${accountName}`
      : accountName;
    showQrModal(otpAuthUrl, modalTitle);
  });
  qrCodeContainer.appendChild(qrCodeCanvas);

  const otpDetails = document.createElement("div");
  otpDetails.className = "otp-details";
  const titleText = otp.issuer ? `${issuerText}: ${accountName}` : accountName;

  otpDetails.innerHTML = `
      <h3>${index + 1}. ${titleText}</h3>
      <p><span class="label">Name:</span> ${accountName}</p>
      <p><span class="label">Issuer:</span> ${issuerText}</p>
      <p><span class="label">Type:</span> ${typeText}</p>
      <p class="secret-row">
          <span class="label">Secret:</span>
          <span class="secret-container">
              <input type="text" class="text-input secret-input" value="${secretText}" readonly>
              <button class="copy-button" aria-label="Copy secret"><i class="fa fa-copy"></i></button>
          </span>
      </p>
      <p class="otp-url-row">
          <span class="label">URL: </span>
          <span class="otp-url-container">
              <input type="text" class="text-input url-input" value="${decodeURIComponent(
                otpAuthUrl
              )}" readonly>
              <button class="copy-button" data-copy-text="${otpAuthUrl}" aria-label="Copy URL"><i class="fa fa-copy"></i></button>
          </span>
      </p>
  `;

  otpDetails.addEventListener("click", handleCopy);
  cardElement.appendChild(otpDetails);
  cardElement.appendChild(qrCodeContainer);

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
  // Initial render
  // render([]);

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
