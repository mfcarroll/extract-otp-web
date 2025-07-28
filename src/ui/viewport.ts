/**
 * A centralized utility for checking viewport conditions.
 * This file serves as the single source of truth for breakpoints used in
 * JavaScript logic. These values should be kept in sync with the corresponding
 * values in the application's stylesheets.
 */

// Corresponds to the general breakpoint for switching to touch-first behaviors,
// like disabling hover-to-open menus. See: _theme-switcher.css, _layout.css
const MOBILE_BREAKPOINT = 768;

// Corresponds to the breakpoint where layouts become single-column and more
// compact. See: _otp-card.css, _modal.css
const NARROW_BREAKPOINT = 600;

const mobileMediaQuery = window.matchMedia(
  `(max-width: ${MOBILE_BREAKPOINT}px)`
);

/**
 * Checks if the viewport is within the general mobile/tablet breakpoint.
 * This is used for major behavioral changes (e.g., touch vs. hover).
 */
export const isMobile = (): boolean => mobileMediaQuery.matches;

const narrowViewportMediaQuery = window.matchMedia(
  `(max-width: ${NARROW_BREAKPOINT}px)`
);

/**
 * Checks if the viewport is narrow, typically a mobile phone in portrait mode.
 * This is used for more granular layout adjustments (e.g., stacking elements).
 */
export const isNarrowViewport = (): boolean => narrowViewportMediaQuery.matches;
