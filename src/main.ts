/**
 * This is the main entry point for the application.
 * It is responsible for initializing all the different UI components and services,
 * setting up global event listeners, and orchestrating the application startup.
 */

import { Buffer } from 'buffer'; // Keep for browser environment polyfill
import QrScanner from 'qr-scanner';
import { initResults } from './ui/results';
import { initFileInput } from './ui/fileInput';
import { initManualInput } from './ui/manualInput';
import { initCamera } from './ui/camera';

import { initThemeSwitcher } from './ui/theme';
import { initExportControls } from './ui/exportControls';
import { initNavigation } from './ui/navigation';
import { initFooter } from './ui/footer';
import { initTabs } from './ui/tabs';
import { initAccordion } from './ui/accordion';
import { displayError, announceToScreenReader } from './ui/notifications';
import { logger } from './services/logger';
import { initI18n, onLanguageChange, t } from './i18n';
import { setState } from './state/store';

window.Buffer = Buffer; // Make Buffer globally available for libraries that might need it.

/**
 * Sets up global error handlers to catch unhandled exceptions and promise
 * rejections, providing a user-friendly error message.
 */
function setupGlobalErrorHandling(): void {
  const genericErrorMessage = t('error.unexpected');

  window.addEventListener('error', (event) => {
    logger.error('Uncaught error:', event.error);
    displayError(genericErrorMessage);
  });

  window.addEventListener('unhandledrejection', (event) => {
    logger.error('Unhandled promise rejection:', event.reason);
    displayError(genericErrorMessage);
  });
}

/**
 * Initializes the application by setting up all event listeners.
 * This function is called once the DOM is fully loaded.
 */
function initializeApp(): void {
  initI18n();
  setupGlobalErrorHandling();
  initNavigation();
  initTabs();
  initAccordion();

  initResults();
  initFileInput();
  initManualInput();
  initCamera();
  initThemeSwitcher();
  initExportControls();
  initFooter();

  onLanguageChange(() => {
    // Trigger subscribers so state-driven UI text can refresh in the new language.
    setState((state) => ({ ...state }));
  });
}

// Initialize the application once the DOM is ready.
document.addEventListener('DOMContentLoaded', initializeApp);
