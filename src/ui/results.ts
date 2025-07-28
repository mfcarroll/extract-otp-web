import QRCode from "qrcode";
import { MigrationOtpParameter, OtpData } from "../types";
import { $ } from "./dom";
import { handleCopyAction } from "./clipboard";
import { Navigation } from "./navigation";
import { showQrModal } from "./qrModal";
import { subscribe, getState, setState } from "../state/store";
import { convertToOtpData } from "../services/otpFormatter";
import { getOtpUniqueKey } from "../services/qrProcessor";
import { isNarrowViewport } from "./viewport";

function getQrCodeColors() {
  const computedStyles = getComputedStyle(document.documentElement);
  return {
    dark: computedStyles.getPropertyValue("--text-color").trim(),
    light: computedStyles.getPropertyValue("--card-background").trim(),
  };
}

/**
 * Adjusts the height of a textarea to fit its content.
 * @param textarea The textarea element to adjust.
 */
function autoResizeTextarea(textarea: HTMLTextAreaElement): void {
  // Temporarily reset height to allow scrollHeight to be calculated correctly.
  textarea.style.height = "auto";
  // Set the height to the scroll height, which represents the full content height.
  textarea.style.height = `${textarea.scrollHeight}px`;
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
    counterRow.classList.add("visible");
  }

  // --- ARIA: Use proper labels and add descriptive help text ---
  const helpText =
    cardElement.querySelector<HTMLParagraphElement>(".card-actions-help")!;
  const helpTextId = `card-actions-help-${index}`;
  helpText.id = helpTextId;

  const secretInput =
    cardElement.querySelector<HTMLTextAreaElement>(".secret-input")!;
  const secretInputId = `secret-input-${index}`;
  secretInput.id = secretInputId;
  secretInput.value = otp.secret;
  cardElement.querySelector<HTMLLabelElement>(".secret-row .label")!.htmlFor =
    secretInputId;
  secretInput.setAttribute("aria-describedby", helpTextId);

  const urlInput =
    cardElement.querySelector<HTMLTextAreaElement>(".url-input")!;
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
function setupCardEvents(
  cardElement: HTMLElement,
  otp: OtpData,
  key: string
): void {
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
    const target = event.target as HTMLElement;
    // Use the same breakpoint as the CSS that hides the copy button.

    if (isNarrowViewport()) {
      // On mobile, select the text of an input when it's tapped.
      // This allows the user to use the native copy functionality.
      if (target.matches(".secret-input")) {
        (target as HTMLTextAreaElement).select();
      } else if (target.matches(".url-input")) {
        (target as HTMLTextAreaElement).select();
      }
    } else {
      // On desktop, allow clicking the text field or its container to copy.
      // If the copy button is clicked, we find the associated input/textarea
      // to ensure handleCopyAction receives the element with the value.
      let elementToCopyFrom: HTMLElement = target;
      const copyButton = target.closest(".copy-button");
      if (copyButton) {
        const container = copyButton.closest(
          ".secret-container, .otp-url-container"
        );
        const inputElement =
          container?.querySelector<HTMLElement>(".text-input");
        if (inputElement) {
          elementToCopyFrom = inputElement;
        }
      }
      handleCopyAction(elementToCopyFrom);
    }
  });

  const toggleSelection = (fromKeyboard: boolean) => {
    // Update global state, which will trigger a re-render.
    setState((s) => {
      const newSelected = new Set(s.selectedOtpKeys);
      newSelected.has(key) ? newSelected.delete(key) : newSelected.add(key);
      return {
        ...s,
        selectedOtpKeys: newSelected,
        focusedOtpKey: fromKeyboard ? key : null,
      };
    });
  };

  // --- Selection Logic ---
  cardElement.addEventListener("click", (event) => {
    // Don't toggle selection if an interactive element inside the card was clicked.
    if (
      (event.target as HTMLElement).closest(
        "a, button, input:not(.otp-select-checkbox)"
      )
    ) {
      return;
    }
    // Also ignore if the user was just selecting text.
    if (window.getSelection()?.toString()) {
      return;
    }

    event.preventDefault();

    // Differentiate between a real user click and a programmatic one from
    // the navigation system (Enter/Space). A programmatic click has event.detail === 0.
    const fromKeyboard = event.detail === 0;
    toggleSelection(fromKeyboard);
  });
}

