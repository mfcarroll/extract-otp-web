import { openModal, closeModal } from './modalHandler';
import QrScanner from 'qr-scanner';
import { getOtpParametersFromUrl } from '../services/otpUrlParser';
import { setState, getState } from '../state/store';
import { displayError, addUploadLog } from './notifications';
import { logger } from '../services/logger';
import { filterAndLogOtps, getOtpUniqueKey } from '../services/dataHandler';
import { t } from '../i18n';

const cameraModal = document.getElementById('camera-modal') as HTMLElement;
const video = document.getElementById('camera-video') as HTMLVideoElement;
const cameraTitle = document.getElementById('camera-title') as HTMLElement;
const cameraSelect = document.getElementById(
  'camera-select'
) as HTMLSelectElement;
const cameraSwitch = document.getElementById(
  'camera-switch'
) as HTMLButtonElement;
const scanQrButton = document.getElementById(
  'btn-scan-qr'
) as HTMLButtonElement;

let qrScanner: QrScanner | null = null;
let currentCameraId: string | null = null;

// Helper to determine camera facing mode from label
function getCameraFacingMode(
  label: string
): 'user' | 'environment' | 'unknown' {
  const lowerCaseLabel = label.toLowerCase();
  if (/(front|user|face|facetime)/.test(lowerCaseLabel)) {
    return 'user';
  } else if (/(back|rear|environment)/.test(lowerCaseLabel)) {
    return 'environment';
  }
  return 'unknown';
}

// Helper to find the "simplest" camera of a given facing mode
function findBestCamera(
  cameras: QrScanner.Camera[],
  facingMode: 'user' | 'environment'
): QrScanner.Camera | undefined {
  const filteredCameras = cameras.filter(
    (camera) => getCameraFacingMode(camera.label) === facingMode
  );

  if (filteredCameras.length === 0) {
    return undefined;
  }

  // Prioritize cameras with shorter, less descriptive labels (e.g., "Back Camera" over "Back Triple Camera")
  return filteredCameras.sort((a, b) => {
    const aScore = a.label.length;
    const bScore = b.label.length;
    return aScore - bScore;
  })[0];
}

async function processScanResult(result: QrScanner.ScanResult) {
  logger.debug('decoded qr code:', result.data);
  stopScan();

  try {
    const otpParameters = await getOtpParametersFromUrl(result.data);

    if (otpParameters && otpParameters.length > 0) {
      const currentOtps = getState().otps; // Use getState() to read current state
      const existingAndBatchKeys = new Set(currentOtps.map(getOtpUniqueKey));

      const { newOtps, duplicatesFound } = filterAndLogOtps(
        otpParameters,
        existingAndBatchKeys,
        t('log.cameraScan')
      );

      if (newOtps.length > 0) {
        setState((currentState) => ({
          otps: [...currentState.otps, ...newOtps],
        }));
      } else if (duplicatesFound > 0) {
        addUploadLog(t('log.cameraScan'), 'info', t('log.alreadyProcessedQr'));
      }
    } else {
      addUploadLog(
        t('log.cameraScan'),
        'warning',
        t('log.noSecretsInQr')
      );
    }
  } catch (error: any) {
    logger.error('Error processing scanned QR code:', error);
    displayError(
      error.message || t('error.cameraProcess')
    );
    addUploadLog(t('log.cameraScan'), 'error', error.message || t('error.unknown'));
  }
}

