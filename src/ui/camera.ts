import jsQR from "jsqr";
import { $ } from "./dom";
import { processDecodedQrCodeString } from "../services/qrProcessor";
import { displayError, announceToScreenReader } from "./notifications";
import { logger } from "../services/logger";

// DOM Elements
let video: HTMLVideoElement;
let canvas: HTMLCanvasElement;
let canvasContext: CanvasRenderingContext2D;
let cameraModal: HTMLDivElement;
let takePhotoButton: HTMLButtonElement;
let cancelButton: HTMLButtonElement;

let stream: MediaStream | null = null;
let animationFrameId: number | null = null;
let elementThatOpenedModal: HTMLElement | null = null;

/**
 * Handles keydown events within the camera modal for accessibility.
 * - Closes the modal on 'Escape'.
 * - Traps focus within the modal.
 * @param event The keyboard event.
 */
function handleCameraModalKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") {
    event.stopPropagation();
    closeCamera();
  } else if (event.key === "Tab") {
    // Currently, only the cancel button is focusable. This prevents tabbing out.
    event.preventDefault();
  }
}

/**
 * Draws the current video frame to the canvas and attempts to scan for a QR code.
 */
function scanFrame() {
  if (video.readyState === video.HAVE_ENOUGH_DATA) {
    // Set canvas size to match video stream
    canvas.height = video.videoHeight;
    canvas.width = video.videoWidth;
    canvasContext.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = canvasContext.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      // QR code found!
      closeCamera();
      announceToScreenReader("QR code found and processed.");
      // Delegate all processing to the central service.
      processDecodedQrCodeString(code.data, "Camera Scan");
      return; // Stop the scanning loop
    }
  }
  // Continue scanning
  animationFrameId = requestAnimationFrame(scanFrame);
}

/**
 * Stops the camera stream and closes the modal.
 */
function closeCamera() {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
  }

  cameraModal.style.display = "none";
  document.body.classList.remove("modal-open");
  video.pause();
  video.srcObject = null;
  video.classList.remove("mirrored"); // Clean up class on close
  document.removeEventListener("keydown", handleCameraModalKeydown);

  // Restore focus to the element that opened the modal.
  elementThatOpenedModal?.focus();
  elementThatOpenedModal = null;
}

/**
 * Opens the camera modal and starts the video stream.
 */
async function openCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    displayError("Sorry, your browser doesn't support accessing the camera.");
    return;
  }

  elementThatOpenedModal = document.activeElement as HTMLElement;

  try {
    cameraModal.style.display = "flex";
    document.body.classList.add("modal-open");
    cameraModal.setAttribute("aria-labelledby", "camera-title");
    document.addEventListener("keydown", handleCameraModalKeydown);
    cancelButton.focus();

    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" }, // Prefer back camera on mobile
    });

    // Check if the camera is user-facing and apply a mirror effect if so.
    // This is more intuitive for "selfie" style cameras.
    const videoTrack = stream.getVideoTracks()[0];
    if (videoTrack) {
      const settings = videoTrack.getSettings();
      // On desktop, and for front-facing cameras on mobile, the video feed
      // should be mirrored for a more intuitive experience. The only time
      // we don't want to mirror is when we're definitively using the
      // rear-facing (environment) camera.
      if (settings.facingMode !== "environment") {
        video.classList.add("mirrored");
      } else {
        video.classList.remove("mirrored");
      }
    }

    video.srcObject = stream;

    await video.play();

    animationFrameId = requestAnimationFrame(scanFrame);
  } catch (err: any) {
    if (err.name === "AbortError") {
      return; // Ignore user aborting by closing the modal.
    }
    logger.error("Error accessing camera: ", err);
    displayError("Could not access the camera.");
    closeCamera();
  }
}

/**
 * Initializes the camera feature by setting up DOM element references and event listeners.
 */
export function initCamera(): void {
  // The button is hidden by CSS, but we still use this check as a safeguard
  // to avoid adding listeners if the feature is not supported.
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return;
  }

  takePhotoButton = $<HTMLButtonElement>("#take-photo-button");

  cameraModal = $<HTMLDivElement>("#camera-modal");
  video = $<HTMLVideoElement>("#camera-video");
  canvas = $<HTMLCanvasElement>("#camera-canvas");
  cancelButton = $<HTMLButtonElement>("#camera-cancel");
  canvasContext = canvas.getContext("2d", { willReadFrequently: true })!;
  takePhotoButton.addEventListener("click", openCamera);
  cancelButton.addEventListener("click", closeCamera);
  // Close the modal if the overlay is clicked
  cameraModal.addEventListener("click", (event) => {
    if (event.target === cameraModal) {
      closeCamera();
    }
  });
}
