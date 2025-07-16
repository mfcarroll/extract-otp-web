import jsQR from 'jsqr';
import protobuf from 'protobufjs';
import { encode } from 'thirty-two';
import { Buffer } from 'buffer';
import QRCode from 'qrcode';
import type { OtpData } from './types';

window.Buffer = Buffer;  // Make Buffer globally available
let extractedOtps: OtpData[] = []; // To store data for CSV export

async function processImage(file: File): Promise<void> {
  const canvas = document.getElementById('qr-canvas') as HTMLCanvasElement;
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

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

    const root = await protobuf.load('google_auth.proto');
    const MigrationPayload = root.lookupType('MigrationPayload');

    // Casting to `any` because the decoded payload structure is dynamic.
    const payload: any = MigrationPayload.decode(data);
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

function displayResults(otpParameters: any[]): void {
  const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
  const exportContainer = document.getElementById('export-container') as HTMLDivElement;
  resultsContainer.innerHTML = ''; // Clear previous results
  extractedOtps = []; // Clear previous extracted data

  if (!otpParameters || otpParameters.length === 0) {
    resultsContainer.textContent = 'No OTP secrets found.';
    exportContainer.style.display = 'none';
    return;
  }

  exportContainer.style.display = 'block';

  otpParameters.forEach((otp: any, index: number) => {
    const otpCard = document.createElement('div');
    otpCard.className = 'otp-card';

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

    const otpForExport: OtpData = {
      name: nameText,
      secret: secretText,
      issuer: otp.issuer || '',
      type: typeText,
      counter: typeText === 'hotp' ? (otp.counter || 0) : '',
      url: otpAuthUrl,
    };
    extractedOtps.push(otpForExport);

    const displayOtpAuthUrl = decodeURIComponent(otpAuthUrl);
    const qrCodeCanvas = document.createElement('canvas');

    const qrSize = 220;
    QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
      width: qrSize,
      margin: 1,
      color: {
        light: '#0000' // Transparent background
      }
    });

    const otpDetails = document.createElement('div');
    otpDetails.innerHTML = `
        <p><span class="label">Name:</span> ${nameText}</p>
        <p><span class="label">Issuer:</span> ${issuerText}</p>
        <p><span class="label">Type:</span> ${typeText}</p>
        <p class="secret-row"><span class="label">Secret:</span>
            <span class="secret-container">
                <input type="text" class="text-input secret-input" value="${secretText}" readonly>
                <button class="copy-button" data-copy-text="${secretText}">
                    <i class="fa fa-copy"></i>
                </button>
            </span>
        </p>
        <p class="otp-url-row"><span class="label">URL: </span>
            <span class="otp-url-container">
                <input type="text" class="text-input url-input" value="${displayOtpAuthUrl}" readonly>
                <button class="copy-button" data-copy-text="${otpAuthUrl}">
                    <i class="fa fa-copy"></i>
                </button>
            </span>
        </p>
    `;

    const qrCodeContainer = document.createElement('div');
    qrCodeContainer.appendChild(qrCodeCanvas);
    qrCodeContainer.style.float = 'right';
    qrCodeContainer.style.marginLeft = '20px';

    otpCard.classList.add('otp-card-layout');
    otpCard.appendChild(qrCodeContainer);
    otpCard.appendChild(otpDetails);

    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${issuerText}: ${nameText}`;
    otpDetails.prepend(heading);

    resultsContainer.appendChild(otpCard);
  });

  document.querySelectorAll<HTMLButtonElement>('#results-container .copy-button').forEach(button => {
    button.addEventListener('click', () => {
      const textToCopy = button.dataset.copyText;
      if (textToCopy) {
        copyToClipboard(textToCopy);
      }
    });
  });
}

function displayError(message: string): void {
  const resultsContainer = document.getElementById('results-container') as HTMLDivElement;
  const exportContainer = document.getElementById('export-container') as HTMLDivElement;
  exportContainer.style.display = 'none';
  resultsContainer.innerHTML = `<p class="error-message">${message}</p>`;
}

document.getElementById('qr-input')?.addEventListener('change', (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];
  if (file) {
    processImage(file);
  }
});

function copyToClipboard(text: string): void {
  navigator.clipboard.writeText(text)
    .then(() => {
      const button = document.activeElement as HTMLElement;
      if (button?.classList.contains('copy-button')) {
        button.classList.add('copied');
        setTimeout(() => button.classList.remove('copied'), 1500);
      }
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
}

document.getElementById('download-csv-button')?.addEventListener('click', downloadAsCsv);

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