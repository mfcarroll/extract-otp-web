import jsQR from "jsqr";
import protobuf from "protobufjs";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";

// Pre-load the protobuf definition once for better performance.
const protobufRoot = protobuf.load("google_auth.proto");

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
export function processImage(
  file: File
): Promise<MigrationOtpParameter[] | null> {
  return new Promise((resolve, reject) => {
    // The canvas is created on-demand in memory, decoupling this service from the DOM.
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return reject(new Error("Could not get canvas context"));

    const img = new Image();
    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(img.src);

      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);

      if (code) {
        const otpParameters = await getOtpParametersFromUrl(code.data);
        resolve(otpParameters);
      } else {
        resolve(null);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("File is not an image."));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Create a unique key for an OTP parameter to check for duplicates. */
export function getOtpUniqueKey(otp: MigrationOtpParameter): string {
  const secretText = encode(otp.secret);
  return `${otp.issuer}:${otp.name}:${otp.type}:${secretText}`;
}
