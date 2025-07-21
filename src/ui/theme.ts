import { setState } from "../state/store";
import { $ } from "./dom";

/**
 * Manages the theme switcher UI and applies the selected theme.
 * Implements an "anchored expand" behavior based on the active theme.
 */
export function initThemeSwitcher(): void {
  const themeSwitcherWrapper = document.querySelector<HTMLDivElement>(
    ".theme-switcher-wrapper"
  );
  if (!themeSwitcherWrapper) return;
  themeSwitcherWrapper.tabIndex = 0;
  themeSwitcherWrapper.setAttribute("aria-haspopup", "true");
  themeSwitcherWrapper.setAttribute("aria-label", "Open theme switcher");

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
    buttons.forEach((button) => button.classList.remove("active"));

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

  themeSwitcherWrapper.addEventListener("mouseenter", openSwitcher);
  themeSwitcherWrapper.addEventListener("mouseleave", closeSwitcher);
  themeSwitcherWrapper.addEventListener("focusout", (e: FocusEvent) => {
    if (!themeSwitcherWrapper.contains(e.relatedTarget as Node)) {
      closeSwitcher();
    }
  });

  themeSwitcher.addEventListener("click", (event: MouseEvent) => {
    const target = (event.target as HTMLElement).closest("button");
    if (target) {
      const newTheme = target.dataset.theme;
      if (newTheme) {
        applyTheme(newTheme);
      }
    }
  });

  // --- Keyboard Navigation ---
  const allButtons = Array.from(buttons);

  // Add a listener to the wrapper to "open" the switcher with keyboard.
  themeSwitcherWrapper.addEventListener("keydown", (event: KeyboardEvent) => {
    // If the switcher is already open, do nothing. This allows Enter/Space
    // to activate the focused button inside.
    if (themeSwitcherWrapper.classList.contains("open")) {
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      event.stopPropagation();
      $<HTMLAnchorElement>("#source-code-link")?.focus();
      return;
    }

    if (["Enter", " ", "ArrowDown", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation(); // Prevent global handler from also acting
      openSwitcher();
      const buttonToFocus =
        themeSwitcher.querySelector<HTMLButtonElement>("button.active") ||
        allButtons[0];
      buttonToFocus?.focus();
    }
  });

  // Add keyboard navigation for within the switcher
  buttons.forEach((button) => {
    button.addEventListener("keydown", (event: KeyboardEvent) => {
      if (!themeSwitcherWrapper.classList.contains("open")) return;

      event.stopPropagation();

      switch (event.key) {
        case "Escape":
        case "ArrowUp":
        case "ArrowDown":
          event.preventDefault();
          closeSwitcher();
          themeSwitcherWrapper.focus();
          break;

        case " ":
        case "Enter":
          event.preventDefault();
          closeSwitcher();
          themeSwitcherWrapper.focus();
          break;

        case "ArrowRight":
        case "ArrowLeft": {
          event.preventDefault();
          const currentIndex = allButtons.indexOf(button);
          const isLeft = event.key === "ArrowLeft";
          const nextIndex = isLeft ? currentIndex - 1 : currentIndex + 1;

          if (isLeft && currentIndex === 0) {
            closeSwitcher();
            $<HTMLAnchorElement>("#source-code-link")?.focus();
          } else if (nextIndex >= 0 && nextIndex < allButtons.length) {
            const nextButton = allButtons[nextIndex];
            const newTheme = nextButton.dataset.theme;
            if (newTheme) applyTheme(newTheme);
            nextButton.focus();
          }
          break;
        }
      }
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
  themeSwitcherWrapper.setAttribute("aria-expanded", "false");
  closeSwitcher();
}
