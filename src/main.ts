import { Buffer } from "buffer"; // Keep for browser environment polyfill
import { $ } from "./ui/dom";
import { initResults } from "./ui/results";
import { initFileInput } from "./ui/fileInput";
import { initThemeSwitcher } from "./ui/theme";
import { initInfoTabs } from "./ui/infoTabs";
import { initExportControls } from "./ui/exportControls";
import { initFooter } from "./ui/footer";

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.

/**
 * Handles the very first keyboard interaction on the page to provide an
 * entry point into the UI for keyboard-only users.
 * @param event The keyboard event.
 */
function handleInitialPageKeydown(event: KeyboardEvent): void {
  // This listener should only act when no element has focus, or the body has focus.
  // Once an element has focus, this listener will ignore subsequent key presses.
  if (document.activeElement && document.activeElement !== document.body) {
    return;
  }

  // On Down or Right arrow, focus the first interactive element.
  if (event.key === "ArrowDown" || event.key === "ArrowRight") {
    event.preventDefault();
    // The currently active tab is a good initial target.
    const activeTab = $<HTMLButtonElement>("#info-tabs .tab-button.active");
    activeTab?.focus();
  }
}

/**
 * Initializes the application by setting up all event listeners.
 * This function is called once the DOM is fully loaded.
 */
function initializeApp(): void {
  initInfoTabs();
  initResults();
  initFileInput();
  initThemeSwitcher();
  initExportControls();
  initFooter();

  // Add a listener to handle initial keyboard navigation entry.
  document.addEventListener("keydown", handleInitialPageKeydown);
}

// Initialize the application once the DOM is ready.
document.addEventListener("DOMContentLoaded", initializeApp);
