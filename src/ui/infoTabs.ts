import { $ } from "./dom";
import { Navigation } from "./navigation";

/**
 * Sets up the event listeners for the tabbed informational interface.
 * Uses event delegation for efficiency.
 */
function setupTabs(): void {
  const tabButtonsContainer = $<HTMLDivElement>(".tab-buttons");
  const tabContentsContainer = $<HTMLDivElement>(".tab-content-wrapper");

  const tabButtons = Array.from(
    tabButtonsContainer.querySelectorAll<HTMLButtonElement>(".tab-button")
  );
  const tabContents = Array.from(
    tabContentsContainer.querySelectorAll<HTMLDivElement>(".tab-content")
  );

  function activateTab(tabToActivate: HTMLButtonElement) {
    const tabId = tabToActivate.dataset.tab;
    if (!tabId) return;

    // Deactivate all buttons and content panels
    tabButtons.forEach((button) => button.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Activate the new button and its corresponding content panel
    tabToActivate.classList.add("active");
    $(`#tab-${tabId}`)?.classList.add("active");
  }

  tabButtonsContainer.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".tab-button"
    );
    if (button) {
      activateTab(button);
    }
  });

  // --- NEW PRIORITIZER RULE ---
  // This rule provides semantic context to the spatial navigation system.
  // It says: "If you are considering navigating to any of my tab buttons,
  // you should *always* prefer the one that is currently active."
  // This is more robust than a source-specific rule because it works
  // regardless of where the navigation originates.
  Navigation.registerPrioritizer((candidates, direction, from) => {
    const bestCandidate = candidates[0];
    if (!bestCandidate) return null;

    // The section we are potentially navigating TO.
    const targetSection = bestCandidate.closest(".tab-buttons");
    if (!targetSection) {
      return null; // Not navigating into the tabs section.
    }

    // The section we are navigating FROM.
    const sourceSection = from.closest(".tab-buttons");

    // This prioritizer should only apply when *entering* the tabs section.
    // If we are already moving between tabs, let the default rules apply.
    if (sourceSection === targetSection) {
      return null;
    }

    // If we are entering the tabs section from outside, force focus to the active tab.
    return targetSection.querySelector<HTMLButtonElement>(".tab-button.active");
  });

  // Register navigation rules for the tabs
  tabButtons.forEach((button, index) => {
    Navigation.registerRule(button, "left", () => {
      const prevButton =
        tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
      activateTab(prevButton);
      return prevButton;
    });

    Navigation.registerRule(button, "right", () => {
      const nextButton = tabButtons[(index + 1) % tabButtons.length];
      activateTab(nextButton);
      return nextButton;
    });

    Navigation.registerRule(button, "home", () => {
      const firstButton = tabButtons[0];
      activateTab(firstButton);
      return firstButton;
    });

    Navigation.registerRule(button, "end", () => {
      const lastButton = tabButtons[tabButtons.length - 1];
      activateTab(lastButton);
      return lastButton;
    });
  });
}

/**
 * Sets up the event listeners for the accordion-style FAQ.
 * Uses event delegation for efficiency.
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

  faqContainer.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".faq-button"
    );
    if (!button) return;

    const faqItem = button.closest<HTMLDivElement>(".faq-item");
    if (!faqItem) return;

    faqItem.classList.toggle("open");

    const isExpanded = faqItem.classList.contains("open");
    button.setAttribute("aria-expanded", String(isExpanded));

    // Make links tabbable only when the panel is open
    const links = faqItem.querySelectorAll<HTMLAnchorElement>(".faq-answer a");
    links.forEach((link) => {
      link.setAttribute("tabindex", isExpanded ? "0" : "-1");
    });
  });

  // Only set up keyboard navigation if there are FAQ buttons to navigate.
  if (buttons.length === 0) {
    return;
  }

  // Register navigation rules for the accordion to strictly follow ARIA patterns.
  buttons.forEach((button, index) => {
    // Up/Down arrows are correctly handled by the default spatial navigation.

    // Left/Right arrows should do nothing according to ARIA spec for accordion.
    // Returning null prevents the default spatial navigation from taking over.
    Navigation.registerRule(button, "left", () => null);
    Navigation.registerRule(button, "right", () => null);

    // Home/End go to the first/last item.
    Navigation.registerRule(button, "home", () => {
      return buttons[0];
    });

    Navigation.registerRule(button, "end", () => {
      return buttons[buttons.length - 1];
    });
  });
}

/**
 * Initializes the info tabs and FAQ accordion.
 */
export function initInfoTabs(): void {
  setupTabs();
  setupAccordion();
}
