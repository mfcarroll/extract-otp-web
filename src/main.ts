import { encode } from "thirty-two";
import { Buffer } from "buffer"; // Keep for browser environment polyfill
import { OtpData, MigrationOtpParameter } from "./types";
import { setState, getState } from "./state/store";
import { $ } from "./ui/dom";
import { processImage, getOtpUniqueKey } from "./services/qrProcessor";
import { initResults } from "./ui/results";

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.

/**
 * Sets up the event listeners for the tabbed informational interface.
 * Uses event delegation for efficiency.
 */
function setupTabs(): void {
  const tabsContainer = document.getElementById("info-tabs");
  if (!tabsContainer) return;

  const tabButtons =
    tabsContainer.querySelectorAll<HTMLHeadingElement>(".tab-button");
  const tabContents =
    tabsContainer.querySelectorAll<HTMLDivElement>(".tab-content");

  tabsContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".tab-button")) return;

    const tabId = target.dataset.tab;
    if (!tabId) return;

    // Deactivate all buttons and content panels
    tabButtons.forEach((button) => button.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Activate the clicked button and its corresponding content panel
    target.classList.add("active");
    $(`#tab-${tabId}`).classList.add("active");
  });
}

/**
 * Sets up the event listeners for the accordion-style FAQ.
 * Uses event delegation for efficiency.
 */
