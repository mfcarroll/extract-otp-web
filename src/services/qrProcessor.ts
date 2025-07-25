import jsQR from "jsqr";
import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { getOtpParametersFromUrl } from "./otpUrlParser";
import { addUploadLog } from "../ui/notifications";
import { getState, setState } from "../state/store";

/**
 * Processes a single image file, extracts QR code data, and returns OTP parameters.
 * This function is intended for batch processing where state is managed by the caller.
 * @param file The image file to process.
 * @returns A promise that resolves with an array of OTP parameters, or null if no QR code is found.
 */
export function processImage(
  file: File
): Promise<MigrationOtpParameter[] | null> {
  return new Promise((resolve, reject) => {
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
          console.error(
            `Failed to process QR code content from ${file.name}. Raw data:`,
            code.data
          );
          // Re-throw the original error to preserve the specific message
          // so it can be displayed in the UI log.
          reject(error);
        }
      } else {
        resolve(null); // Explicitly resolve with null when no QR code is found
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(img.src);
      reject(new Error("File is not a valid image."));
    };
    img.src = URL.createObjectURL(file);
  });
}

/** Create a unique key for an OTP parameter to check for duplicates. */
export function getOtpUniqueKey(otp: MigrationOtpParameter): string {
  const secretText = encode(otp.secret).toString();
  return `${otp.issuer}:${otp.name}:${otp.type}:${secretText}`;
}

/**
 * Filters a list of OTP parameters against a set of existing keys,
 * logs the outcome, and returns the new unique parameters.
 * @param otpParameters The list of OTP parameters to process.
 * @param existingKeys A Set of unique keys for existing OTPs. This set will be mutated.
 * @param sourceName A descriptive name for the source (e.g., a filename).
 * @returns An object containing the new OTPs and the number of duplicates found.
 */
export function filterAndLogOtps(
  otpParameters: MigrationOtpParameter[],
  existingKeys: Set<string>,
  sourceName: string
): { newOtps: MigrationOtpParameter[]; duplicatesFound: number } {
  const newOtps: MigrationOtpParameter[] = [];
  let duplicatesFound = 0;

  for (const otp of otpParameters) {
    const key = getOtpUniqueKey(otp);
    if (existingKeys.has(key)) {
      duplicatesFound++;
    } else {
      newOtps.push(otp);
      existingKeys.add(key); // Add to set to handle duplicates within the same batch
    }
  }

  if (newOtps.length > 0) {
    const plural = newOtps.length > 1 ? "s" : "";
    addUploadLog(
      sourceName,
      "success",
      `${newOtps.length} secret${plural} extracted.`
    );
  }

  if (duplicatesFound > 0) {
    const plural = duplicatesFound > 1 ? "s" : "";
    addUploadLog(
      sourceName,
      "warning",
      `${duplicatesFound} duplicate secret${plural} skipped.`
    );
  }

  return { newOtps, duplicatesFound };
}

/**
 * Centralized function to process a decoded QR code string from a single source (like a camera scan).
 * It handles parsing, duplicate checking, logging, and state updates.
 * @param qrCodeData The raw string data from a QR code.
 * @param sourceName A descriptive name for the source (e.g., "Camera Scan").
 */
export async function processDecodedQrCodeString(
  qrCodeData: string,
  sourceName: string
): Promise<void> {
  try {
    const otpParameters = await getOtpParametersFromUrl(qrCodeData);

    if (!otpParameters || otpParameters.length === 0) {
      addUploadLog(sourceName, "info", "No OTP secrets found in QR code.");
      return;
    }

    const existingKeys = new Set(getState().otps.map(getOtpUniqueKey));
    const { newOtps } = filterAndLogOtps(
      otpParameters,
      existingKeys,
      sourceName
    );

    if (newOtps.length > 0) {
      setState((currentState) => ({
        otps: [...currentState.otps, ...newOtps],
      }));
    }
  } catch (error: any) {
    const message =
      (error instanceof Error ? error.message : String(error)) ||
      "An unknown error occurred.";
    console.error(`Error processing QR data from ${sourceName}:`, error);
    console.error(
      `Failed to process QR code content from ${sourceName}. Raw data:`,
      qrCodeData
    );
    addUploadLog(sourceName, "error", message);
  }
}
