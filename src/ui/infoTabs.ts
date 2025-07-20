import { $ } from "./dom";

/**
 * Sets up the event listeners for the tabbed informational interface.
 * Uses event delegation for efficiency.
 */
function setupTabs(): void {
  const tabsContainer = document.getElementById("info-tabs");
  if (!tabsContainer) return;

  const tabButtons =
    tabsContainer.querySelectorAll<HTMLHeadingElement>(".tab-button");
  const tabContents =
    tabsContainer.querySelectorAll<HTMLDivElement>(".tab-content");

  tabsContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;
    if (!target.matches(".tab-button")) return;

    const tabId = target.dataset.tab;
    if (!tabId) return;

    // Deactivate all buttons and content panels
    tabButtons.forEach((button) => button.classList.remove("active"));
    tabContents.forEach((content) => content.classList.remove("active"));

    // Activate the clicked button and its corresponding content panel
    target.classList.add("active");
    $(`#tab-${tabId}`).classList.add("active");
  });
}

/**
 * Sets up the event listeners for the accordion-style FAQ.
 * Uses event delegation for efficiency.
 */
function setupAccordion(): void {
  const faqContainer = document.getElementById("tab-faq");
  if (!faqContainer) return;

  faqContainer.addEventListener("click", (event) => {
    const target = event.target as HTMLElement;

    // If a link inside the answer is clicked, do nothing.
    if (target.closest("a")) {
      return;
    }
    const faqItem = target.closest<HTMLDivElement>(".faq-item");
    if (!faqItem) return;

    const button = faqItem.querySelector<HTMLButtonElement>(".faq-button");
    if (!button) return;

    faqItem.classList.toggle("open");

    const isExpanded = faqItem.classList.contains("open");
    button.setAttribute("aria-expanded", String(isExpanded));
  });
}

/**
 * Initializes the info tabs and FAQ accordion.
 */
export function initInfoTabs(): void {
  setupTabs();
  setupAccordion();
}
