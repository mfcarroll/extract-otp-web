import { encode } from "thirty-two";
import { MigrationOtpParameter } from "../types";
import { getOtpParametersFromUrl } from "./otpUrlParser";
import { addUploadLog } from "../ui/notifications";
import { getState, setState } from "../state/store";
import { logger, isDebugEnabled } from "./logger";

import jsQR, { QRCode } from "jsqr";
import pica from "pica";

const TARGET_SIZES = [400, 600, 800, 1000, 1200];
const picaInstance = pica();

/**
 * Opens a new browser tab to display one or more debug canvases.
 * This is used to visually inspect the image processing steps.
 * @param canvases An array of objects, each with a title and a canvas data URL.
 */
function openDebugPreview(
  canvases: { title: string; dataUrl: string; alt: string }[]
): void {
  const newTab = window.open();
  if (!newTab) return;

  const imagesHtml = canvases
    .map(
      (c) => `
    <div>
      <h3>${c.title}</h3>
      <img src="${c.dataUrl}" alt="${c.alt}">
    </div>
  `
    )
    .join("");

  newTab.document.write(`
      <title>Debug Image Preview</title>
      <style>
        body { margin: 0; background: #222; color: #eee; font-family: sans-serif; }
        .container { display: flex; justify-content: center; align-items: flex-start; gap: 2rem; padding: 2rem; }
        h3 { text-align: center; }
        img { border: 2px solid red; max-width: 100%; }
      </style>
      <div class="container">${imagesHtml}</div>
    `);
  newTab.document.close();
}

/**
 * Calculates the bounding box for a QR code location on a canvas, including padding.
 * @param location The location object from jsQR.
 * @param canvasWidth The width of the canvas where the location was found.
 * @param canvasHeight The height of the canvas where the location was found.
 * @returns An object with the x, y, width, and height of the padded bounding box.
 */
