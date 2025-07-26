import { $ } from "./dom";
import { setState } from "../state/store";

/**
 * Fades out and removes an error message element.
 * @param errorElement The error element to close.
 */
function closeError(errorElement: HTMLElement): void {
  errorElement.classList.add("fade-out");
  // Remove the element after the fade-out transition completes.
  errorElement.addEventListener("transitionend", () => errorElement.remove(), {
    once: true,
  });
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/**
 * Adds an entry to the upload log in the UI.
 * @param fileName The name of the file processed.
 * @param status The status of the processing (e.g., 'success', 'error', 'info', 'warning').
 * @param message The message to display.
 */
export function addUploadLog(
  fileName: string,
  status: "success" | "info" | "warning" | "error",
  message: string
): void {
  const logContainer = $<HTMLDivElement>("#upload-log-container");
  if (logContainer.style.display === "none") {
    logContainer.style.display = "block";
  }

  const logList = $<HTMLUListElement>("#upload-log-list");
  const logItem = document.createElement("li");
  logItem.className = `log-item log-item--${status}`;
  logItem.innerHTML = `<i class="fa fa-file"></i><span class="log-file-name">${escapeHtml(
    fileName
  )}</span><span class="log-filler"></span><span class="log-message">${message}</span>`;

  logList.appendChild(logItem);
  setState((s) => ({ ...s, logCount: (s.logCount || 0) + 1 }));
}

/**
 * Displays a dismissible error message at the top of the main content area.
 * @param message The error message to display.
 */
export function displayError(message: string): void {
  const errorContainer = $<HTMLDivElement>("#error-message-container");

  // Remove any existing error to prevent multiple messages from stacking.
  const existingError = errorContainer.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }

  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.setAttribute("role", "alert"); // Announce to screen readers

  const messageSpan = document.createElement("span");
  messageSpan.textContent = message;

  const closeButton = document.createElement("button");
  closeButton.className = "error-close-button";
  closeButton.innerHTML = "&#x2715;"; // '✕' symbol
  closeButton.setAttribute("aria-label", "Close error message");

  errorElement.appendChild(messageSpan);
  errorElement.appendChild(closeButton);

  errorContainer.prepend(errorElement);

  // The entire message can be clicked to dismiss.
  errorElement.addEventListener("click", () => {
    closeError(errorElement);
  });
}

/**
 * Clears all entries from the upload log and hides the container.
 */
export function clearLogs(): void {
  const logContainer = $<HTMLDivElement>("#upload-log-container");
  const logList = $<HTMLUListElement>("#upload-log-list");
  logList.innerHTML = "";
  logContainer.style.display = "none";
}

/**
 * Makes an announcement to screen readers using a visually-hidden live region.
 * @param message The message to be announced.
 */
export function announceToScreenReader(message: string): void {
  const announcer = $<HTMLDivElement>("#sr-announcer");
  // Set text content and then clear it after a short delay.
  // This ensures that the same message can be announced again if needed.
  announcer.textContent = message;
  setTimeout(() => {
    announcer.textContent = "";
  }, 1000);
}
