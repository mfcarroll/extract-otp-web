import { $ } from "./dom";
import { Navigation } from "./navigation";

/**
 * Sets up the event listeners for the tabbed informational interface.
 * Uses event delegation for efficiency.
 */
function setupTabs(): void {
  const tabsContainer = document.getElementById("info-tabs");
  if (!tabsContainer) return;

  const tabButtons = Array.from(
    tabsContainer.querySelectorAll<HTMLButtonElement>(".tab-button")
  );
  const tabContents = Array.from(
    tabsContainer.querySelectorAll<HTMLDivElement>(".tab-content")
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

  tabsContainer.addEventListener("click", (event) => {
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
  Navigation.registerPrioritizer((candidates) => {
    const bestCandidate = candidates[0];
    if (!bestCandidate) return null;

    // Check if the best candidate is a tab button.
    const tabsContainer = bestCandidate.closest(".tab-buttons");
    if (!tabsContainer) {
      return null; // Not navigating into the tabs section.
    }

    // If we are entering the tabs section, force focus to the active tab.
    return tabsContainer.querySelector<HTMLButtonElement>(".tab-button.active");
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

  // Register navigation rules for the accordion
  buttons.forEach((button, index) => {
    // The `up` and `down` navigation is now handled by the default spatial
    // navigation algorithm, which is smart enough to move between adjacent
    // items. The "Prioritizer" handles the special case of navigating `up`
    // from the first item into the active tab.
    // We only need to keep the component-scoped Home/End behavior.
    Navigation.registerRule(button, "home", () => {
      // Go to the first FAQ item
      return buttons[0];
    });

    Navigation.registerRule(button, "end", () => {
      // Go to the last FAQ item
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
