/**
 * A centralized logging service that provides level-based logging and can be
 * controlled via environment variables.
 */

// Vite exposes `VITE_` prefixed env variables as strings. We check for 'true'.
export const isDebugEnabled = import.meta.env.VITE_DEBUG_LOGGING === "true";

export const logger = {
  /**
   * Logs a debug message. This will only be output to the console
   * if `VITE_DEBUG_LOGGING` is set to `true` in your .env file.
   * @param message The primary message to log.
   * @param optionalParams Additional objects or values to log.
   */
  debug: (message?: any, ...optionalParams: any[]): void => {
    if (isDebugEnabled) {
      console.log(message, ...optionalParams);
    }
  },

  /**
   * Logs a warning message to the console.
   */
  warn: (message?: any, ...optionalParams: any[]): void => {
    console.warn(message, ...optionalParams);
  },

  /**
   * Logs an error message to the console.
   */
  error: (message?: any, ...optionalParams: any[]): void => {
    console.error(message, ...optionalParams);
  },
};
