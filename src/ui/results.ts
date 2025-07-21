import QRCode from "qrcode";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { $ } from "./dom";
import { getOtpTypeInfo, OtpType } from "./otp";
import { subscribe, getState } from "../state/store";

// --- Accessibility Enhancement: Store focus before modal opens ---
let elementThatOpenedModal: HTMLElement | null = null;
// --- Accessibility Enhancement: Store last focused element for QR navigation ---
let lastFocusedCopyButton: HTMLElement | null = null;
// --- Accessibility Enhancement: Store last focused elements for vertical navigation ---
let lastFocusedInResults: HTMLElement | null = null;
let lastFocusedInExport: HTMLElement | null = null;
let lastFocusedInFooter: HTMLElement | null = null;

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
  secretInput.tabIndex = -1; // For roving tabindex

  const urlInput = cardElement.querySelector<HTMLInputElement>(".url-input")!;
  urlInput.value = decodeURIComponent(otpAuthUrl);
  urlInput.tabIndex = -1; // For roving tabindex
  urlInput.nextElementSibling!.setAttribute("data-copy-text", otpAuthUrl);

  // Set tabindex on copy buttons
  cardElement.querySelector<HTMLButtonElement>(
    ".secret-container .copy-button"
  )!.tabIndex = -1;
  cardElement.querySelector<HTMLButtonElement>(
    ".otp-url-container .copy-button"
  )!.tabIndex = -1;

  // Generate the QR code
  const qrCodeCanvas = cardElement.querySelector<HTMLCanvasElement>("canvas")!;
  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
    width: 220,
    margin: 1,
    color: getQrCodeColors(),
  });

  // Add event listeners and make QR code focusable
  const qrCodeContainer =
    cardElement.querySelector<HTMLDivElement>(".qr-code-container")!;
  qrCodeContainer.tabIndex = -1; // For roving tabindex
  qrCodeContainer.setAttribute("role", "button");
  qrCodeContainer.setAttribute("aria-label", `Show QR code for ${titleText}`);
  qrCodeContainer.addEventListener("click", () => {
    const modalTitle = otp.issuer ? `${otp.issuer}: ${otp.name}` : otp.name;
    showQrModal(otpAuthUrl, modalTitle);
  });

  const otpDetails = cardElement.querySelector<HTMLDivElement>(".otp-details")!;
  otpDetails.addEventListener("click", handleCopy);

  return cardElement;
}

/**
 * Sets focus on a new element, managing the roving tabindex.
 * @param currentEl The currently focused element.
 * @param nextEl The element to move focus to.
 */
function setFocus(currentEl: HTMLElement | null, nextEl: HTMLElement | null) {
  if (!nextEl) return;

  if (currentEl) {
    currentEl.tabIndex = -1;
  }
  nextEl.tabIndex = 0;
  nextEl.focus();
}

/**
 * Centralized keyboard navigation handler for the entire application.
 * It determines the context of the focused element and delegates to the
 * appropriate navigation logic.
 * @param event The keyboard event.
 */
