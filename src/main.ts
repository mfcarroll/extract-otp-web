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
}

// Initialize the application once the DOM is ready.
document.addEventListener("DOMContentLoaded", initializeApp);
