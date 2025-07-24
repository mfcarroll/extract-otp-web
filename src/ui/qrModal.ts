import QRCode from "qrcode";
import { $ } from "./dom";

// --- Accessibility Enhancement: Store focus before modal opens ---
let elementThatOpenedModal: HTMLElement | null = null;

function handleModalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation(); // Prevent the global handler from also firing
    hideQrModal();
  }
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

export function showQrModal(otpAuthUrl: string, title: string): void {
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
  modal.addEventListener("keydown", handleModalKeydown);
  modalCloseButton.focus();
}

export function initQrModal(): void {
  const modal = $<HTMLDivElement>("#qr-modal");
  const modalCloseButton = $<HTMLButtonElement>(".modal-close");

  modal.addEventListener("click", (event) => {
    if (event.target === modal) hideQrModal();
  });

  modalCloseButton.addEventListener("click", hideQrModal);
}
