import jsQR from 'jsqr';
import protobuf from 'protobufjs';
import { encode } from 'thirty-two';
import { Buffer } from 'buffer'; // Keep for browser environment polyfill
import QRCode from 'qrcode';
import { OtpData } from './types';


// Define a more specific type for the raw OTP data from the protobuf payload.
interface MigrationOtpParameter {
  secret: Uint8Array;
  name: string;
  issuer: string;
  algorithm: number; // ALGORITHM_UNSPECIFIED (0), SHA1 (1)
  digits: number;    // DIGITS_UNSPECIFIED (0), SIX (1), EIGHT (2)
  type: number;      // TYPE_UNSPECIFIED (0), HOTP (1), TOTP (2)
  counter: number;
}

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.
let extractedOtps: MigrationOtpParameter[] = []; // To store data for CSV export

// Pre-load the protobuf definition once for better performance.
const protobufRoot = protobuf.load('google_auth.proto');

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
async function getOtpParametersFromUrl(otpUrl: string): Promise<MigrationOtpParameter[]> {
    const url = new URL(otpUrl);
    const dataBase64 = url.searchParams.get('data');
    if (!dataBase64) {
        throw new Error('Invalid OTP URL: Missing "data" parameter.');
    }

    const data = base64ToUint8Array(dataBase64);

    const root = await protobufRoot;
    const MigrationPayload = root.lookupType('MigrationPayload');

    const payload = MigrationPayload.decode(data) as unknown as { otpParameters: MigrationOtpParameter[] };
    return payload.otpParameters;
}

/**
 * Processes a single image file, extracts QR code data, and returns OTP parameters.
 * @param file The image file to process.
 * @returns A promise that resolves with an array of OTP parameters, or an empty array if no QR code is found.
 */
function processImage(file: File): Promise<MigrationOtpParameter[]> {
    return new Promise((resolve, reject) => {
        const canvas = $<HTMLCanvasElement>('#qr-canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return reject(new Error('Could not get canvas context'));
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
                    reject(error);
                }
            } else {
                // Resolve with an empty array if no QR code is found in this image.
                // This prevents a single failed image from stopping the entire batch.
                resolve([]);
            }
        };

        img.onerror = () => {
            URL.revokeObjectURL(img.src); // Clean up memory
            reject(new Error(`Failed to load image: ${file.name}`));
        };

        img.src = URL.createObjectURL(file);
    });
}

document.querySelectorAll('.accordion-button').forEach((button) => {
  button.addEventListener('click', () => button.parentElement?.classList.toggle('active'));
});


