import { $, $all } from "./dom";
import { Navigation } from "./navigation";

/**
 * Activates a tab and its corresponding panel, updating ARIA attributes and classes.
 * The navigation system handles setting focus, so this function does not.
 * @param tabToActivate The button element of the tab to activate.
 */
function activateTab(tabToActivate: HTMLButtonElement) {
  const tabId = tabToActivate.dataset.tab;
  if (!tabId) return;

  const tabButtons = $all<HTMLButtonElement>(".tab-button");
  const tabContents = $all<HTMLDivElement>(".tab-content");

  // Deactivate all other tabs and hide their panels
  tabButtons.forEach((button) => {
    const isSelected = button === tabToActivate;
    button.classList.toggle("active", isSelected);
    button.setAttribute("aria-selected", String(isSelected));
    button.tabIndex = isSelected ? 0 : -1;
  });

  // Show the active panel and hide others
  tabContents.forEach((content) => {
    const isForActiveTab = content.id === `tab-${tabId}`;
    content.hidden = !isForActiveTab;
    content.classList.toggle("active", isForActiveTab);

    // Manage focusability of content within tab panels.
    const navigables = content.querySelectorAll<HTMLElement>(".navigable");
    if (isForActiveTab) {
      // When a tab becomes active, make its first navigable element focusable.
      // The main navigation system will handle roving tabindex from there.
      if (navigables.length > 0) {
        navigables[0].tabIndex = 0;
      }
    } else {
      // When a tab becomes inactive, ensure all its content is non-focusable.
      navigables.forEach((nav) => (nav.tabIndex = -1));
    }
  });
}

/**
 * Sets up the event listeners and navigation rules for the tabbed interface.
 */
function setupTabs(): void {
  const tabButtonsContainer = $<HTMLDivElement>(".tab-buttons");
  const tabButtons = Array.from(
    tabButtonsContainer.querySelectorAll<HTMLButtonElement>(".tab-button")
  );

  // Handle clicks on tabs using event delegation
  tabButtonsContainer.addEventListener("click", (event) => {
    const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
      ".tab-button"
    );
    if (button) {
      activateTab(button);
    }
  });

  // This rule ensures that when navigating *into* the tab group from another
  // section, focus always lands on the currently active tab.
  Navigation.registerPrioritizer((candidates, _direction, from) => {
    const bestCandidate = candidates[0];
    if (!bestCandidate) return null;

    const targetSection = bestCandidate.closest(".tab-buttons");
    if (!targetSection) return null; // Not navigating into the tabs section.

    const sourceSection = from.closest(".tab-buttons");
    // If we are already moving between tabs, let the default rules apply.
    if (sourceSection === targetSection) return null;

    // If we are entering the tabs section, force focus to the active tab.
    return targetSection.querySelector<HTMLButtonElement>(".tab-button.active");
  });

  // Register declarative navigation rules for the tabs
  tabButtons.forEach((button, index) => {
    // Use `registerKeyAction` for left/right arrows. This ensures the tab
    // activation logic runs every time, bypassing the "go back" feature in
    // the main navigation system, which would otherwise just move focus
    // without activating the tab.
    Navigation.registerKeyAction(button, "arrowleft", () => {
      const prevButton =
        tabButtons[(index - 1 + tabButtons.length) % tabButtons.length];
      activateTab(prevButton);
      return prevButton;
    });

    Navigation.registerKeyAction(button, "arrowright", () => {
      const nextButton = tabButtons[(index + 1) % tabButtons.length];
      activateTab(nextButton);
      return nextButton;
    });

    // Home/End can remain as standard rules as they don't conflict with the
    // directional "go back" logic.
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
 * Initializes the info tabs.
 */
export function initTabs(): void {
  setupTabs();
}
