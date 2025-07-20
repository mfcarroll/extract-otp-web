import { $ } from "./dom";

/**
 * Initializes dynamic parts of the footer, like the copyright year.
 */
export function initFooter(): void {
  const yearSpan = $<HTMLSpanElement>("#copyright-year");
  // Add a check to ensure the element exists before trying to modify it.
  // This makes the function more robust against potential loading issues.
  if (yearSpan) {
    yearSpan.textContent = new Date().getFullYear().toString();
  }
}
