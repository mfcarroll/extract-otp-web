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
 * Creates an HTML element for a single OTP entry by cloning a template.
 */
function createOtpCard(otp: OtpData, index: number): HTMLDivElement {
  // The title is for display purposes in the card header.
  const titleText = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;

  const cardFragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const cardElement = cardFragment.querySelector<HTMLDivElement>(".otp-card")!;
  cardElement.id = `otp-card-${index}`;

  // --- ARIA: Set tabindex for roving focus ---
  // The first navigable element in EACH card should be a tab stop. This
  // allows users to tab between cards as if they are distinct sections.
  // All other navigable items have tabindex="-1" by default from the
  // template, which is correct for the roving tabindex pattern within a card.
  const firstNavigable = cardElement.querySelector<HTMLElement>(".navigable");
  // The template sets tabindex="-1", so we override it for the first element of each card.
  firstNavigable?.setAttribute("tabindex", "0");

  // --- ARIA: Reset roving tabindex when focus leaves the card ---
  cardElement.addEventListener("focusout", (event) => {
    // `relatedTarget` is the element that is receiving focus.
    const newFocusTarget = event.relatedTarget as HTMLElement | null;

    // If the new focus target is null or is outside of the current card,
    // then we have tabbed out of the card.
    if (!newFocusTarget || !cardElement.contains(newFocusTarget)) {
      const navigables = Array.from(
        cardElement.querySelectorAll<HTMLElement>(".navigable")
      );

      // Reset all navigable elements in this card to tabindex="-1".
      navigables.forEach((el) => el.setAttribute("tabindex", "-1"));

      // Set the first one to be the designated tab stop for the next time
      // the user tabs into this card.
      if (navigables.length > 0) {
        navigables[0].setAttribute("tabindex", "0");
      }
    }
  });

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

  // --- ARIA: Explicitly label the input fields for screen readers ---
  const secretLabel =
    cardElement.querySelector<HTMLSpanElement>(".secret-row .label")!;
  const secretLabelId = `secret-label-${index}`;
  secretLabel.id = secretLabelId;
  const secretInput =
    cardElement.querySelector<HTMLInputElement>(".secret-input")!;
  secretInput.value = otp.secret;
  secretInput.setAttribute("aria-labelledby", secretLabelId);

  const urlLabelElement = cardElement.querySelector<HTMLSpanElement>(
    ".otp-url-row .label"
  )!;
  const urlLabelId = `url-label-${index}`;
  urlLabelElement.id = urlLabelId;
  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  // Display the raw, encoded URL. While less "pretty" than a decoded
  // version, it's the technically correct representation and avoids
  // confusion about spaces or special characters in the URL.
  urlInput.value = otp.url;
  urlInput.nextElementSibling!.setAttribute("data-copy-text", otp.url);
  urlInput.setAttribute("aria-labelledby", urlLabelId);

  const secretCopy = cardElement.querySelector<HTMLButtonElement>(
    ".secret-container .copy-button"
  )!;
  const urlCopy = cardElement.querySelector<HTMLButtonElement>(
    ".otp-url-container .copy-button"
  )!;

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;
  QRCode.toCanvas(qrCodeCanvas, otp.url, {
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
    showQrModal(otp.url, modalTitle, fromKeyboard);
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
  formattedOtps.forEach((otp, index) => {
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