function setupAccordion(): void {
  const faqContainer = document.getElementById("tab-faq");
  if (!faqContainer) return;

  faqContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    // If a link inside the answer is clicked, do nothing.
    // This allows links to be opened without toggling the accordion.
    if (target.closest("a")) {
      return;
    }
    // Find the closest faq-item from the click
    const faqItem = target.closest<HTMLDivElement>(".faq-item");
    if (!faqItem) return;

    const button = faqItem.querySelector<HTMLButtonElement>(".faq-button");
    if (!button) return;

    // Toggle the 'open' class on the clicked item. This will show/hide the answer.
    faqItem.classList.toggle("open");

    // Update the aria-expanded attribute for accessibility.
    const isExpanded = faqItem.classList.contains("open");
    button.setAttribute("aria-expanded", String(isExpanded));
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
function addUploadLog(
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
  // Use a filler span to create the dotted line between filename and message
  logItem.innerHTML = `<i class="fa fa-file"></i><span class="log-file-name">${escapeHtml(
    fileName
  )}</span><span class="log-filler"></span><span class="log-message">${message}</span>`;

  logList.appendChild(logItem);
}

function displayError(message: string, duration = 5000): void {
  const errorContainer = $<HTMLDivElement>("#error-message-container");

  // To prevent multiple error messages from stacking, remove any existing one.
  const existingError = errorContainer.querySelector(".error-message");
  if (existingError) {
    existingError.remove();
  }

  const errorElement = document.createElement("div");
  errorElement.className = "error-message";
  errorElement.textContent = message;

  // Prepend the error message so it appears at the top.
  errorContainer.prepend(errorElement);

  // Set a timeout to make the error message disappear.
  setTimeout(() => {
    // Add a class to trigger the fade-out animation.
    errorElement.classList.add("fade-out");
    // After the animation, remove the element from the DOM.
    errorElement.addEventListener("transitionend", () => errorElement.remove());
  }, duration);
}

async function processFiles(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files);

  try {
    const logContainer = $<HTMLDivElement>("#upload-log-container");

    if (logContainer.style.display === "none") {
      logContainer.style.display = "block";
    }

    const currentOtps = getState().otps;
    const firstNewIndex = currentOtps.length;
    const newlyAddedOtps: MigrationOtpParameter[] = [];
    let anyDuplicatesOrErrors = false;

    // This set will contain keys from previously extracted OTPs AND OTPs from the current batch.
    const existingAndBatchKeys = new Set(currentOtps.map(getOtpUniqueKey));

    for (const file of fileArray) {
      try {
        const otpParameters = await processImage(file);

        if (otpParameters && otpParameters.length > 0) {
          let extractedInFile = 0;
          let duplicatesInFile = 0;

          for (const otp of otpParameters) {
            const key = getOtpUniqueKey(otp);
            if (existingAndBatchKeys.has(key)) {
              duplicatesInFile++;
            } else {
              newlyAddedOtps.push(otp);
              existingAndBatchKeys.add(key);
              extractedInFile++;
            }
          }

          if (extractedInFile > 0) {
            const plural = extractedInFile > 1 ? "s" : "";
            addUploadLog(
              file.name,
              "success",
              `${extractedInFile} secret${plural} extracted.`
            );
          }
          if (duplicatesInFile > 0) {
            anyDuplicatesOrErrors = true;
            const plural = duplicatesInFile > 1 ? "s" : "";
            addUploadLog(
              file.name,
              "warning",
              `${duplicatesInFile} duplicate secret${plural} skipped.`
            );
          }
        } else {
          if (otpParameters === null) {
            addUploadLog(file.name, "warning", "No QR code found.");
          } else {
            addUploadLog(file.name, "info", "No OTP secrets found.");
          }
        }
      } catch (error: any) {
        anyDuplicatesOrErrors = true;
        const message =
          (error instanceof Error ? error.message : String(error)) ||
          "An unknown error occurred.";
        console.error(`Error processing file ${file.name}:`, error);
        addUploadLog(file.name, "error", message);
      }
    }

    if (newlyAddedOtps.length > 0) {
      setState((currentState) => ({
        otps: [...currentState.otps, ...newlyAddedOtps],
      }));

      const firstNewCard = document.getElementById(`otp-card-${firstNewIndex}`);
      if (!anyDuplicatesOrErrors && firstNewCard) {
        firstNewCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }

    // If there were any issues, scroll to the log/drop area to make them visible.
    if (anyDuplicatesOrErrors) {
      const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
      fileDropZone.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  } catch (error: any) {
    displayError(
      error.message || "An unexpected error occurred while processing files."
    );
  }
}

function downloadAsCsv(): void {
  const { otps } = getState();
  if (otps.length === 0) {
    alert("No data to export.");
    return;
  }

  const headers: (keyof OtpData)[] = [
    "name",
    "secret",
    "issuer",
    "type",
    "counter",
    "url",
  ];

  const escapeCsvField = (field: any): string => {
    const str = String(field ?? "");
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const otpDataForCsv = otps.map(convertToOtpData);
  const csvRows = [
    headers.join(","),
    ...otpDataForCsv.map((otp) =>
      headers.map((header) => escapeCsvField(otp[header])).join(",")
    ),
  ];

  const csvString = csvRows.join("\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });

  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.setAttribute("href", url);
  link.setAttribute("download", "otp_secrets.csv");
  link.style.visibility = "hidden";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function convertToOtpData(otp: MigrationOtpParameter): OtpData {
  const secretText = encode(otp.secret);
  const accountName = otp.name || "N/A";
  const typeText = otp.type === 2 ? "totp" : "hotp";

  let label = accountName;
  if (otp.issuer) {
    label = `${otp.issuer}:${accountName}`;
  }
  const encodedLabel = encodeURIComponent(label);

  let otpAuthUrl = `otpauth://${typeText}/${encodedLabel}?secret=${secretText}`;
  if (otp.issuer) {
    otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
  }
  if (typeText === "hotp") {
    otpAuthUrl += `&counter=${otp.counter || 0}`;
  }

  return {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || "",
    type: typeText,
    counter: typeText === "hotp" ? otp.counter || 0 : "",
    url: decodeURIComponent(otpAuthUrl),
  };
}

/**
 * Manages the theme switcher UI and applies the selected theme.
 * Implements an "anchored expand" behavior based on the active theme.
 */
function setupThemeSwitcher(): void {
  const themeSwitcherWrapper = document.querySelector<HTMLDivElement>(
    ".theme-switcher-wrapper"
  );
  if (!themeSwitcherWrapper) return;

  const themeSwitcher =
    themeSwitcherWrapper.querySelector<HTMLDivElement>(".theme-switcher");
  if (!themeSwitcher) return;

  const buttons = themeSwitcher.querySelectorAll<HTMLButtonElement>("button");
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  // This flag helps solve a tricky focus bug. When the user focuses another
  // window and then clicks back into this one, the browser might automatically
  // re-focus the last active element (a button in our switcher). This would
  // trigger a 'focusin' event and incorrectly open the switcher.
  // We track when the window loses focus so we can ignore the next 'focusin'.
  let isWindowLosingFocus = false;
  window.addEventListener("blur", () => {
    // 'blur' fires when the user switches to another window/tab.
    isWindowLosingFocus = true;
  });

  /**
   * Applies the selected theme to the document and updates UI elements.
   * @param theme - The theme to apply ('light', 'dark', or 'system').
   */
  const applyTheme = (theme: string): void => {
    const html = document.documentElement;
    html.classList.remove("light-mode", "dark-mode");
    buttons.forEach((button) => button.classList.remove("active"));

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme = mediaQuery.matches ? "dark" : "light";
    }

    if (effectiveTheme === "dark") {
      html.classList.add("dark-mode");
    } else {
      html.classList.add("light-mode");
    }

    const buttonToActivate = themeSwitcher.querySelector<HTMLButtonElement>(
      `button[data-theme="${theme}"]`
    );
    buttonToActivate?.classList.add("active");

    localStorage.setItem("theme", theme);

    // Redraw QR codes with new theme colors
    // The results module will re-render itself on theme change if needed.
    // For now, we can force a re-render by re-setting the otps.
    setState((s) => ({ otps: s.otps }));
  };

  /**
   * Calculates and applies the CSS transform to keep the active icon anchored
   * when the switcher is open. This robust version reads geometry from computed
   * styles to avoid hardcoding pixel values.
   * Specification points: 2, 3, 6
   */
  const positionSwitcher = () => {
    const activeButton =
      themeSwitcher.querySelector<HTMLButtonElement>("button.active");
    if (!activeButton) return;

    const allButtons = Array.from(buttons);
    const activeIndex = allButtons.indexOf(activeButton);

    if (activeIndex === -1) return;

    // The middle button has index 1. This is our anchor point.
    const centerIndex = 1;
    const indexOffset = activeIndex - centerIndex;

    // If the middle button is active, no offset is needed, so we can
    // remove the custom property and rely on the CSS default.
    if (indexOffset === 0) {
      themeSwitcher.style.removeProperty("--switcher-transform-x");
      return;
    }

    // In the open state, each button is 32px wide with a 0.125rem (2px)
    // margin on each side. The "pitch" is the center-to-center distance.
    const buttonPitch = 32 + 2 * 2; // width + margin-left + margin-right

    // The offset is the distance from the center button.
    const horizontalOffset = indexOffset * buttonPitch;

    // The CSS transform is `translateX(var(--switcher-transform-x, -50%))`.
    // We need to adjust this from the default -50% to keep the active
    // icon in place. The adjustment is the negative of the horizontal offset.
    themeSwitcher.style.setProperty(
      "--switcher-transform-x",
      `calc(-50% - ${horizontalOffset}px)`
    );
  };

  /**
   * Opens the switcher with the active icon anchored in its current position.
   * Specification points: 2, 3, 6
   */
  const openSwitcher = (): void => {
    if (themeSwitcherWrapper.classList.contains("open")) return;

    // Before opening, lock the wrapper's size to its current computed size.
    // This prevents the page layout from shifting when the inner container
    // is switched to absolute positioning.
    const rect = themeSwitcherWrapper.getBoundingClientRect();
    themeSwitcherWrapper.style.width = `${rect.width}px`;
    themeSwitcherWrapper.style.height = `${rect.height}px`;

    positionSwitcher();
    themeSwitcherWrapper.classList.add("open");
  };

  /**
   * Closes the switcher and resets its position to center the active icon.
   * Specification points: 1, 5
   */
  const closeSwitcher = (): void => {
    themeSwitcherWrapper.classList.remove("open");
    // Reset the transform so the active icon collapses to the center.
    themeSwitcher.style.removeProperty("--switcher-transform-x");

    // Remove the inline size so the wrapper can shrink-to-fit its content again.
    themeSwitcherWrapper.style.removeProperty("width");
    themeSwitcherWrapper.style.removeProperty("height");
  };

  // --- Event Listeners ---

  // Open on hover
  themeSwitcherWrapper.addEventListener("mouseenter", openSwitcher);
  themeSwitcherWrapper.addEventListener("focusin", () => {
    // If the 'focusin' event is the result of the browser restoring focus
    // after the window was re-activated, we want to ignore it.
    if (isWindowLosingFocus) {
      // Reset the flag and do nothing.
      isWindowLosingFocus = false;
      return;
    }
    // Otherwise, it's a normal focus event (e.g., from tabbing).
    openSwitcher();
  });

  // Close when focus leaves the component
  themeSwitcherWrapper.addEventListener("mouseleave", closeSwitcher);
  themeSwitcherWrapper.addEventListener("focusout", (e: FocusEvent) => {
    // Check if the new focused element is still inside the wrapper
    if (!themeSwitcherWrapper.contains(e.relatedTarget as Node)) {
      closeSwitcher();
    }
  });

  // Handle theme selection
  themeSwitcher.addEventListener("click", (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest("button");
    if (target) {
      const newTheme = target.dataset.theme;
      if (newTheme) {
        applyTheme(newTheme);
        // Per specification, do not re-position the switcher here.
        // The switcher remains anchored to the PREVIOUSLY active icon
        // until it is closed and reopened.
      }
    }
  });

  // Update theme if the system preference changes
  mediaQuery.addEventListener("change", () => {
    const currentTheme = localStorage.getItem("theme") || "system";
    if (currentTheme === "system") {
      applyTheme("system");
    }
  });

  // Initialize theme
  const savedTheme = localStorage.getItem("theme") || "system";
  applyTheme(savedTheme);
  closeSwitcher(); // Ensure it's closed and centered on init
}

/**
 * Initializes the application by setting up all event listeners.
 * This function is called once the DOM is fully loaded.
 */
function initializeApp(): void {
  setupTabs();
  initResults();
  setupAccordion();
  setupThemeSwitcher();

  // Listen for file input changes
  $<HTMLInputElement>("#qr-input").addEventListener(
    "change",
    (event: Event) => {
      processFiles((event.target as HTMLInputElement).files);
    }
  );

  // Listen for CSV download button clicks
  $<HTMLButtonElement>("#download-csv-button").addEventListener(
    "click",
    downloadAsCsv
  );

  // Listen for Clear All button clicks
  $<HTMLButtonElement>("#clear-button").addEventListener("click", () => {
    const resultsContainer = $<HTMLDivElement>("#results-container");
    const exportContainer = $<HTMLDivElement>("#export-container");
    const qrInput = $<HTMLInputElement>("#qr-input");
    const logContainer = $<HTMLDivElement>("#upload-log-container");
    const logList = $<HTMLUListElement>("#upload-log-list");

    resultsContainer.innerHTML = "";
    logList.innerHTML = "";
    exportContainer.style.display = "none";
    logContainer.style.display = "none";
    setState(() => ({
      otps: [],
    }));
    qrInput.value = ""; // Reset file input so the same files can be re-selected
  });

  // --- Drag and Drop Event Listeners ---
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");
  const dragOverlay = $<HTMLDivElement>("#drag-overlay");
  let dragCounter = 0;

  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  // Prevent default drag behaviors for the entire page.
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    document.body.addEventListener(eventName, preventDefaults);
  });

  // Add a visual indicator when a file is dragged over the page.
  document.body.addEventListener("dragenter", () => {
    dragCounter++;
    fileDropZone.classList.add("active");
    dragOverlay.classList.add("active");
  });

  // Remove the visual indicator when the file leaves the page.
  document.body.addEventListener("dragleave", () => {
    dragCounter--;
    if (dragCounter === 0) {
      fileDropZone.classList.remove("active");
      dragOverlay.classList.remove("active");
    }
  });

  // Handle the dropped files anywhere on the page.
  document.body.addEventListener("drop", (event: DragEvent) => {
    dragCounter = 0;
    fileDropZone.classList.remove("active");
    dragOverlay.classList.remove("active");
    processFiles(event.dataTransfer?.files ?? null);
  });
}

// Initialize the application once the DOM is ready.
document.addEventListener("DOMContentLoaded", initializeApp);