function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const key = event.key;

  const allCards = Array.from(
    document.querySelectorAll<HTMLElement>(".otp-card")
  );
  const hasResults = allCards.length > 0;
  let nextEl: HTMLElement | null = null;

  // --- Global Escape Key Behavior ---
  // If the escape key is pressed on any focusable element that doesn't
  // have its own specific escape behavior (like a modal or open menu),
  // remove focus from it. This provides a consistent way to "reset"
  // keyboard focus to the document body.
  if (
    key === "Escape" &&
    document.activeElement &&
    document.activeElement !== document.body
  ) {
    (document.activeElement as HTMLElement).blur();
    return; // Escape should not trigger other navigation actions.
  }

  // --- Context: Info Tabs / FAQ ---
  // Note: Navigation *within* the info/FAQ section is handled in `infoTabs.ts`.
  // This handler only manages navigation *out* of that section.
  if (target.closest("#info-tabs")) {
    if (key === "ArrowDown") {
      const activeTabId = target.dataset.tab;
      const faqButtons = Array.from(
        document.querySelectorAll<HTMLButtonElement>(".faq-button")
      );
      if (activeTabId === "faq" && faqButtons.length > 0) {
        // Let the default behavior in infoTabs.ts handle it
        return;
      }
      // For other tabs, or an empty FAQ, move to the file input
      event.preventDefault();
      nextEl = $<HTMLLabelElement>(".file-input-label");
    }
  }
  // --- Context: File Input Button ---
  else if (target.matches(".file-input-label")) {
    if (key === "ArrowUp" || key === "ArrowLeft") {
      event.preventDefault();
      // Go to the active tab, ignoring state.
      nextEl = $<HTMLButtonElement>("#info-tabs .tab-button.active");
    } else if ((key === "ArrowDown" || key === "ArrowRight") && hasResults) {
      event.preventDefault();
      // Go to the first element in the results grid.
      nextEl = allCards[0]?.querySelector<HTMLElement>(".secret-input");
    } else if ((key === "ArrowDown" || key === "ArrowRight") && !hasResults) {
      event.preventDefault();
      // Go to the first element in the footer.
      nextEl = $<HTMLElement>("#author-link");
    }
  }
  // --- Context: Export/Clear Buttons ---
  else if (target.closest("#export-container")) {
    lastFocusedInExport = target;
    const isDownloadBtn = target.matches("#download-csv-button");
    const isClearBtn = target.matches("#clear-all-button");

    if (key === "ArrowUp" && hasResults) {
      event.preventDefault();
      // Go to the last focused element in the results grid, or default to the last one.
      nextEl =
        lastFocusedInResults ||
        allCards[allCards.length - 1]?.querySelector<HTMLElement>(
          ".qr-code-container"
        );
    } else if (isDownloadBtn && key === "ArrowRight") {
      event.preventDefault();
      nextEl = $<HTMLButtonElement>("#clear-all-button");
    } else if (isDownloadBtn && key === "ArrowLeft") {
      event.preventDefault();
      if (hasResults) {
        // Go to the last element in the results grid.
        nextEl =
          allCards[allCards.length - 1]?.querySelector<HTMLElement>(
            ".qr-code-container"
          );
      }
    } else if (isClearBtn && key === "ArrowLeft") {
      event.preventDefault();
      nextEl = $<HTMLButtonElement>("#download-csv-button");
    } else if (key === "ArrowDown" || (isClearBtn && key === "ArrowRight")) {
      // This applies to both buttons on ArrowDown, and only clear on ArrowRight
      event.preventDefault();
      // Go to the last focused element in the footer, or default to the first one.
      nextEl = lastFocusedInFooter || $<HTMLElement>("#author-link");
    }
  }
  // --- Context: Results Grid ---
  else if (target.closest("#results-container")) {
    lastFocusedInResults = target;
    // Handle activation with Enter or Space
    if (key === "Enter" || key === " ") {
      event.preventDefault();
      if (target.matches(".secret-input, .url-input")) {
        const inputElement = target as HTMLInputElement;
        const button =
          inputElement.parentElement?.querySelector(".copy-button");
        if (button) copyToClipboard(inputElement.value, button as HTMLElement);
      } else if (target.matches(".copy-button")) {
        const input = target.parentElement?.querySelector(
          "input"
        ) as HTMLInputElement;
        if (input)
          copyToClipboard(target.dataset.copyText || input.value, target);
      } else {
        target.click();
      }
      return;
    }

    const currentCard = target.closest(".otp-card") as HTMLElement;
    if (!currentCard) return;

    const currentCardIndex = allCards.indexOf(currentCard);
    if (!target.matches(".qr-code-container")) lastFocusedCopyButton = null;

    switch (key) {
      case "ArrowDown":
        event.preventDefault();
        if (target.matches(".secret-input")) {
          nextEl = currentCard.querySelector<HTMLElement>(".url-input");
        } else if (target.matches(".secret-container .copy-button")) {
          nextEl = currentCard.querySelector<HTMLElement>(
            ".otp-url-container .copy-button"
          );
        } else if (target.matches(".url-input")) {
          if (currentCardIndex < allCards.length - 1) {
            nextEl =
              allCards[currentCardIndex + 1].querySelector<HTMLElement>(
                ".secret-input"
              );
          } else {
            // Go to the last focused export button, or default to the first one.
            nextEl =
              lastFocusedInExport ||
              $<HTMLButtonElement>("#download-csv-button");
          }
        } else if (target.matches(".otp-url-container .copy-button")) {
          if (currentCardIndex < allCards.length - 1) {
            nextEl = allCards[currentCardIndex + 1].querySelector<HTMLElement>(
              ".secret-container .copy-button"
            );
          } else {
            // Go to the last focused export button, or default to the first one.
            nextEl =
              lastFocusedInExport ||
              $<HTMLButtonElement>("#download-csv-button");
          }
        } else if (target.matches(".qr-code-container")) {
          // From QR code down to next QR code
          if (currentCardIndex < allCards.length - 1) {
            nextEl =
              allCards[currentCardIndex + 1].querySelector<HTMLElement>(
                ".qr-code-container"
              );
          } else {
            // Go to the last focused export button, or default to the first one.
            nextEl =
              lastFocusedInExport ||
              $<HTMLButtonElement>("#download-csv-button");
          }
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (target.matches(".url-input")) {
          nextEl = currentCard.querySelector<HTMLElement>(".secret-input");
        } else if (target.matches(".otp-url-container .copy-button")) {
          nextEl = currentCard.querySelector<HTMLElement>(
            ".secret-container .copy-button"
          );
        } else if (target.matches(".secret-input")) {
          if (currentCardIndex > 0) {
            nextEl =
              allCards[currentCardIndex - 1].querySelector<HTMLElement>(
                ".url-input"
              );
          } else {
            // Go to file input, ignoring state.
            nextEl = $<HTMLLabelElement>(".file-input-label");
          }
        } else if (target.matches(".secret-container .copy-button")) {
          if (currentCardIndex > 0) {
            nextEl = allCards[currentCardIndex - 1].querySelector<HTMLElement>(
              ".otp-url-container .copy-button"
            );
          } else {
            // Go to file input, ignoring state.
            nextEl = $<HTMLLabelElement>(".file-input-label");
          }
        } else if (target.matches(".qr-code-container")) {
          if (currentCardIndex > 0) {
            nextEl =
              allCards[currentCardIndex - 1].querySelector<HTMLElement>(
                ".qr-code-container"
              );
          } else {
            // Go to file input, ignoring state.
            nextEl = $<HTMLLabelElement>(".file-input-label");
          }
        }
        break;

      case "ArrowRight":
        event.preventDefault();
        if (target.matches(".secret-input, .url-input")) {
          nextEl =
            target.parentElement?.querySelector<HTMLElement>(".copy-button") ??
            null;
        } else if (target.matches(".copy-button")) {
          lastFocusedCopyButton = target;
          nextEl = currentCard.querySelector<HTMLElement>(".qr-code-container");
        } else if (target.matches(".qr-code-container")) {
          if (currentCardIndex < allCards.length - 1) {
            nextEl =
              allCards[currentCardIndex + 1].querySelector<HTMLElement>(
                ".secret-input"
              );
          } else {
            // Go to first export button, ignoring state.
            nextEl = $<HTMLButtonElement>("#download-csv-button");
          }
        }
        break;

      case "ArrowLeft":
        event.preventDefault();
        if (target.matches(".copy-button")) {
          nextEl =
            target.parentElement?.querySelector<HTMLElement>("input") ?? null;
        } else if (target.matches(".qr-code-container")) {
          // Restore focus to the last focused copy button on this card, or default to the first one.
          nextEl =
            lastFocusedCopyButton ||
            currentCard.querySelector<HTMLElement>(
              ".secret-container .copy-button"
            );
        } else if (target.matches(".url-input")) {
          nextEl = currentCard.querySelector<HTMLElement>(".secret-input");
        } else if (target.matches(".secret-input")) {
          if (currentCardIndex > 0) {
            nextEl =
              allCards[currentCardIndex - 1].querySelector<HTMLElement>(
                ".qr-code-container"
              );
          } else {
            // Go to file input, ignoring state.
            nextEl = $<HTMLLabelElement>(".file-input-label");
          }
        }
        break;

      case "Home":
        event.preventDefault();
        nextEl = event.ctrlKey
          ? allCards[0]?.querySelector<HTMLElement>(".secret-input")
          : currentCard.querySelector<HTMLElement>(".secret-input");
        break;

      case "End":
        event.preventDefault();
        if (event.ctrlKey) {
          const lastCard = allCards[allCards.length - 1];
          nextEl = lastCard?.querySelector<HTMLElement>(".qr-code-container");
        } else {
          nextEl = currentCard.querySelector<HTMLElement>(".qr-code-container");
        }
        break;
    }

    if (nextEl && !currentCard.contains(nextEl)) {
      // If we are navigating outside the current card, reset the intra-card state.
      lastFocusedCopyButton = null;
    }
  }
  // --- Context: Footer ---
  else if (target.closest("footer")) {
    lastFocusedInFooter = target;
    const authorLink = $<HTMLAnchorElement>("#author-link");
    const sourceLink = $<HTMLAnchorElement>("#source-code-link");
    const themeSwitcher = $<HTMLDivElement>("#theme-switcher");

    // Let the theme switcher handle its own internal key events
    if (target.closest("#theme-switcher")) {
      // Except for ArrowUp, which should navigate out of the component.
      if (key === "ArrowUp") {
        event.preventDefault();
        // Go to the last focused export button if results exist, otherwise file input.
        nextEl = hasResults
          ? lastFocusedInExport || $<HTMLButtonElement>("#download-csv-button")
          : $<HTMLLabelElement>(".file-input-label");
      }
      // For other keys, the component's internal handlers will use stopPropagation.
      if (nextEl) setFocus(target, nextEl);
      return;
    }

    if (key === "Enter" || key === " ") {
      event.preventDefault();
      (target as HTMLElement).click();
      return;
    }

    switch (key) {
      case "ArrowUp":
        event.preventDefault();
        // Go to the last focused export button if results exist, otherwise file input.
        nextEl = hasResults
          ? lastFocusedInExport || $<HTMLButtonElement>("#download-csv-button")
          : $<HTMLLabelElement>(".file-input-label");
        break;

      case "ArrowDown":
        event.preventDefault();
        // From any footer link, ArrowDown goes to the first link.
        nextEl = authorLink;
        break;

      case "ArrowRight":
        event.preventDefault();
        if (target === authorLink) {
          nextEl = sourceLink;
        } else if (target === sourceLink) {
          nextEl = themeSwitcher;
        }
        break;

      case "ArrowLeft":
        event.preventDefault();
        if (target === themeSwitcher) {
          nextEl = sourceLink;
        } else if (target === sourceLink) {
          nextEl = authorLink;
        } else if (target === authorLink) {
          // From the first item, left arrow should go up to the previous section.
          nextEl = hasResults
            ? $<HTMLButtonElement>("#clear-all-button") // Last button in export
            : $<HTMLLabelElement>(".file-input-label");
        }
        break;
    }
  }

  if (nextEl) {
    setFocus(target, nextEl);
  }
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
      // If we just cleared the results, reset navigation state and focus file input.
      lastFocusedCopyButton = null;
      lastFocusedInResults = null;
      lastFocusedInExport = null;
      lastFocusedInFooter = null;
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

  // --- Accessibility Enhancement: Close modal with Enter or Space on the close button ---
  modalCloseButton.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      hideQrModal();
    }
  });

  // Add a single, centralized keyboard navigation handler for the document
  document.addEventListener("keydown", handleKeydown);
}