function calculateBoundingBox(
  location: QRCode["location"],
  canvasWidth: number,
  canvasHeight: number
): { x: number; y: number; width: number; height: number } {
  const PADDING = 20;
  const loc = location;

  const minX = Math.max(
    0,
    Math.min(loc.topLeftCorner.x, loc.bottomLeftCorner.x) - PADDING
  );
  const minY = Math.max(
    0,
    Math.min(loc.topLeftCorner.y, loc.topRightCorner.y) - PADDING
  );
  const maxX = Math.min(
    canvasWidth,
    Math.max(loc.topRightCorner.x, loc.bottomRightCorner.x) + PADDING
  );
  const maxY = Math.min(
    canvasHeight,
    Math.max(loc.bottomLeftCorner.y, loc.bottomRightCorner.y) + PADDING
  );

  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/**
 * Resizes an ImageBitmap to a new canvas where the smallest dimension matches the target size, preserving aspect ratio.
 * @param imageBitmap The source image.
 * @param targetSize The target size for the smallest dimension.
 * @returns A new canvas containing the resized image and its 2D rendering context.
 */
async function resizeImage(
  imageBitmap: ImageBitmap,
  targetSize: number
): Promise<{ canvas: HTMLCanvasElement; context: CanvasRenderingContext2D }> {
  let { width, height } = imageBitmap;

  // Calculate new dimensions so the smallest dimension matches the target size.
  if (width < height) {
    height = (height / width) * targetSize;
    width = targetSize;
  } else {
    width = (width / height) * targetSize;
    height = targetSize;
  }

  const targetCanvas = document.createElement("canvas");
  targetCanvas.width = Math.round(width);
  targetCanvas.height = Math.round(height);

  // Use the pica library for high-quality, sharp resizing.
  await picaInstance.resize(imageBitmap, targetCanvas, {
    // These options provide a good balance of sharpness and performance for QR codes.
    unsharpAmount: 80,
    unsharpRadius: 0.6,
    unsharpThreshold: 2,
  });

  const context = targetCanvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Could not get target canvas context.");
  return { canvas: targetCanvas, context };
}

/**
 * Creates a new, high-resolution ImageBitmap by cropping the original image
 * based on coordinates found on a smaller, scaled-down version.
 * @param originalBitmap The original, full-resolution source image.
 * @param location The location of the QR code found on the scaled-down canvas.
 * @param scale The ratio used to scale the original image down (e.g., original.width / scaled.width).
 * @returns A promise that resolves with the cropped ImageBitmap.
 */
async function cropOriginalImage(
  originalBitmap: ImageBitmap,
  location: QRCode["location"],
  scale: number
): Promise<ImageBitmap> {
  const locatorCanvasWidth = originalBitmap.width / scale;
  const locatorCanvasHeight = originalBitmap.height / scale;

  const { x, y, width, height } = calculateBoundingBox(
    location,
    locatorCanvasWidth,
    locatorCanvasHeight
  );

  // Scale coordinates back to the original image size
  const sx = x * scale;
  const sy = y * scale;
  const sWidth = width * scale;
  const sHeight = height * scale;

  // Use createImageBitmap to crop from the original high-resolution image
  return createImageBitmap(
    originalBitmap,
    Math.round(sx),
    Math.round(sy),
    Math.round(sWidth),
    Math.round(sHeight)
  );
}

/**
 * Processes a single image file, extracts QR code data, and returns OTP parameters.
 * It uses a multi-pass, variable-resolution scan for maximum robustness.
 * @param file The image file to process.
 * @returns A promise that resolves with an array of OTP parameters, or null if no QR code is found.
 */
export function processImage(
  file: File
): Promise<MigrationOtpParameter[] | null> {
  logger.debug(`[processImage] Starting multi-pass scan for: ${file.name}`);
  return new Promise(async (resolve, reject) => {
    // Helper to process a found QR code and resolve the main promise.
    const processAndResolve = async (qrCode: QRCode) => {
      try {
        const otpParameters = await getOtpParametersFromUrl(qrCode.data);
        resolve(otpParameters);
      } catch (err) {
        logger.error(
          `Failed to process QR code content from ${file.name}. Raw data:`,
          qrCode.data
        );
        reject(err);
      }
    };

    try {
      const originalBitmap = await createImageBitmap(file);
      logger.debug(
        `[processImage] Original image dimensions: ${originalBitmap.width}x${originalBitmap.height}`
      );

      const debugCanvases: { title: string; dataUrl: string; alt: string }[] =
        [];

      // --- Outer loop: Iterate through locator sizes ---
      for (const locatorSize of TARGET_SIZES) {
        logger.debug(
          `[processImage] Starting scan pass for size: ${locatorSize}px`
        );
        const { canvas: locatorCanvas, context: locatorContext } =
          await resizeImage(originalBitmap, locatorSize);

        if (isDebugEnabled) {
          debugCanvases.push({
            title: `Attempted Scan at ${locatorCanvas.width}x${locatorCanvas.height}px`,
            dataUrl: locatorCanvas.toDataURL(),
            alt: `Image resized to ${locatorCanvas.width}x${locatorCanvas.height} for scanning.`,
          });
        }

        const locatorImageData = locatorContext.getImageData(
          0,
          0,
          locatorCanvas.width,
          locatorCanvas.height
        );

        // Perform one scan on the resized image. The result can be used for location or as a fallback.
        const initialScanResult = jsQR(
          locatorImageData.data,
          locatorImageData.width,
          locatorImageData.height
        );

        // Attempt 1: Use locator scan to find QR, then do high-res cropped scan
        if (initialScanResult) {
          logger.debug(
            `[processImage] Found QR location at ${locatorSize}px. Attempting high-res cropped scan.`
          );
          const scale = originalBitmap.width / locatorCanvas.width;
          const croppedBitmap = await cropOriginalImage(
            originalBitmap,
            initialScanResult.location,
            scale
          );

          // Inner loop: Iterate through decoder sizes for the cropped image
          for (const decoderSize of TARGET_SIZES) {
            logger.debug(
              `[processImage] Trying cropped scan at ${decoderSize}px`
            );
            const { canvas: decoderCanvas, context: decoderContext } =
              await resizeImage(croppedBitmap, decoderSize);
            const decoderImageData = decoderContext.getImageData(
              0,
              0,
              decoderCanvas.width,
              decoderCanvas.height
            );

            const code = jsQR(
              decoderImageData.data,
              decoderImageData.width,
              decoderImageData.height
            );
            if (code) {
              logger.debug(
                `[processImage] Success on cropped scan at ${decoderSize}px`
              );
              if (isDebugEnabled) {
                // Draw the detected location on the locator canvas for context
                const { x, y, width, height } = calculateBoundingBox(
                  initialScanResult.location,
                  locatorCanvas.width,
                  locatorCanvas.height
                );

                locatorContext.strokeStyle = "red";
                locatorContext.lineWidth = 5;
                locatorContext.strokeRect(x, y, width, height);

                openDebugPreview([
                  {
                    title: `Locator Scan (${locatorCanvas.width}x${locatorCanvas.height}px)`,
                    dataUrl: locatorCanvas.toDataURL(),
                    alt: "Lower resolution image with detected QR area highlighted in red.",
                  },
                  {
                    title: `Successful Decoder Scan (${decoderCanvas.width}x${decoderCanvas.height}px Cropped)`,
                    dataUrl: decoderCanvas.toDataURL(),
                    alt: "High resolution cropped image sent to the final decoder.",
                  },
                ]);
              }
              await processAndResolve(code);
              return;
            }
          }
        }

        // Attempt 2 (Fallback): If the cropped scan failed, try to use the data from the initial full scan.
        if (initialScanResult) {
          logger.debug(
            `[processImage] Cropped scan failed. Falling back to full image scan at ${locatorSize}px`
          );
          if (isDebugEnabled) {
            openDebugPreview([
              {
                title: `Fallback Full Scan (${locatorCanvas.width}x${locatorCanvas.height}px)`,
                dataUrl: locatorCanvas.toDataURL(),
                alt: `Image resized to ${locatorCanvas.width}x${locatorCanvas.height} that was successfully decoded.`,
              },
            ]);
          }
          await processAndResolve(initialScanResult);
          return;
        }
      }

      // If we get here, no QR code was found after all attempts.
      logger.debug("[processImage] All scan attempts failed.");
      if (isDebugEnabled && debugCanvases.length > 0) {
        openDebugPreview(debugCanvases);
      }
      resolve(null);
    } catch (error) {
      if (error instanceof DOMException && error.name === "SecurityError") {
        reject(
          new Error(
            "Could not process image due to security restrictions (tainted canvas)."
          )
        );
      }
      reject(new Error("File is not a valid image or could not be loaded."));
    }
  });
}

/**
 * Creates a unique and consistent key for an OTP parameter.
 * This key is used to reliably identify and prevent duplicate entries.
 * It's generated by combining the issuer, name, type, and the Base32-encoded secret.
 * @param otp The OTP parameter to generate a key for.
 * @returns A unique string identifier for the OTP.
 */
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
    logger.error(`Error processing QR data from ${sourceName}:`, error);
    logger.error(
      `Failed to process QR code content from ${sourceName}. Raw data:`,
      qrCodeData
    );
    addUploadLog(sourceName, "error", message);
  }
}
