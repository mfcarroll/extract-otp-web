import { $, $all } from "./dom";
import { Navigation } from "./navigation";

/**
 * Toggles the visibility of an FAQ panel and updates its ARIA state.
 * @param button The button element that controls the FAQ panel.
 */
function toggleFaqPanel(button: HTMLButtonElement) {
  const faqItem = button.closest<HTMLDivElement>(".faq-item");
  if (!faqItem) return;

  // Determine the new state by checking for the 'open' class
  const isOpening = !faqItem.classList.contains("open");

  // Toggle the class for CSS transitions, which controls visibility
  faqItem.classList.toggle("open", isOpening);

  // Update ARIA state to match
  button.setAttribute("aria-expanded", String(isOpening));

  // Make links inside tabbable only when the panel is open
  const links = faqItem.querySelectorAll<HTMLAnchorElement>(".faq-answer a");
  links.forEach((link) => {
    link.setAttribute("tabindex", isOpening ? "0" : "-1");
  });
}

/**
 * Sets up the event listeners for the accordion-style FAQ.
 */
function setupAccordion(): void {
  const faqContainer = document.getElementById("tab-faq");
  if (!faqContainer) return;

  const buttons = Array.from(
    faqContainer.querySelectorAll<HTMLButtonElement>(".faq-button")
  );

  // Initially, make all links inside panels non-tabbable.
  faqContainer
    .querySelectorAll<HTMLAnchorElement>(".faq-answer a")
    .forEach((link) => {
      link.setAttribute("tabindex", "-1");
    });

  // --- Robust Accordion Activation ---
  // The 'click' event is not always reliable on mobile. If a user taps a button
  // but moves their finger even slightly, the browser may cancel the 'click'
  // event. A simple 'touchstart' listener with `preventDefault()` solves this,
  // but it also blocks page scrolling. This more robust implementation detects
  // if the user is tapping or scrolling.

  let touchStartX = 0;
  let touchStartY = 0;
  const touchMoveThreshold = 10; // Max pixels to move before it's a scroll

  faqContainer.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length === 1) {
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
      }
    },
    { passive: true } // Use passive for better scroll performance.
  );

  faqContainer.addEventListener("touchend", (event) => {
    if (event.changedTouches.length !== 1) return;

    const touch = event.changedTouches[0];
    const deltaX = Math.abs(touch.clientX - touchStartX);
    const deltaY = Math.abs(touch.clientY - touchStartY);

    // If the finger moved significantly, treat it as a scroll and do nothing.
    if (deltaX > touchMoveThreshold || deltaY > touchMoveThreshold) {
      return;
    }

    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".faq-button"
    );
    if (button) {
      // We found a button and it was a valid tap.
      // Prevent the browser from firing a "ghost" click event 300ms later.
      event.preventDefault();
      toggleFaqPanel(button);
    }
  });

  // A 'click' handler is still necessary for mouse users and accessibility (e.g.,
  // screen reader activation, Enter/Space key presses). The `preventDefault()`
  // in the `touchend` listener prevents this from firing twice on touch devices.
  faqContainer.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".faq-button"
    );
    if (button) toggleFaqPanel(button);
  });

  // Only set up keyboard navigation if there are FAQ buttons to navigate.
  if (buttons.length === 0) {
    return;
  }

  // Register navigation rules for the accordion to strictly follow ARIA patterns.
  buttons.forEach((button) => {
    // Up/Down arrows are correctly handled by the default spatial navigation.
    // Left/Right arrows should do nothing according to ARIA spec for accordion.
    Navigation.registerRule(button, "left", () => null);
    Navigation.registerRule(button, "right", () => null);

    // Home/End go to the first/last item.
    Navigation.registerRule(button, "home", () => buttons[0]);
    Navigation.registerRule(button, "end", () => buttons[buttons.length - 1]);
  });
}

/**
 * Initializes the FAQ accordion.
 */
export function initAccordion(): void {
  setupAccordion();
}