/**
 * Sets up the keyboard navigation rules for an OTP card.
 * @param cardElement The card element to set up navigation for.
 */
function setupCardNavigation(cardElement: HTMLElement): void {
  // Get all navigable elements within the card in DOM order.
  const innerNavigables = Array.from(
    cardElement.querySelectorAll<HTMLElement>(".navigable")
  ).filter(
    (el) => el.offsetParent !== null // Ensure the element is visible
  );

  // Get specific card elements
  const secretInput =
    cardElement.querySelector<HTMLTextAreaElement>(".secret-input")!;
  const urlInput =
    cardElement.querySelector<HTMLTextAreaElement>(".url-input")!;
  const secretCopyButton = cardElement.querySelector<HTMLButtonElement>(
    ".secret-container .copy-button"
  )!;
  const urlCopyButton = cardElement.querySelector<HTMLButtonElement>(
    ".otp-url-container .copy-button"
  )!;
  const qrCodeContainer =
    cardElement.querySelector<HTMLButtonElement>(".qr-code-container")!;

  // --- Rules for going IN and OUT of the card ---

  Navigation.registerRule(cardElement, "right", () => secretInput);
  Navigation.registerRule(cardElement, "left", () => qrCodeContainer);

  // From any inner control, "Escape" returns focus to the card container.
  innerNavigables.forEach((el) => {
    Navigation.registerKeyAction(el, "escape", () => cardElement);
  });

  // --- Rules for moving between the inner controls ---

  Navigation.registerRule(qrCodeContainer, "left", () => secretCopyButton);
  Navigation.registerRule(secretInput, "right", () => secretCopyButton);
  Navigation.registerRule(urlInput, "right", () => urlCopyButton);
  Navigation.registerRule(secretCopyButton, "left", () => secretInput);
  Navigation.registerRule(urlCopyButton, "left", () => urlInput);
}

/**
 * Creates an HTML element for a single OTP entry by cloning a template.
 */
function createOtpCard(
  otp: OtpData,
  index: number,
  qrColors: { dark: string; light: string },
  key: string,
  isSelected: boolean
): HTMLDivElement {
  const cardFragment = cardTemplate.content.cloneNode(true) as DocumentFragment;
  const cardElement = cardFragment.querySelector<HTMLDivElement>(".otp-card")!;
  cardElement.id = `otp-card-${index}`;
  cardElement.dataset.key = key;
  cardElement.classList.toggle("selected", isSelected);
  // The first card is the entry point for tabbing. Others are not in tab order.
  // The main navigation system will handle roving tabindex from here.
  // cardElement.setAttribute("tabindex", index === 0 ? "0" : "-1");

  populateCardDetails(cardElement, otp, index);
  setupCardEvents(cardElement, otp, key);
  setupCardNavigation(cardElement);

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;
  const checkbox = cardElement.querySelector<HTMLInputElement>(
    ".otp-select-checkbox"
  )!;
  checkbox.checked = isSelected;
  // Link the card to the checkbox for better accessibility semantics
  const checkboxId = `otp-select-${index}`;
  checkbox.id = checkboxId;
  cardElement.setAttribute("aria-describedby", checkboxId);

  QRCode.toCanvas(qrCodeCanvas, otp.url, {
    // The `width` option sets the canvas's drawing buffer size (its intrinsic
    // resolution). We render it at a reasonably high resolution to ensure it
    // looks sharp on desktop and can be scaled down cleanly on mobile without
    // breaking the layout.
    width: 220,
    margin: 1,
    color: qrColors,
  });

  return cardElement;
}

