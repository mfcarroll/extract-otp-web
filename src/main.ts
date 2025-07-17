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
let extractedOtps: OtpData[] = []; // To store data for CSV export

/** Generic helper to query the DOM and throw an error if the element is not found. */
function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) {
    throw new Error(`Element with selector "${selector}" not found.`);
  }
  return element;
}

async function processImage(file: File): Promise<void> {
  const canvas = $<HTMLCanvasElement>('#qr-canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) return; // The context can still be null

  const img = new Image();

  img.onload = async () => {
    canvas.width = img.width;
    canvas.height = img.height;
    ctx.drawImage(img, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height);

    if (code) {
      const otpUrl = code.data;
      await processOtpUrl(otpUrl);
    } else {
      displayError('No QR code found in the image.');
    }
  };

  img.src = URL.createObjectURL(file);
}

document.querySelectorAll('.accordion-button').forEach((button) => {
  button.addEventListener('click', () => button.parentElement?.classList.toggle('active'));
});

async function processOtpUrl(otpUrl: string): Promise<void> {
  try {
    const url = new URL(otpUrl);
    const dataBase64 = url.searchParams.get('data');
    if (!dataBase64) {
      displayError('Invalid OTP URL: Missing "data" parameter.');
      return;
    }

    const data = base64ToUint8Array(dataBase64);

    // It's often better to load the protobuf definition once and reuse it.
    const root = await protobuf.load('google_auth.proto');
    const MigrationPayload = root.lookupType('MigrationPayload');

    // Decode the payload and assert its type for type safety.
    const payload = MigrationPayload.decode(data) as unknown as { otpParameters: MigrationOtpParameter[] };
    displayResults(payload.otpParameters);

  } catch (error: any) {
    displayError(`Error processing OTP URL: ${error.message}`);
  }
}

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
  resultsContainer.innerHTML = ''; // Clear previous results
  extractedOtps = [];

  if (!otpParameters || otpParameters.length === 0) {
    resultsContainer.textContent = 'No OTP secrets found.';
    exportContainer.style.display = 'none';
    return;
  }

  exportContainer.style.display = 'block';

  const fragment = document.createDocumentFragment();
  otpParameters.forEach((otp, index) => {
    const { cardElement, exportData } = createOtpCard(otp, index);
    extractedOtps.push(exportData);
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
  const nameText = otp.name || 'N/A';
  const typeText = otp.type === 2 ? 'totp' : 'hotp';

  let label = nameText;
  if (otp.issuer) {
    label = `${otp.issuer}:${nameText}`;
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
    name: nameText,
    secret: secretText,
    issuer: otp.issuer || '',
    type: typeText,
    counter: typeText === 'hotp' ? (otp.counter || 0) : '',
    url: otpAuthUrl,
  };

  const cardElement = document.createElement('div');
  cardElement.className = 'otp-card otp-card-layout';

  const qrCodeCanvas = document.createElement('canvas');
  QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, { width: 220, margin: 1, color: { light: '#0000' } });

  const qrCodeContainer = document.createElement('div');
  qrCodeContainer.className = 'qr-code-container';
  qrCodeContainer.appendChild(qrCodeCanvas);

  const otpDetails = document.createElement('div');
  otpDetails.className = 'otp-details';
  otpDetails.innerHTML = `
      <h3>${index + 1}. ${issuerText}: ${nameText}</h3>
      <p><span class="label">Name:</span> ${nameText}</p>
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


  // Use a single event listener on the otpDetails element and use event delegation
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

function displayError(message: string): void {
  const resultsContainer = $<HTMLDivElement>('#results-container');
  const exportContainer = $<HTMLDivElement>('#export-container');
  exportContainer.style.display = 'none';
  resultsContainer.innerHTML = `<p class="error-message">${message}</p>`;
}

$<HTMLInputElement>('#qr-input').addEventListener('change', (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processImage(file);
  }
});

const handleCopy = (event: MouseEvent) => {
  const triggerElement = event.target as HTMLElement;

  // Find the container for the input and button
  const container = triggerElement.closest('.secret-container, .otp-url-container');
  if (!container) {
    return;
  }

  const input = container.querySelector<HTMLInputElement>('.text-input');
  const button = container.querySelector<HTMLButtonElement>('.copy-button');
  if (!input || !button) {
    return;
  }

  // Get text to copy. Prefer data-attribute on button, fallback to input value.
  // This handles the case where the decoded URL in the input is different from the raw URL in data-copy-text.
  const textToCopy = triggerElement.matches('.copy-button, .copy-button i')
    ? button.dataset.copyText || input.value
    : input.value;

  // Select the text in the input field, fulfilling the unification requirement.
  input.select();

  // Copy to clipboard and show tooltip on the button.
  copyToClipboard(textToCopy, button);
};

const copyToClipboard = (text: string, buttonElement: HTMLElement): void => {
  navigator.clipboard.writeText(text)
    .then(() => {
      // Add 'copied' class to the button to show the tooltip
      buttonElement.classList.add('copied');
      setTimeout(() => buttonElement.classList.remove('copied'), 1500);
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
};

$<HTMLButtonElement>('#download-csv-button').addEventListener('click', downloadAsCsv);

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

  const csvRows = [
    headers.join(','),
    ...extractedOtps.map(otp =>
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
