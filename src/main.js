import jsQR from 'jsqr';
import protobuf from 'protobufjs';
import { encode } from 'thirty-two';
import { Buffer } from 'buffer';
import QRCode from 'qrcode';

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

    // Construct the otpauth URL label and parameters according to spec.
    // The label should be 'Issuer:Account' if an issuer is present.
    let label = otp.name;
    if (otp.issuer) {
      label = `${otp.issuer}:${otp.name}`;
    }
    const encodedLabel = encodeURIComponent(label);

    const otpType = otp.type === 2 ? 'totp' : 'hotp';
    let otpAuthUrl = `otpauth://${otpType}/${encodedLabel}?secret=${secret.textContent}`;
    if (otp.issuer) {
      otpAuthUrl += `&issuer=${encodeURIComponent(otp.issuer)}`;
    }
    if (otpType === 'hotp') {
        // HOTP requires an initial counter value.  If not provided in the protobuf, default to 0.
        // You might need to adjust this default based on your application's needs.
        otpAuthUrl += `&counter=${otp.counter || 0}`;
    }

    // Create a decoded version for display, but keep the original for QR/copy.
    const displayOtpAuthUrl = decodeURIComponent(otpAuthUrl);

    const qrCodeCanvas = document.createElement('canvas');

    // Generate QR code with transparent background, larger size,
    // and a quiet zone.
    const qrSize = 220; // Increased size
    QRCode.toCanvas(qrCodeCanvas, otpAuthUrl, {
      width: qrSize,
      margin: 1,
      // Setting the background color to transparent
      // Using a 4-digit hex code which represents #RGBA.
      // #0000 is fully transparent.
      // This makes the styling and visual appearance a bit nicer.
      // See https://www.npmjs.com/package/qrcode#options
      color: {
        light: '#0000' // Sets the background to be transparent (#RGBA).
      }
    });

    const otpDetails = document.createElement('div');
    otpDetails.innerHTML = `
        <p><span class="label">Name:</span> ${name.textContent}</p>
        <p><span class="label">Issuer:</span> ${issuer.textContent}</p>
        <p><span class="label">Type:</span> ${type.textContent}</p>
        <p class="secret-row"><span class="label">Secret:</span>
            <span class="secret-container">

                <input type="text" class="text-input secret-input" value="${secret.textContent}" readonly>
                <button class="copy-button" onclick="copyToClipboard('${secret.textContent}')">                
                    <i class="fa fa-copy"></i>
                </button>
            </span>
        </p>
        <p class="otp-url-row"><span class="label">URL:</span>
            <span class="otp-url-container">
                <input type="text" class="text-input url-input" value="${displayOtpAuthUrl}" readonly>
                <button class="copy-button" onclick="copyToClipboard('${otpAuthUrl}')">
                    <i class="fa fa-copy"></i>
                </button>
            </span>
        </p>
    `;

    const qrCodeContainer = document.createElement('div');
    qrCodeContainer.appendChild(qrCodeCanvas);
    // Float the QR code to the right
    qrCodeContainer.style.float = 'right';
    qrCodeContainer.style.marginLeft = '20px';

    otpCard.classList.add('otp-card-layout');

    otpCard.appendChild(qrCodeContainer);
    otpCard.appendChild(otpDetails);

    const heading = document.createElement('h3');
    heading.textContent = `${index + 1}. ${issuer.textContent}: ${name.textContent}`;
    otpDetails.prepend(heading);

    resultsContainer.appendChild(otpCard);
  });
  window.copyToClipboard = copyToClipboard;

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

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => {
      // Find the button that was clicked (it's the active element)
      const button = document.activeElement;
      button.classList.add('copied');
      setTimeout(() => button.classList.remove('copied'), 1500); // Remove after 1.5 seconds
    })
    .catch(err => {
      console.error('Could not copy text: ', err);
    });
}
