import jsQR from "jsqr";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { getOtpParametersFromUrl } from "./otpUrlParser";

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
        console.log("Raw QR Code Data:\n`" + code.data + "`");
        try {
          const otpParameters = await getOtpParametersFromUrl(code.data);
          resolve(otpParameters);
        } catch (error) {
          // Re-throw the original error to preserve the specific message
          // (e.g., for LastPass incompatibility) so it can be displayed
          // in the UI log.
          reject(error);
        }
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
  const secretText = encode(otp.secret).toString();
  return `${otp.issuer}:${otp.name}:${otp.type}:${secretText}`;
}
