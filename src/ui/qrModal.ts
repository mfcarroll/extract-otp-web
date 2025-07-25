import QRCode from "qrcode";
import { $ } from "./dom";

// --- Accessibility Enhancement: Manage focus before/after modal opens ---
let elementThatOpenedModal: HTMLElement | null = null;
/**
 * Tracks if the modal was opened by a keyboard action. This helps decide
 * whether to restore focus to the triggering element, which is desirable for
 * keyboard users but not for mouse users.
 */
let openedByKeyboard = false;

function handleModalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation(); // Prevent the global handler from also firing
    hideQrModal();
    return;
  }

  // Trap focus within the modal
  if (event.key === "Tab") {
    const modal = $<HTMLDivElement>("#qr-modal");
    // Find all focusable elements within the modal
    const focusableElements = Array.from(
      modal.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )
    ).filter(
      (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
    );

    if (focusableElements.length === 0) return;

    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    if (event.shiftKey) {
      // If shift + tab is pressed on the first element, move focus to the last
      if (document.activeElement === firstElement) {
        lastElement.focus();
        event.preventDefault();
      }
    } else {
      // If tab is pressed on the last element, move focus to the first
      if (document.activeElement === lastElement) {
        firstElement.focus();
        event.preventDefault();
      }
    }
  }
}

function hideQrModal(): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  modal.style.display = "none";
  $<HTMLDivElement>("#modal-content").innerHTML = "";
  modal.removeEventListener("keydown", handleModalKeydown);

  // --- Accessibility Enhancement: Restore focus to the element that opened the modal ---
  // Only restore focus if the modal was opened via the keyboard. This prevents
  // the focus ring from appearing on an element that was simply clicked with a mouse.
  if (elementThatOpenedModal) {
    if (openedByKeyboard) {
      elementThatOpenedModal.focus();
    }
    elementThatOpenedModal = null;
  }
  document.body.classList.remove("modal-open");
}

export function showQrModal(
  otpAuthUrl: string,
  title: string,
  fromKeyboard = false
): void {
  // --- Accessibility Enhancement: Store the element that had focus ---
  elementThatOpenedModal = document.activeElement as HTMLElement;
  openedByKeyboard = fromKeyboard;

  const modal = $<HTMLDivElement>("#qr-modal");
  const modalContent = $<HTMLDivElement>("#modal-content");
  const modalCloseButton = $<HTMLButtonElement>(".modal-close");
  const modalTitleId = "qr-modal-title";

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
  titleElement.id = modalTitleId;
  titleElement.className = "modal-title";
  titleElement.textContent = title;
  modalContent.appendChild(titleElement);

  modal.style.display = "flex";
  modal.setAttribute("aria-labelledby", modalTitleId);
  modal.addEventListener("keydown", handleModalKeydown);
  modalCloseButton.focus();
  document.body.classList.add("modal-open");
}

export function initQrModal(): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  const modalCloseButton = $<HTMLButtonElement>(".modal-close");

  modal.addEventListener("click", (event) => {
    if (event.target === modal) hideQrModal();
  });

  modalCloseButton.addEventListener("click", hideQrModal);
}
