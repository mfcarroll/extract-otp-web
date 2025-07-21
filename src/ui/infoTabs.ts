import { $ } from "./dom";

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

  tabsContainer.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".tab-button")) return;

    const currentIndex = tabButtons.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) return;

    let nextButton: HTMLButtonElement | undefined;

    if (event.key === "ArrowRight") {
      nextButton = tabButtons[(currentIndex + 1) % tabButtons.length];
    } else if (event.key === "ArrowLeft") {
      nextButton =
        tabButtons[(currentIndex - 1 + tabButtons.length) % tabButtons.length];
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      // Find the currently active tab button to determine which panel is open.
      // This is more robust than checking the focused tab.
      const activeTabButton =
        tabsContainer.querySelector<HTMLButtonElement>(".tab-button.active");
      const activeTabId = activeTabButton?.dataset.tab;

      if (activeTabId === "faq") {
        // Try to focus the first FAQ button.
        const firstFaqButton = $<HTMLButtonElement>("#tab-faq .faq-button");
        if (firstFaqButton) {
          firstFaqButton.focus();
        } else {
          // If FAQ tab is active but has no items, fall back to the file input.
          $<HTMLLabelElement>(".file-input-label")?.focus();
        }
      } else {
        // For any other active tab, move focus down to the file input area.
        $<HTMLLabelElement>(".file-input-label")?.focus();
      }
      return;
    }

    if (nextButton) {
      event.preventDefault();
      nextButton.focus();
      // Directly activate the tab instead of relying on a programmatic click
      activateTab(nextButton);
    }
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

  // Keydown handler for keyboard navigation (roving tabindex)
  faqContainer.addEventListener("keydown", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".faq-button")) {
      return;
    }

    const currentIndex = buttons.indexOf(target as HTMLButtonElement);
    if (currentIndex === -1) {
      return;
    }

    const isFirst = currentIndex === 0;
    const isLast = currentIndex === buttons.length - 1;

    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        if (isLast) {
          $<HTMLLabelElement>(".file-input-label")?.focus();
        } else {
          buttons[currentIndex + 1].focus();
        }
        break;

      case "ArrowUp":
        event.preventDefault();
        if (isFirst) {
          $<HTMLButtonElement>('.tab-button[data-tab="faq"]')?.focus();
        } else {
          buttons[currentIndex - 1].focus();
        }
        break;

      case "Home":
        event.preventDefault();
        buttons[0].focus();
        break;

      case "End":
        event.preventDefault();
        buttons[buttons.length - 1].focus();
        break;
    }
  });
}

/**
 * Initializes the info tabs and FAQ accordion.
 */
export function initInfoTabs(): void {
  setupTabs();
  setupAccordion();
}
