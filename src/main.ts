import { Buffer } from "buffer"; // Keep for browser environment polyfill
import { initResults } from "./ui/results";
import { initFileInput } from "./ui/fileInput";
import { initQrModal } from "./ui/qrModal";
import { initThemeSwitcher } from "./ui/theme";
import { initExportControls } from "./ui/exportControls";
import { initNavigation } from "./ui/navigation";
import { initFooter } from "./ui/footer";
import { initTabs } from "./ui/tabs";
import { initAccordion } from "./ui/accordion";
import { displayError } from "./ui/notifications";

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.

/**
 * Sets up global error handlers to catch unhandled exceptions and promise
 * rejections, providing a user-friendly error message.
 */
function setupGlobalErrorHandling(): void {
  const genericErrorMessage =
    "An unexpected error occurred. Please try again or refresh the page.";

  window.addEventListener("error", (event) => {
    console.error("Uncaught error:", event.error);
    displayError(genericErrorMessage);
  });

  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    displayError(genericErrorMessage);
  });
}

/**
 * Initializes the application by setting up all event listeners.
 * This function is called once the DOM is fully loaded.
 */
function initializeApp(): void {
  setupGlobalErrorHandling();
  initNavigation();
  initTabs();
  initAccordion();
  initQrModal();
  initResults();
  initFileInput();
  initThemeSwitcher();
  initExportControls();
  initFooter();
}

// Initialize the application once the DOM is ready.
document.addEventListener("DOMContentLoaded", initializeApp);
