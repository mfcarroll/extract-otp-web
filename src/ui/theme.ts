import { setState } from "../state/store";
import { $ } from "./dom";
import { Navigation } from "./navigation";
import { isMobile } from "./viewport";

/**
 * Manages the theme switcher UI and applies the selected theme.
 * Implements an "anchored expand" behavior based on the active theme.
 */
export function initThemeSwitcher(): void {
  const themeSwitcherWrapper = document.querySelector<HTMLDivElement>(
    ".theme-switcher-wrapper"
  );
  if (!themeSwitcherWrapper) return;

  const themeSwitcher =
    themeSwitcherWrapper.querySelector<HTMLDivElement>(".theme-switcher");
  if (!themeSwitcher) return;

  const buttons = themeSwitcher.querySelectorAll<HTMLButtonElement>("button");
  const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");

  /**
   * Applies the selected theme to the document and updates UI elements.
   * @param theme - The theme to apply ('light', 'dark', or 'system').
   */
  const applyTheme = (theme: string): void => {
    const html = document.documentElement;
    html.classList.remove("light-mode", "dark-mode");
    buttons.forEach((button) => {
      button.classList.remove("active");
      button.setAttribute("aria-checked", "false");
    });

    let effectiveTheme = theme;
    if (theme === "system") {
      effectiveTheme = mediaQuery.matches ? "dark" : "light";
    }

    if (effectiveTheme === "dark") {
      html.classList.add("dark-mode");
    } else {
      html.classList.add("light-mode");
    }

    const buttonToActivate = themeSwitcher.querySelector<HTMLButtonElement>(
      `button[data-theme="${theme}"]`
    );
    buttonToActivate?.classList.add("active");
    buttonToActivate?.setAttribute("aria-checked", "true");

    // Update the global state. This will trigger subscribers (like results) to re-render.
    setState(() => ({ theme: theme as "light" | "dark" | "system" }));
    localStorage.setItem("theme", theme);
  };

  const positionSwitcher = () => {
    const activeButton =
      themeSwitcher.querySelector<HTMLButtonElement>("button.active");
    if (!activeButton) return;

    const allButtons = Array.from(buttons);
    const activeIndex = allButtons.indexOf(activeButton);

    if (activeIndex === -1) return;

    const centerIndex = 1;
    const indexOffset = activeIndex - centerIndex;

    if (indexOffset === 0) {
      themeSwitcher.style.removeProperty("--switcher-transform-x");
      return;
    }

    const buttonPitch = 32 + 2 * 2; // width + margin-left + margin-right
    const horizontalOffset = indexOffset * buttonPitch;

    themeSwitcher.style.setProperty(
      "--switcher-transform-x",
      `calc(-50% - ${horizontalOffset}px)`
    );
  };

  const openSwitcher = (): void => {
    if (themeSwitcherWrapper.classList.contains("open")) return;

    const rect = themeSwitcherWrapper.getBoundingClientRect();
    themeSwitcherWrapper.style.width = `${rect.width}px`;
    themeSwitcherWrapper.style.height = `${rect.height}px`;

    positionSwitcher();
    themeSwitcherWrapper.classList.add("open");
    themeSwitcherWrapper.setAttribute("aria-expanded", "true");
    buttons.forEach((button) => (button.tabIndex = 0));
  };

  const closeSwitcher = (): void => {
    themeSwitcherWrapper.classList.remove("open");
    themeSwitcher.style.removeProperty("--switcher-transform-x");
    themeSwitcherWrapper.style.removeProperty("width");
    themeSwitcherWrapper.style.removeProperty("height");
    themeSwitcherWrapper.setAttribute("aria-expanded", "false");
    buttons.forEach((button) => (button.tabIndex = -1));
  };

  themeSwitcherWrapper.addEventListener("mouseenter", () => {
    if (isMobile()) return;
    openSwitcher();
  });
  themeSwitcherWrapper.addEventListener("mouseleave", () => {
    if (isMobile()) return;
    closeSwitcher();
  });

  themeSwitcherWrapper.addEventListener("click", () => {
    // This click handler should only open the switcher if it's closed.
    // If it's already open, clicks on the buttons inside are handled by
    // a separate listener. This allows the generic navigation handler to
    // activate the wrapper with Enter/Space.
    if (!themeSwitcherWrapper.classList.contains("open")) {
      const elementToFocus = openAndFocusActive();
      elementToFocus?.focus();
    }
  });

  themeSwitcher.addEventListener("click", (event: MouseEvent) => {
    // This handler should only act when the switcher is already open.
    // Otherwise, it intercepts the click meant to open the switcher,
    // preventing it from ever opening on mobile (where click is the only open mechanism).
    if (!themeSwitcherWrapper.classList.contains("open")) {
      return;
    }
    const target = (event.target as HTMLElement).closest("button");
    if (target) {
      event.stopPropagation(); // Prevent the wrapper's click handler from re-opening.
      const newTheme = target.dataset.theme;
      if (newTheme) {
        applyTheme(newTheme);
        // On mobile, close the switcher after a theme is selected.
        if (isMobile()) {
          closeSwitcher();
        }
      }
    }
  });

  const allButtons = Array.from(buttons);

  // --- Declarative Keyboard Navigation ---

  // When the switcher is open, if the user tabs away, it should close.
  themeSwitcher.addEventListener("keydown", (event: KeyboardEvent) => {
    if (event.key === "Tab") {
      // By simply closing the switcher, we allow the default tab behavior
      // to proceed, which will correctly move focus to the next element.
      closeSwitcher();
    }
  });

  // Rules for when the wrapper is focused (and closed)
  const openAndFocusActive = () => {
    openSwitcher();
    return (
      themeSwitcher.querySelector<HTMLButtonElement>("button.active") ||
      allButtons[0]
    );
  };

  Navigation.registerRule(themeSwitcherWrapper, "down", openAndFocusActive);
  Navigation.registerRule(themeSwitcherWrapper, "right", openAndFocusActive);

  // Rules for when a button inside the switcher is focused (and open)
  allButtons.forEach((button, index) => {
    const closeAndFocusWrapper = () => {
      closeSwitcher();
      return themeSwitcherWrapper;
    };

    // The theme switcher's internal controls are state-changing actions, not
    // just spatial navigation. We register them as key actions so they take
    // precedence over spatial navigation and don't create a "go back" history.
    Navigation.registerKeyAction(button, "arrowup", closeAndFocusWrapper);
    Navigation.registerKeyAction(button, "arrowdown", closeAndFocusWrapper);
    Navigation.registerKeyAction(button, "escape", closeAndFocusWrapper);
    Navigation.registerKeyAction(button, "enter", closeAndFocusWrapper);
    Navigation.registerKeyAction(button, " ", closeAndFocusWrapper);

    Navigation.registerKeyAction(button, "arrowleft", () => {
      const prevIndex = (index - 1 + allButtons.length) % allButtons.length;
      const prevButton = allButtons[prevIndex];
      applyTheme(prevButton.dataset.theme!);
      return prevButton;
    });

    Navigation.registerKeyAction(button, "arrowright", () => {
      const nextIndex = (index + 1) % allButtons.length;
      const nextButton = allButtons[nextIndex];
      applyTheme(nextButton.dataset.theme!);
      return nextButton;
    });
  });

  mediaQuery.addEventListener("change", () => {
    const currentTheme = localStorage.getItem("theme") || "system";
    if (currentTheme === "system") {
      applyTheme("system");
    }
  });

  const savedTheme = localStorage.getItem("theme") || "system";
  applyTheme(savedTheme);
  closeSwitcher();
}
