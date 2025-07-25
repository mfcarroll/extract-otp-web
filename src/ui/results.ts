import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { $ } from "./dom";
import { getOtpTypeInfo, OtpType } from "./otp";
import { handleCopyAction } from "./clipboard";
import { Navigation } from "./navigation";
import { showQrModal } from "./qrModal";
import { subscribe, getState } from "../state/store";

function getQrCodeColors() {
  const computedStyles = getComputedStyle(document.documentElement);
  return {
    dark: computedStyles.getPropertyValue("--text-color").trim(),
    light: computedStyles.getPropertyValue("--card-background").trim(),
  };
}

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

  // --- ARIA: Label the entire row with its title for screen reader context ---
  const titleElement =
    cardElement.querySelector<HTMLHeadingElement>(".otp-title")!;
  const titleId = `otp-title-${index}`;
  titleElement.id = titleId;
  cardElement.setAttribute("aria-labelledby", titleId);

  // Populate the details from the template
  titleElement.textContent = `${index + 1}. ${titleText}`;
  populateDetail(cardElement, "name", otp.name);
  populateDetail(cardElement, "issuer", otp.issuer);
  populateDetail(cardElement, "type", typeInfo.description);

  // --- ARIA: Explicitly label the input fields for screen readers ---
  const secretLabel =
    cardElement.querySelector<HTMLSpanElement>(".secret-row .label")!;
  const secretLabelId = `secret-label-${index}`;
  secretLabel.id = secretLabelId;
  const secretInput =
    cardElement.querySelector<HTMLInputElement>(".secret-input")!;
  secretInput.value = secretText;
  secretInput.setAttribute("aria-labelledby", secretLabelId);

  const urlLabelElement = cardElement.querySelector<HTMLSpanElement>(
    ".otp-url-row .label"
  )!;
  const urlLabelId = `url-label-${index}`;
  urlLabelElement.id = urlLabelId;
  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  urlInput.value = decodeURIComponent(otpAuthUrl);
  urlInput.nextElementSibling!.setAttribute("data-copy-text", otpAuthUrl);
  urlInput.setAttribute("aria-labelledby", urlLabelId);

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
  qrCodeContainer.addEventListener("click", (event: MouseEvent) => {
    const modalTitle = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;
    // A `detail` of 0 indicates a keyboard-initiated click. This allows us
    // to conditionally restore focus only for keyboard users, which is better UX.
    const fromKeyboard = event.detail === 0;
    showQrModal(otpAuthUrl, modalTitle, fromKeyboard);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", (event) => {
    handleCopyAction(event.target as HTMLElement);
  });

  // --- Register Navigation Rules ---
  const secretContainer =
    cardElement.querySelector<HTMLDivElement>(".secret-container")!;
  const urlContainer =
    cardElement.querySelector<HTMLDivElement>(".otp-url-container")!;
  const secretCopyButton =
    secretContainer.querySelector<HTMLDivElement>(".copy-button")!;
  const urlCopyButton =
    urlContainer.querySelector<HTMLDivElement>(".copy-button")!;

  Navigation.registerRule(qrCodeContainer, "left", () => secretCopyButton);

  Navigation.registerRule(secretInput, "right", () => secretCopyButton);
  Navigation.registerRule(urlInput, "right", () => urlCopyButton);

  Navigation.registerRule(secretCopy, "left", () => secretInput);
  Navigation.registerRule(urlCopy, "left", () => urlInput);

  return cardElement;
}

function render(otps: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>("#results-container");

  // Any time the results are re-rendered, the DOM has changed significantly.
  // This resets the "go back" navigation memory to prevent unexpected jumps
  // if the previously focused element is no longer in a logical position.
  Navigation.resetLastMove();

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
}
