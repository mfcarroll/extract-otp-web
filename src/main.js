import jsQR from 'jsqr';
import protobuf from 'protobufjs';
import { encode } from 'thirty-two';
import { Buffer } from 'buffer';
window.Buffer = Buffer;  // Make Buffer globally available

async function processImage(file) {
  const canvas = document.getElementById('qr-canvas');
  const ctx = canvas.getContext('2d');
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
  button.addEventListener('click', () => button.parentNode.classList.toggle('active'));
});

async function processOtpUrl(otpUrl) {
  try {
    const url = new URL(otpUrl);
    const dataBase64 = url.searchParams.get('data');
    if (!dataBase64) {
      displayError('Invalid OTP URL: Missing "data" parameter.');
      return;
    }

    const data = base64ToUint8Array(dataBase64);

    const root = await protobuf.load('/google_auth.proto'); // Assuming proto file in public directory
    const MigrationPayload = root.lookupType('MigrationPayload');

    const payload = MigrationPayload.decode(data);
    displayResults(payload.otpParameters);

  } catch (error) {
    displayError(`Error processing OTP URL: ${error.message}`);
  }
}

function base64ToUint8Array(base64) {
  const base64Fixed = base64.replace(/ /g, '+');
  const binaryString = atob(base64Fixed);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

function displayResults(otpParameters) {
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.innerHTML = ''; // Clear previous results

  if (!otpParameters || otpParameters.length === 0) {
    resultsContainer.textContent = 'No OTP secrets found.';
    return;
  }

  otpParameters.forEach((otp, index) => {
    const otpCard = document.createElement('div');
    otpCard.className = 'otp-card';

    // Use textContent to prevent XSS, although the source is trusted here, it's good practice.
    const name = document.createTextNode(otp.name);
    const secret = document.createTextNode(encode(otp.secret));
    const issuer = document.createTextNode(otp.issuer || 'N/A');
    const type = document.createTextNode(otp.type === 2 ? 'totp' : 'hotp');

    otpCard.innerHTML = `
      <h3>Secret ${index + 1}</h3>
      <p><span class="label">Name:</span> ${name.textContent}</p>
      <p><span class="label">Issuer:</span> ${issuer.textContent}</p>
      <p><span class="label">Secret:</span> <span class="secret">${secret.textContent}</span></p>
      <p><span class="label">Type:</span> ${type.textContent}</p>
    `;
    resultsContainer.appendChild(otpCard);
  });
}

function displayError(message) {
  const resultsContainer = document.getElementById('results-container');
  resultsContainer.innerHTML = `<p class="error-message">${message}</p>`;
}



document.getElementById('qr-input').addEventListener('change', (event) => {
  const file = event.target.files[0];
  if (file) {
    processImage(file);
  }
});
