import jsQR from "jsqr";
import protobuf from "protobufjs";
import { encode } from "thirty-two";
import { Buffer } from "buffer"; // Keep for browser environment polyfill
import QRCode from "qrcode";
import { OtpData } from "./types";

// Define a more specific type for the raw OTP data from the protobuf payload.
interface MigrationOtpParameter {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: number; // ALGORITHM_UNSPECIFIED (0), SHA1 (1)
  digits: number; // DIGITS_UNSPECIFIED (0), SIX (1), EIGHT (2)
  type: number; // TYPE_UNSPECIFIED (0), HOTP (1), TOTP (2)
  counter: number;
}

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.
let extractedOtps: MigrationOtpParameter[] = []; // To store data for CSV export

// Pre-load the protobuf definition once for better performance.
const protobufRoot = protobuf.load("google_auth.proto");

/** Generic helper to query the DOM and throw an error if the element is not found. */
function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element with selector "${selector}" not found.`);
  }
  return element;
}

/**
 * Extracts OTP parameters from a Google Authenticator export URL.
 * @param otpUrl The full otpauth-migration URL from the QR code.
 * @returns A promise that resolves to an array of OTP parameters.
 */
async function getOtpParametersFromUrl(
  otpUrl: string
): Promise<MigrationOtpParameter[]> {
  const url = new URL(otpUrl);
  const dataBase64 = url.searchParams.get("data");
  if (!dataBase64) {
    throw new Error('Invalid OTP URL: Missing "data" parameter.');
  }

  const data = base64ToUint8Array(dataBase64);

  const root = await protobufRoot;
  const MigrationPayload = root.lookupType("MigrationPayload");

  const payload = MigrationPayload.decode(data) as unknown as {
    otpParameters: MigrationOtpParameter[];
  };
  return payload.otpParameters;
}

/**
 * Processes a single image file, extracts QR code data, and returns OTP parameters.
 * @param file The image file to process.
 * @returns A promise that resolves with an array of OTP parameters, or an empty array if no QR code is found.
 */
function processImage(file: File): Promise<MigrationOtpParameter[] | null> {
  return new Promise((resolve, reject) => {
    const canvas = $<HTMLCanvasElement>("#qr-canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      return reject(new Error("Could not get canvas context"));
    }

    const img = new Image();

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src); // Clean up memory

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        try {
          const otpParameters = await getOtpParametersFromUrl(code.data);
          resolve(otpParameters);
        } catch (error) {
          console.error("Error decoding QR code data:", error);
          reject(
            new Error(
              "QR code is invalid or not a Google Authenticator export."
            )
          );
        }
      } else {
        // Resolve with null if no QR code is found in this image.
        resolve(null);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(img.src); // Clean up memory
      reject(new Error("File does not appear to be an image."));
    };

    img.src = URL.createObjectURL(file);
  });
}

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
    const button = target.closest<HTMLButtonElement>(".faq-button");

    if (!button) return;

    const faqItem = button.closest<HTMLDivElement>(".faq-item");
    if (!faqItem) return;

    const isCurrentlyExpanded = faqItem.classList.contains("open");

    // Close all other open items
    faqContainer
      .querySelectorAll<HTMLDivElement>(".faq-item.open")
      .forEach((openItem) => {
        if (openItem !== faqItem) {
          openItem.classList.remove("open");
          const otherButton =
            openItem.querySelector<HTMLButtonElement>(".faq-button");
          if (otherButton) {
            otherButton.setAttribute("aria-expanded", "false");
          }
        }
      });

    // Toggle the clicked item's state
    if (isCurrentlyExpanded) {
      faqItem.classList.remove("open");
      button.setAttribute("aria-expanded", "false");
    } else {
      faqItem.classList.add("open");
      button.setAttribute("aria-expanded", "true");
    }
  });
}

function base64ToUint8Array(base64: string): Uint8Array {
  const base64Fixed = base64.replace(/ /g, "+");
  const binaryString = atob(base64Fixed);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function displayResults(otpParameters: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>("#results-container");
  const exportContainer = $<HTMLDivElement>("#export-container");

  // Clear any previous results (including error messages) before rendering.
  resultsContainer.innerHTML = "";
  if (!otpParameters || otpParameters.length === 0) {
    resultsContainer.textContent =
      "No OTP secrets found in the provided images.";
    exportContainer.style.display = "none";
    return;
  }

  exportContainer.style.display = "block";

  const fragment = document.createDocumentFragment();
  otpParameters.forEach((otp, index) => {
    const { cardElement } = createOtpCard(otp, index);
    fragment.appendChild(cardElement);
  });
  resultsContainer.appendChild(fragment);
}

/**
 * Creates an HTML element for a single OTP entry.
 * This acts like a component, encapsulating the logic and structure for a card.
 */
function createOtpCard(
  otp: MigrationOtpParameter,
  index: number
): { cardElement: HTMLDivElement; exportData: OtpData } {
  const secretText = encode(otp.secret);
  const issuerText = otp.issuer || "N/A";
  const accountName = otp.name || "N/A";
  const typeText = otp.type === 2 ? "totp" : "hotp"; // Convert type code to string

  // Construct the label for display and the otpauth URL.
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

  const exportData: OtpData = {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || "",
    type: typeText,
    counter: typeText === "hotp" ? otp.counter || 0 : "",
    url: decodeURIComponent(otpAuthUrl), // Store the human-readable URL
  };

  const cardElement = document.createElement("div");
  cardElement.className = "otp-card otp-card-layout";
  cardElement.id = `otp-card-${index}`;

  const qrCodeCanvas = document.createElement("canvas");
  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
    width: 220,
    margin: 1,
    color: { light: "#0000" },
  });

  const qrCodeContainer = document.createElement("div");
  qrCodeContainer.className = "qr-code-container";
  qrCodeContainer.appendChild(qrCodeCanvas);

  const otpDetails = document.createElement("div");
  otpDetails.className = "otp-details";
  otpDetails.innerHTML = `
      <h3>${index + 1}. ${issuerText}: ${accountName}</h3>
      <p><span class="label">Name:</span> ${accountName}</p>
      <p><span class="label">Issuer:</span> ${issuerText}</p>
      <p><span class="label">Type:</span> ${typeText}</p>
      <p class="secret-row">
          <span class="label">Secret:</span>
          <span class="secret-container">
              <input type="text" class="text-input secret-input" value="${secretText}" readonly>
              <button class="copy-button" aria-label="Copy secret">
                  <i class="fa fa-copy"></i>
              </button>
          </span>
      </p>
      <p class="otp-url-row">
          <span class="label">URL: </span>
          <span class="otp-url-container">
              <input type="text" class="text-input url-input" value="${decodeURIComponent(
                otpAuthUrl
              )}" readonly>
              <button class="copy-button" data-copy-text="${otpAuthUrl}" aria-label="Copy URL">
                  <i class="fa fa-copy"></i>
              </button>
          </span>
      </p>
  `;

  otpDetails.addEventListener("click", (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches(".text-input, .copy-button, .copy-button i")) {
      handleCopy(event);
    }
  });
  cardElement.appendChild(otpDetails);
  cardElement.appendChild(qrCodeContainer);

  return { cardElement, exportData };
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
  logItem.scrollIntoView({ behavior: "smooth", block: "nearest" });
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

/** Create a unique key for an OTP parameter to check for duplicates. */
function getOtpUniqueKey(otp: MigrationOtpParameter): string {
  const secretText = encode(otp.secret);
  // A combination of issuer, name, and secret should be unique enough.
  // Type is included for safety, though it's unlikely to differ for the same secret.
  return `${otp.issuer}:${otp.name}:${otp.type}:${secretText}`;
}

async function processFiles(files: FileList | null): Promise<void> {
  if (!files || files.length === 0) return;

  const fileArray = Array.from(files);

  try {
    const logContainer = $<HTMLDivElement>("#upload-log-container");

    if (logContainer.style.display === "none") {
      logContainer.style.display = "block";
    }

    const firstNewIndex = extractedOtps.length;
    const newlyAddedOtps: MigrationOtpParameter[] = [];
    let anyDuplicatesOrErrors = false;

    // This set will contain keys from previously extracted OTPs AND OTPs from the current batch.
    const existingAndBatchKeys = new Set(extractedOtps.map(getOtpUniqueKey));

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
      extractedOtps.push(...newlyAddedOtps);
      displayResults(extractedOtps);

      const firstNewCard = document.getElementById(`otp-card-${firstNewIndex}`);
      if (!anyDuplicatesOrErrors && firstNewCard) {
        firstNewCard.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }
  } catch (error: any) {
    displayError(
      error.message || "An unexpected error occurred while processing files."
    );
  }
}

const handleCopy = (event: MouseEvent) => {
  const triggerElement = event.target as HTMLElement;

  const container = triggerElement.closest(
    ".secret-container, .otp-url-container"
  );
  if (!container) {
    return;
  }

  const input = container.querySelector<HTMLInputElement>(".text-input");
  const button = container.querySelector<HTMLButtonElement>(".copy-button");
  if (!input || !button) {
    return;
  }

  const textToCopy = triggerElement.matches(".copy-button, .copy-button i")
    ? button.dataset.copyText || input.value
    : input.value;

  input.select();

  copyToClipboard(textToCopy, button);
};

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

function downloadAsCsv(): void {
  if (extractedOtps.length === 0) {
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

  const otpDataForCsv = extractedOtps.map(convertToOtpData);
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
  const { exportData } = createOtpCard(otp, 0); // index doesn't matter here
  return exportData;
}

/**
 * Initializes the application by setting up all event listeners.
 * This function is called once the DOM is fully loaded.
 */
function initializeApp(): void {
  setupTabs();
  setupAccordion();

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
    extractedOtps = [];
    qrInput.value = ""; // Reset file input so the same files can be re-selected
  });

  // --- Drag and Drop Event Listeners ---
  const fileDropZone = $<HTMLDivElement>(".file-input-wrapper");

  function preventDefaults(e: Event): void {
    e.preventDefault();
    e.stopPropagation();
  }

  // Prevent default drag behaviors on the drop zone and the body.
  ["dragenter", "dragover", "dragleave", "drop"].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, preventDefaults);
    document.body.addEventListener(eventName, preventDefaults);
  });

  // Add a visual indicator when a file is dragged over the drop zone.
  ["dragenter", "dragover"].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, () =>
      fileDropZone.classList.add("active")
    );
  });

  // Remove the visual indicator when the file leaves the drop zone.
  ["dragleave", "drop"].forEach((eventName) => {
    fileDropZone.addEventListener(eventName, () =>
      fileDropZone.classList.remove("active")
    );
  });

  // Handle the dropped files.
  fileDropZone.addEventListener("drop", (event: DragEvent) => {
    processFiles(event.dataTransfer?.files ?? null);
  });
}

// Initialize the application once the DOM is ready.
document.addEventListener("DOMContentLoaded", initializeApp);
