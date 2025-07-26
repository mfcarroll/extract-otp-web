import QRCode from "qrcode";
import { MigrationOtpParameter, OtpData } from "../types";
import { $ } from "./dom";
import { handleCopyAction } from "./clipboard";
import { Navigation } from "./navigation";
import { showQrModal } from "./qrModal";
import { subscribe, getState } from "../state/store";
import { convertToOtpData } from "../services/otpFormatter";

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
 * Populates the text content and ARIA attributes of an OTP card.
 * @param cardElement The card element to populate.
 * @param otp The OTP data for the card.
 * @param index The index of the card.
 */
function populateCardDetails(
  cardElement: HTMLElement,
  otp: OtpData,
  index: number
): void {
  const titleText = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;

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
  populateDetail(cardElement, "type", otp.typeDescription);

  // Show and populate the counter field only for HOTP accounts.
  const counterRow =
    cardElement.querySelector<HTMLParagraphElement>(".counter-row");
  if (counterRow && otp.type === "hotp") {
    populateDetail(cardElement, "counter", String(otp.counter));
    counterRow.style.display = "block";
  }

  // --- ARIA: Use proper labels and add descriptive help text ---
  const helpText =
    cardElement.querySelector<HTMLParagraphElement>(".card-actions-help")!;
  const helpTextId = `card-actions-help-${index}`;
  helpText.id = helpTextId;

  const secretInput =
    cardElement.querySelector<HTMLInputElement>(".secret-input")!;
  const secretInputId = `secret-input-${index}`;
  secretInput.id = secretInputId;
  secretInput.value = otp.secret;
  cardElement.querySelector<HTMLLabelElement>(".secret-row .label")!.htmlFor =
    secretInputId;
  secretInput.setAttribute("aria-describedby", helpTextId);

  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  const urlInputId = `url-input-${index}`;
  urlInput.id = urlInputId;
  urlInput.value = otp.url;
  cardElement.querySelector<HTMLLabelElement>(".otp-url-row .label")!.htmlFor =
    urlInputId;
  urlInput.setAttribute("aria-describedby", helpTextId);
}

/**
 * Sets up event listeners for an OTP card (copying, QR modal).
 * @param cardElement The card element to set up events for.
 * @param otp The OTP data for the card.
 */
function setupCardEvents(cardElement: HTMLElement, otp: OtpData): void {
  const qrCodeContainer =
    cardElement.querySelector<HTMLButtonElement>(".qr-code-container")!;
  const titleText = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;

  // Update the accessible name for the QR code button
  const qrCodeLabel =
    qrCodeContainer.querySelector<HTMLSpanElement>(".visually-hidden");
  if (qrCodeLabel) {
    qrCodeLabel.textContent = `Show larger QR code for ${titleText}`;
  }

  qrCodeContainer.addEventListener("click", (event: MouseEvent) => {
    const modalTitle = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;
    const fromKeyboard = event.detail === 0;
    showQrModal(otp.url, modalTitle, fromKeyboard);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", (event) => {
    handleCopyAction(event.target as HTMLElement);
  });
}

/**
 * Sets up the keyboard navigation rules for an OTP card.
 * @param cardElement The card element to set up navigation for.
 */
function setupCardNavigation(cardElement: HTMLElement): void {
  const secretInput =
    cardElement.querySelector<HTMLInputElement>(".secret-input")!;
  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  const secretCopyButton = cardElement.querySelector<HTMLButtonElement>(
    ".secret-container .copy-button"
  )!;
  const urlCopyButton = cardElement.querySelector<HTMLButtonElement>(
    ".otp-url-container .copy-button"
  )!;
  const qrCodeContainer =
    cardElement.querySelector<HTMLButtonElement>(".qr-code-container")!;

  Navigation.registerRule(qrCodeContainer, "left", () => secretCopyButton);
  Navigation.registerRule(secretInput, "right", () => secretCopyButton);
  Navigation.registerRule(urlInput, "right", () => urlCopyButton);
  Navigation.registerRule(secretCopyButton, "left", () => secretInput);
  Navigation.registerRule(urlCopyButton, "left", () => urlInput);
}

/**
 * Sets up roving tabindex for a card, making it a single tab stop.
 * @param cardElement The card element to set up.
 */
function setupRovingTabindex(cardElement: HTMLElement): void {
  const firstNavigable = cardElement.querySelector<HTMLElement>(".navigable");
  firstNavigable?.setAttribute("tabindex", "0");

  cardElement.addEventListener("focusout", (event) => {
    const newFocusTarget = event.relatedTarget as HTMLElement | null;
    if (!newFocusTarget || !cardElement.contains(newFocusTarget)) {
      const navigables = Array.from(
        cardElement.querySelectorAll<HTMLElement>(".navigable")
      );
      navigables.forEach((el) => el.setAttribute("tabindex", "-1"));
      if (navigables.length > 0) {
        navigables[0].setAttribute("tabindex", "0");
      }
    }
  });
}

/**
 * Creates an HTML element for a single OTP entry by cloning a template.
 */
function createOtpCard(
  otp: OtpData,
  index: number,
  qrColors: { dark: string; light: string }
): HTMLDivElement {
  const cardFragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const cardElement = cardFragment.querySelector<HTMLDivElement>(".otp-card")!;
  cardElement.id = `otp-card-${index}`;

  setupRovingTabindex(cardElement);
  populateCardDetails(cardElement, otp, index);
  setupCardEvents(cardElement, otp);
  setupCardNavigation(cardElement);

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;
  QRCode.toCanvas(qrCodeCanvas, otp.url, {
    width: 220,
    margin: 1,
    color: qrColors,
  });

  return cardElement;
}

function render(rawOtps: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>("#results-container");

  // Any time the results are re-rendered, the DOM has changed significantly.
  // This resets the "go back" navigation memory to prevent unexpected jumps
  // if the previously focused element is no longer in a logical position.
  Navigation.resetLastMove();

  resultsContainer.innerHTML = "";
  if (!rawOtps || rawOtps.length === 0) {
    resultsContainer.style.display = "none"; // Hide container if no results
    return;
  }
  resultsContainer.style.display = "block"; // Show container if there are results

  const formattedOtps = rawOtps.map(convertToOtpData);
  const fragment = document.createDocumentFragment();
  const qrColors = getQrCodeColors();
  formattedOtps.forEach((otp, index) => {
    const cardElement = createOtpCard(otp, index, qrColors);
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