function base64ToUint8Array(base64: string): Uint8Array {
  const base64Fixed = base64.replace(/ /g, '+');
  const binaryString = atob(base64Fixed);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function displayResults(otpParameters: MigrationOtpParameter[]): void {
  const resultsContainer = $<HTMLDivElement>('#results-container');
  const exportContainer = $<HTMLDivElement>('#export-container');
  
  // Clear any previous results (including error messages) before rendering.
  resultsContainer.innerHTML = '';
  if (!otpParameters || otpParameters.length === 0) {
    resultsContainer.textContent = 'No OTP secrets found in the provided images.';
    exportContainer.style.display = 'none';
    return;
  }

  exportContainer.style.display = 'block';

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
function createOtpCard(otp: MigrationOtpParameter, index: number): { cardElement: HTMLDivElement, exportData: OtpData } {
  const secretText = encode(otp.secret);
  const issuerText = otp.issuer || 'N/A';
  const accountName = otp.name || 'N/A'; // More descriptive name
  const typeText = otp.type === 2 ? 'totp' : 'hotp'; // Convert type code to string

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
  if (typeText === 'hotp') {
    otpAuthUrl += `&counter=${otp.counter || 0}`;
  }

  const exportData: OtpData = {
    name: accountName,
    secret: secretText,
    issuer: otp.issuer || '',
    type: typeText,
    counter: typeText === 'hotp' ? (otp.counter || 0) : '',
    url: decodeURIComponent(otpAuthUrl), // Store the human-readable URL
  };

  const cardElement = document.createElement('div');
  cardElement.className = 'otp-card otp-card-layout';
  cardElement.id = `otp-card-${index}`;

  const qrCodeCanvas = document.createElement('canvas');
  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, { width: 220, margin: 1, color: { light: '#0000' } });

  const qrCodeContainer = document.createElement('div');
  qrCodeContainer.className = 'qr-code-container';
  qrCodeContainer.appendChild(qrCodeCanvas);

  const otpDetails = document.createElement('div');
  otpDetails.className = 'otp-details';
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
              <input type="text" class="text-input url-input" value="${decodeURIComponent(otpAuthUrl)}" readonly>
              <button class="copy-button" data-copy-text="${otpAuthUrl}" aria-label="Copy URL">
                  <i class="fa fa-copy"></i>
              </button>
          </span>
      </p>
  `;


  otpDetails.addEventListener('click', (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.matches('.text-input, .copy-button, .copy-button i')) {
        handleCopy(event);
    }
  });
  cardElement.appendChild(otpDetails);
  cardElement.appendChild(qrCodeContainer);

  return { cardElement, exportData };
}

function displayError(message: string, duration = 5000): void {
  const errorContainer = $<HTMLDivElement>('#error-message-container');

  // To prevent multiple error messages from stacking, remove any existing one.
  const existingError = errorContainer.querySelector('.error-message');
  if (existingError) {
    existingError.remove();
  }

  const errorElement = document.createElement('div');
  errorElement.className = 'error-message';
  errorElement.textContent = message;

  // Prepend the error message so it appears at the top.
  errorContainer.prepend(errorElement);

  // Set a timeout to make the error message disappear.
  setTimeout(() => {
    // Add a class to trigger the fade-out animation.
    errorElement.classList.add('fade-out');
    // After the animation, remove the element from the DOM.
    errorElement.addEventListener('transitionend', () => errorElement.remove());
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
    const otpParamPromises = fileArray.map(file =>
      processImage(file).catch(error => {
        console.error(`Error processing file ${file.name}:`, error);
        displayError(`Failed to process image: ${file.name}. It might not be a valid QR code image.`);
        return null;
      })
    );

    const allOtpParametersNested = await Promise.all(otpParamPromises);
    const newOtpParametersRaw = allOtpParametersNested.filter((p): p is MigrationOtpParameter[] => p !== null).flat();

    if (newOtpParametersRaw.length === 0) {
      // An error for a specific file might have been already shown.
      // If not, we show a generic one.
      if (allOtpParametersNested.every(p => p !== null)) {
        displayError('No QR codes with OTP secrets found in the selected file(s).');
      }
      return;
    }

    const existingOtpKeys = new Set(extractedOtps.map(getOtpUniqueKey));
    
    // New Set to track keys in the current batch.
    const uniqueNewParams = new Map<string, MigrationOtpParameter>();

    let currentDuplicateCount = 0;
    for (const otp of newOtpParametersRaw) {
        const key = getOtpUniqueKey(otp);
        // Add to map if it's not a duplicate from existing list or from this new batch
        if (!existingOtpKeys.has(key) && !uniqueNewParams.has(key)) {
            uniqueNewParams.set(key, otp);
        } else {
            currentDuplicateCount++;
        }
    }

    const nonDuplicateOtpParameters = Array.from(uniqueNewParams.values());
    const duplicateCount = currentDuplicateCount;

    if (duplicateCount > 0) {
      // If there were duplicates in the current batch, display an error.
      // If no unique non duplicate params were extracted, and no other errors were displayed, then show the "all duplicates" message.
      // Otherwise show that some entries were ignored.
      // This works since we display the error *after* the error relating to file processing, if any.

      if (nonDuplicateOtpParameters.length === 0) {
        displayError('All OTP secrets from the image(s) are already in the list.');
        console.log('No new OTP secrets to add.')
      } else {
        const plural = duplicateCount > 1 ? 's' : '';
        displayError(`Ignored ${duplicateCount} duplicate OTP secret${plural}.`);
        console.log(`Ignored duplicate(s).`)
      }
    }


    if (nonDuplicateOtpParameters.length > 0) {
      const firstNewIndex = extractedOtps.length;
      extractedOtps.push(...nonDuplicateOtpParameters);
      displayResults(extractedOtps);

      const firstNewCard = document.getElementById(`otp-card-${firstNewIndex}`);
      if (currentDuplicateCount > 0) {
        return; // don't scroll down if duplicates occured.
      }
      if (firstNewCard) {
        firstNewCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }

  } catch (error: any) {
    displayError(error.message || 'An unexpected error occurred while processing files.');
    }
  }

const handleCopy = (event: MouseEvent) => {
  const triggerElement = event.target as HTMLElement;

  const container = triggerElement.closest('.secret-container, .otp-url-container');
  if (!container) {
    return;
  }

  const input = container.querySelector<HTMLInputElement>('.text-input');
  const button = container.querySelector<HTMLButtonElement>('.copy-button');
  if (!input || !button) {
        return;
  }

  const textToCopy = triggerElement.matches('.copy-button, .copy-button i')
    ? button.dataset.copyText || input.value
    : input.value;


  input.select();

  copyToClipboard(textToCopy, button);
};

const copyToClipboard = (text: string, buttonElement: HTMLElement): void => {
  navigator.clipboard.writeText(text)
    .then(() => {
      buttonElement.classList.add('copied');
      setTimeout(() => buttonElement.classList.remove('copied'), 1500);
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
};

function downloadAsCsv(): void {
  if (extractedOtps.length === 0) {
    alert('No data to export.');
    return;
  }

  const headers: (keyof OtpData)[] = ['name', 'secret', 'issuer', 'type', 'counter', 'url'];

  const escapeCsvField = (field: any): string => {
    const str = String(field ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const otpDataForCsv = extractedOtps.map(convertToOtpData);
  const csvRows = [
    headers.join(','),
    ...otpDataForCsv.map(otp =>
      headers.map(header => escapeCsvField(otp[header])).join(',')
    )
  ];

  const csvString = csvRows.join('\n');
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'otp_secrets.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function convertToOtpData(otp: MigrationOtpParameter): OtpData {
  const { exportData } = createOtpCard(otp, 0); // index doesn't matter here
  return exportData;
}

// --- Event Listeners ---

// Listen for file input changes
$<HTMLInputElement>('#qr-input').addEventListener('change', (event: Event) => {
  processFiles((event.target as HTMLInputElement).files);
});
// Listen for CSV download button clicks
$<HTMLButtonElement>('#download-csv-button').addEventListener('click', downloadAsCsv);

// Listen for Clear All button clicks
$<HTMLButtonElement>('#clear-button').addEventListener('click', () => {
    const resultsContainer = $<HTMLDivElement>('#results-container');
  const exportContainer = $<HTMLDivElement>('#export-container');
  const qrInput = $<HTMLInputElement>('#qr-input');
  resultsContainer.innerHTML = '';
  exportContainer.style.display = 'none';
  extractedOtps = [];
  qrInput.value = ''; // Reset file input so the same files can be re-selected
});

// --- Drag and Drop Event Listeners ---
const fileDropZone = $<HTMLDivElement>('.file-input-wrapper');

function preventDefaults(e: Event): void {
  e.preventDefault();
  e.stopPropagation();
}

// Prevent default drag behaviors on the drop zone and the body.
// This is necessary to allow for a drop.
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
  fileDropZone.addEventListener(eventName, preventDefaults, false);
  document.body.addEventListener(eventName, preventDefaults, false);
});

// Add a visual indicator when a file is dragged over the drop zone.
['dragenter', 'dragover'].forEach(eventName => {
  fileDropZone.addEventListener(eventName, () => fileDropZone.classList.add('active'), false);
});

// Remove the visual indicator when the file leaves the drop zone.
['dragleave', 'drop'].forEach(eventName => {
  fileDropZone.addEventListener(eventName, () => fileDropZone.classList.remove('active'), false);
});

// Handle the dropped files.
fileDropZone.addEventListener('drop', (event: DragEvent) => {
  processFiles(event.dataTransfer?.files ?? null);
}, false);