function render(
  rawOtps: MigrationOtpParameter[],
  selectedOtpKeys: Set<string>
): void {
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
  const keys = rawOtps.map(getOtpUniqueKey);
  const qrColors = getQrCodeColors();
  formattedOtps.forEach((otp, index) => {
    const key = keys[index];
    const cardElement = createOtpCard(
      otp,
      index,
      qrColors,
      key,
      selectedOtpKeys.has(key)
    );
    fragment.appendChild(cardElement);
  });

  resultsContainer.appendChild(fragment);

  // After appending, resize all textareas to ensure scrollHeight is calculated correctly.
  resultsContainer
    .querySelectorAll<HTMLTextAreaElement>(".secret-input, .url-input")
    .forEach(autoResizeTextarea);
}

export function initResults() {
  // Get initial state to determine the starting count.
  let previousOtpCount = getState().otps.length;

  // Re-render whenever the otps in the store change
  subscribe((state) => {
    render(state.otps, state.selectedOtpKeys);

    const keyToFocus = state.focusedOtpKey;
    // After rendering, if a key was marked for focus (e.g., from a keyboard
    // selection), restore focus to that element.
    if (keyToFocus) {
      // First, immediately clear the key from the state. This may trigger a
      // synchronous re-render, but that's okay. The important part is that
      // the state is clean for the next update, and our focus call happens last.
      setState(() => ({ focusedOtpKey: null }));

      // After the state is cleared, find the element that was just rendered
      // and apply focus to it.
      const elementToFocus = document.querySelector<HTMLElement>(
        `.otp-card[data-key="${keyToFocus}"]`
      );
      elementToFocus?.focus();
    }

    const { otps, selectedOtpKeys } = state;

    // Update visibility of export and selection controls
    const exportContainer = $<HTMLDivElement>("#export-container")!;
    const selectionControls = $<HTMLDivElement>("#selection-controls")!;
    const selectionCountSpan = $<HTMLSpanElement>("#selection-count")!;
    const downloadCsvButton = $<HTMLButtonElement>("#download-csv-button");
    const downloadJsonButton = $<HTMLButtonElement>("#download-json-button");
    const exportGoogleButton = $<HTMLButtonElement>("#export-google-button");
    const exportLastPassButton = $<HTMLButtonElement>(
      "#export-lastpass-button"
    );
    const selectAllButton = $<HTMLButtonElement>("#select-all-button");
    const deselectAllButton = $<HTMLButtonElement>("#deselect-all-button");

    const hasOtps = otps.length > 0;
    exportContainer.style.display = hasOtps ? "flex" : "none";
    selectionControls.style.display = hasOtps ? "flex" : "none";

    if (hasOtps) {
      const count = selectedOtpKeys.size;
      const total = otps.length;
      selectionCountSpan.textContent = `${count} of ${total} selected`;

      const setButtonNavigable = (
        button: HTMLButtonElement,
        enabled: boolean
      ) => {
        button.disabled = !enabled;
        button.classList.toggle("navigable", enabled);
      };

      setButtonNavigable(selectAllButton, count < total);
      setButtonNavigable(deselectAllButton, count > 0);

      const hasSelection = count > 0;
      setButtonNavigable(downloadCsvButton, hasSelection);
      setButtonNavigable(downloadJsonButton, hasSelection);
      setButtonNavigable(exportGoogleButton, hasSelection);

      if (hasSelection) {
        const selectedOtps = otps.filter((otp) =>
          selectedOtpKeys.has(getOtpUniqueKey(otp))
        );
        const hasTotp = selectedOtps.some((otp) => otp.type === 2); // 2 is TOTP
        setButtonNavigable(exportLastPassButton, hasTotp);
      } else {
        setButtonNavigable(exportLastPassButton, false);
      }
    }

    if (otps.length === 0 && previousOtpCount > 0) {
      $<HTMLLabelElement>(".file-input-label")?.focus();
    }
    // Update for the next change
    previousOtpCount = state.otps.length;
  });
}