async function startScan(event: MouseEvent | KeyboardEvent) {
  try {
    const openedByKeyboard = event.detail === 0; // Check if triggered by keyboard (Enter/Space)
    openModal(cameraModal, stopScan, openedByKeyboard); // Use shared modal handler

    const cameras = await QrScanner.listCameras(true);
    cameraSelect.innerHTML = '';

    const userCameras = cameras.filter(
      (camera) => getCameraFacingMode(camera.label) === 'user'
    );
    const environmentCameras = cameras.filter(
      (camera) => getCameraFacingMode(camera.label) === 'environment'
    );

    let initialCamera: QrScanner.Camera | undefined;

    // Prioritize simplest environment camera
    initialCamera = findBestCamera(environmentCameras, 'environment');
    if (!initialCamera) {
      // Fallback to simplest user camera
      initialCamera = findBestCamera(userCameras, 'user');
    }
    if (!initialCamera && cameras.length > 0) {
      // Fallback to first available camera if no clear facing mode
      initialCamera = cameras[0];
    }

    if (initialCamera) {
      cameras
        .sort((a, b) => a.label.localeCompare(b.label))
        .forEach((camera) => {
          const option = document.createElement('option');
          option.value = camera.id;
          // Remove common device ID patterns like (XXXX:YYYY) for cleaner display
          option.textContent = camera.label.replace(
            /\s*\([0-9a-fA-F]{4}:[0-9a-fA-F]{4}\)/,
            ''
          );
          cameraSelect.appendChild(option);
        });

      currentCameraId = initialCamera.id;

      // Initialize qrScanner with the preferred camera
      qrScanner = new QrScanner(video, processScanResult, {
        highlightScanRegion: true,
        highlightCodeOutline: false,
        preferredCamera: currentCameraId, // Set preferred camera here
        onDecodeError: (error) => {
          if (error !== 'No QR code found') {
            logger.debug('QR scan decode error:', error);
          }
        },
      });

      cameraSelect.value = currentCameraId;
      applyVideoMirroring(initialCamera.label);

      // Conditional display of dropdown and switch button
      const hasBothFacingModes =
        userCameras.length > 0 && environmentCameras.length > 0;
      const isTwoCamerasOneOfEach =
        cameras.length === 2 &&
        userCameras.length === 1 &&
        environmentCameras.length === 1;

      if (isTwoCamerasOneOfEach) {
        cameraSelect.style.display = 'none';
      } else {
        cameraSelect.style.display = 'block';
      }

      if (hasBothFacingModes) {
        cameraSwitch.style.display = 'block';
      } else {
        cameraSwitch.style.display = 'none';
      }

      await qrScanner.start(); // Now start the scanner with the preferred camera set
    } else {
      // No cameras available
      cameraSelect.style.display = 'none';
      cameraSwitch.style.display = 'none';
      currentCameraId = null;
      displayError(
        t('error.noCamera')
      );
      stopScan(); // Ensure modal is closed if no camera
      return; // Exit early if no camera
    }
  } catch (error) {
    logger.error('Failed to start camera:', error);
    displayError(
      t('error.startCamera')
    );
    stopScan(); // Ensure modal is closed if camera fails to start
  }
}

function stopScan() {
  if (qrScanner) {
    qrScanner.destroy(); // Destroy the scanner instance to clean up DOM and event listeners
    qrScanner = null; // Set to null so a new instance is created next time
  }
  closeModal(cameraModal); // Use shared modal handler
}

function applyVideoMirroring(cameraLabel: string) {
  const facingMode = getCameraFacingMode(cameraLabel);
  if (facingMode === 'environment') {
    video.classList.remove('mirrored-video');
    video.classList.add('regular-video');
  } else {
    video.classList.remove('regular-video');
    video.classList.add('mirrored-video');
  }
  logger.debug(
    `Camera: ${cameraLabel}, Facing Mode: ${facingMode}, Mirroring: ${video.classList.contains('mirrored-video') ? 'scaleX(-1)' : 'scaleX(1)'}`
  );
}

async function switchCamera() {
  if (!qrScanner) return;
  const cameras = await QrScanner.listCameras(true);
  if (cameras.length <= 1) return;

  const userCameras = cameras.filter(
    (camera) => getCameraFacingMode(camera.label) === 'user'
  );
  const environmentCameras = cameras.filter(
    (camera) => getCameraFacingMode(camera.label) === 'environment'
  );

  const currentCamera = cameras.find((cam) => cam.id === currentCameraId);
  if (!currentCamera) return; // Should not happen

  const currentFacingMode = getCameraFacingMode(currentCamera.label);
  let targetCamera: QrScanner.Camera | undefined;

  if (currentFacingMode === 'user') {
    targetCamera = findBestCamera(environmentCameras, 'environment');
  } else {
    // If current is environment or unknown, switch to user
    targetCamera = findBestCamera(userCameras, 'user');
  }

  if (targetCamera) {
    try {
      await qrScanner.setCamera(targetCamera.id);
      currentCameraId = targetCamera.id;
      cameraSelect.value = currentCameraId;
      applyVideoMirroring(targetCamera.label);
      logger.debug('Switched to camera:', targetCamera.label);
    } catch (error) {
      logger.error('Failed to switch camera:', error);
      displayError(t('error.switchCamera'));
    }
  }
}

export function initCamera() {
  scanQrButton?.addEventListener('click', startScan);
  document.getElementById('camera-cancel')?.addEventListener('click', stopScan);
  cameraSelect.addEventListener('change', async () => {
    if (qrScanner) {
      const selectedCamera = Array.from(cameraSelect.options).find(
        (option) => option.value === cameraSelect.value
      );
      qrScanner.setCamera(cameraSelect.value);
      currentCameraId = cameraSelect.value;
      if (selectedCamera) {
        applyVideoMirroring(selectedCamera.textContent || '');
      }
    }
  });
  cameraSwitch.addEventListener('click', switchCamera);
}
