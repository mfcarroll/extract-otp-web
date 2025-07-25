import { $ } from "./dom";
import { handleCopyAction } from "./clipboard";
import { findClosestElementByScore } from "../services/spatialNavigationScore";
import { findClosestElementByProjection } from "../services/spatialNavigationProjection";
import { Direction } from "../services/navigationTypes";

type NavDirection = Direction | "home" | "end";
type NavigationRule = () => HTMLElement | null | undefined;
type KeyActionRule = () => HTMLElement | null;
type Prioritizer = (
  candidates: HTMLElement[],
  direction: Direction,
  from: HTMLElement
) => HTMLElement | null;

// --- State for "go back" feature ---
let lastMove: {
  from: HTMLElement;
  to: HTMLElement;
  direction: Direction;
} | null = null;

const rules = new Map<
  HTMLElement,
  Partial<Record<NavDirection, NavigationRule>>
>();
const keyActionRules = new Map<
  HTMLElement,
  Partial<Record<string, KeyActionRule>>
>();
const prioritizers: Prioritizer[] = [];

// To switch navigation algorithms, change the function assigned here.
const findClosestNavigableElement = findClosestElementByProjection;
// const findClosestNavigableElement = findClosestElementByScore; // The original algorithm

/**
 * Briefly highlights an element to provide visual feedback for navigation events.
 * @param el The element to highlight.
 * @param color The color to use for the highlight.
 */
function highlightFocus(el: HTMLElement, color: string) {
  // This function is used for debugging navigation behavior.
  el.style.outline = `2px solid ${color}`;
  el.style.outlineOffset = "2px";
  setTimeout(() => {
    el.style.outline = "";
    el.style.outlineOffset = "";
  }, 300);
}

function getSection(el: HTMLElement): HTMLElement | null {
  return el.closest(".navigable-section");
}

function getNavigableSections(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".navigable-section")
  ).filter((el) => el.offsetParent !== null);
}

function getSectionNavigables(section: HTMLElement): HTMLElement[] {
  return Array.from(section.querySelectorAll<HTMLElement>(".navigable")).filter(
    (el) => el.offsetParent !== null
  );
}

function setFocus(
  currentEl: HTMLElement | null,
  nextEl: HTMLElement | null,
  direction?: Direction,
  reason?: "rule" | "prioritizer" | "reversal"
) {
  if (!nextEl) {
    // If focus doesn't change for any reason, clear the last move.
    lastMove = null;
    return;
  }

  if (currentEl) {
    // This is the logic for "roving tabindex". It should only apply when
    // moving between items *within* the same composite widget (like a
    // tablist or grid). For standalone controls, we just move focus
    // without altering their tabindex, preserving the natural tab order.
    const rovingContainer = currentEl.closest(
      '[role="tablist"], [role="grid"], #tab-faq'
    );

    // If the current element is in a roving container, and the next element
    // is also in that same container, then we update the tabindex.
    if (rovingContainer && rovingContainer.contains(nextEl)) {
      const currentSection = getSection(currentEl);
      const nextSection = getSection(nextEl);

      // Only rove tabindex (set old element to -1) if the navigation
      // is happening within the same section.
      if (currentSection && currentSection === nextSection) {
        currentEl.tabIndex = -1;
      }
    }
  }
  nextEl.tabIndex = 0;
  nextEl.focus();

  // When focusing an input, ensure it doesn't scroll to the end.
  if (nextEl.matches(".secret-input, .url-input")) {
    (nextEl as HTMLInputElement).scrollLeft = 0;
  }

  // If this was a directional move, record it.
  if (direction && currentEl) {
    lastMove = { from: currentEl, to: nextEl, direction };
  } else {
    // Any non-directional focus change (e.g. from a key action) should clear the memory.
    lastMove = null;
  }

  // Debug Highlighting
  // if (reason === "rule") {
  //   highlightFocus(nextEl, "rgba(255, 0, 0, 0.7)"); // Red for custom rule
  // } else if (reason === "prioritizer") {
  //   highlightFocus(nextEl, "rgba(0, 255, 0, 0.7)"); // Green for prioritizer
  // } else if (reason === "reversal") {
  //   highlightFocus(nextEl, "rgba(255, 165, 0, 0.7)"); // Orange for reversal
  // }
}

const oppositeDirection: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
};

function findNext(
  currentEl: HTMLElement,
  direction: NavDirection
): HTMLElement | null {
  // --- Step 0: Handle immediate reversal ---
  // This rule has the highest priority. If the user presses the opposite
  // arrow key, we should go back to where we came from.
  if (
    lastMove &&
    (direction === "up" ||
      direction === "down" ||
      direction === "left" ||
      direction === "right") &&
    currentEl === lastMove.to &&
    direction === oppositeDirection[lastMove.direction]
  ) {
    const fromEl = lastMove.from;
    // Clear the memory after using it.
    lastMove = null;
    setFocus(currentEl, fromEl, direction, "reversal");
    return null; // We handled it.
  }

  // On any other navigation attempt, clear the "go back" memory.
  // It will be re-set in `setFocus` if this navigation is successful.
  lastMove = null;

  // --- Step 1: Handle explicit navigation rules ---
  // First, check if a specific rule is registered for this element and direction.
  // This allows for custom, non-spatial navigation (e.g., from a text field to its copy button).
  const elementRules = rules.get(currentEl);
  if (elementRules && elementRules[direction]) {
    const result = elementRules[direction]!();
    if (result) {
      // The rule returned an element. Navigate to it and stop.
      setFocus(currentEl, result, direction as Direction, "rule");
      return null;
    }
    if (result === null) {
      // The rule explicitly returned null. Stop all navigation.
      return null;
    }
    // The rule returned undefined. Fall through to default spatial logic.
  }

  // Home/End keys are only handled by explicit rules. If none were found, do nothing.
  if (direction === "home" || direction === "end") {
    return null;
  }

  const currentSection = getSection(currentEl);
  if (!currentSection) return null;

  let nextEl: HTMLElement | null = null;

  // --- Step 2: Spatial navigation within the current section ---
  // Try to find the geometrically closest element in the desired direction
  // within the same navigation section (e.g., inside the same OTP card).
  const sectionNavigables = getSectionNavigables(currentSection);
  nextEl = findClosestNavigableElement(currentEl, direction, sectionNavigables);

  // --- Step 3: Fallback Navigation ---
  // If no spatial match was found within the section, try a fallback strategy.
  if (!nextEl) {
    if (direction === "up" || direction === "down") {
      // For up/down, try a spatial search on the next available section.
      const allSections = getNavigableSections();
      const currentSectionIndex = allSections.indexOf(currentSection);

      if (currentSectionIndex !== -1) {
        const step = direction === "down" ? 1 : -1;
        let nextSectionIndex = currentSectionIndex + step;

        while (nextSectionIndex >= 0 && nextSectionIndex < allSections.length) {
          const nextSection = allSections[nextSectionIndex];
          const nextSectionNavigables = getSectionNavigables(nextSection);

          if (nextSectionNavigables.length > 0) {
            nextEl = findClosestNavigableElement(
              currentEl,
              direction,
              nextSectionNavigables
            );
            if (nextEl) break; // Found a target
          }
          nextSectionIndex += step;
        }
      }
    } else if (direction === "left" || direction === "right") {
      // For left/right, fall back to sequential DOM order. This handles wrapping.
      const allNavigables = Array.from(
        document.querySelectorAll<HTMLElement>(".navigable")
      ).filter((el) => el.offsetParent !== null); // Only visible elements

      const currentIndex = allNavigables.indexOf(currentEl);
      if (currentIndex !== -1) {
        const step = direction === "right" ? 1 : -1;
        const nextIndex =
          (currentIndex + step + allNavigables.length) % allNavigables.length;

        if (allNavigables.length > 1) {
          nextEl = allNavigables[nextIndex];
        }
      }
    }
  }

  // --- Step 4: Apply prioritizers ---
  // Before focusing the chosen element, check if a prioritizer wants to
  // intercept and redirect focus to a different element (e.g., always focus
  // the 'active' tab when entering the tab group).
  if (nextEl) {
    for (const prioritizer of prioritizers) {
      // For now, we only pass the single best candidate. This could be expanded.
      const prioritizedEl = prioritizer([nextEl], direction, currentEl);
      if (prioritizedEl) {
        setFocus(currentEl, prioritizedEl, direction, "prioritizer");
        return null; // Prioritizer handled focus, so we stop here.
      }
    }
  }

  // --- Step 5: Set focus ---
  // If a next element was found and not handled by a prioritizer, focus it.
  if (nextEl) {
    setFocus(currentEl, nextEl, direction);
  }

  return null; // Let the keydown handler know we handled it.
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const key = event.key;

  // --- Handle initial keyboard navigation entry ---
  // This listener should only act when no element has focus, or the body has focus.
  // Once an element has focus, this listener will ignore subsequent key presses.
  if (target === document.body) {
    // On Down or Right arrow, focus the first interactive element.
    if (key === "ArrowDown" || key === "ArrowRight") {
      event.preventDefault();
      // The currently active tab is a good initial target.
      const activeTab = $<HTMLButtonElement>("#info-tabs .tab-button.active");
      activeTab?.focus();
    }
    // After the initial interaction, subsequent keydowns on the body are ignored
    // until an element is focused, at which point this block is skipped.
    return;
  }

  // --- Check for specific, non-directional key action rules first ---
  // This allows components to define custom behavior for keys like 'Escape'.
  const elementActionRules = keyActionRules.get(target);
  if (elementActionRules && elementActionRules[key.toLowerCase()]) {
    event.preventDefault();
    const nextEl = elementActionRules[key.toLowerCase()]!();
    setFocus(target, nextEl, undefined, "rule");
    return; // Action handled, stop further processing.
  }

  if (
    key === "Escape" &&
    document.activeElement &&
    document.activeElement !== document.body
  ) {
    (document.activeElement as HTMLElement).blur();
    return;
  }

  // --- Activation ---
  if (key === "Enter" || key === " ") {
    event.preventDefault();
    if (target.closest(".secret-container, .otp-url-container")) {
      handleCopyAction(target);
    } else {
      target.click();
    }
    return; // Activation should not also cause navigation
  }

  if (key.startsWith("Arrow")) {
    const direction = key.substring(5).toLowerCase() as Direction;
    event.preventDefault();
    findNext(target, direction);
  } else if (key === "Home" || key === "End") {
    // Keep Home/End for component-specific rules
    event.preventDefault();
    findNext(target, key.toLowerCase() as "home" | "end");
  }
}

export const Navigation = {
  /**
   * Registers a specific navigation rule.
   * @param from The element to navigate from.
   * @param direction The direction of navigation.
   * @param to A function that returns the element to navigate to.
   */
  registerRule(
    from: HTMLElement,
    direction: NavDirection,
    to: NavigationRule
  ): void {
    if (!rules.has(from)) {
      rules.set(from, {});
    }
    rules.get(from)![direction] = to;
  },

  /**
   * Registers a rule for a specific, non-directional key press.
   * This is ideal for handling keys like 'Escape' within a component's context.
   * @param from The element to navigate from.
   * @param key The key to listen for (e.g., 'escape', 'tab'). Case-insensitive.
   * @param to A function that returns the element to navigate to.
   */
  registerKeyAction(from: HTMLElement, key: string, to: KeyActionRule): void {
    if (!keyActionRules.has(from)) {
      keyActionRules.set(from, {});
    }
    // Store the key in lower case for case-insensitive matching.
    keyActionRules.get(from)![key.toLowerCase()] = to;
  },

  /**
   * Registers a function to prioritize a specific candidate during spatial navigation.
   * @param prioritizer The function to run against navigation candidates.
   */
  registerPrioritizer(prioritizer: Prioritizer): void {
    prioritizers.push(prioritizer);
  },

  /**
   * Resets the "go back" navigation memory. This should be called
   * whenever the DOM is significantly manipulated (e.g. adding or removing
   * elements), which could make the last navigation move obsolete.
   */
  resetLastMove(): void {
    lastMove = null;
  },

  /**
   * The main keyboard navigation handler for the entire application.
   */
  handleKeydown,
};

export function initNavigation(): void {
  document.addEventListener("keydown", Navigation.handleKeydown);

  // When focus leaves a text field, unselect its content and reset scroll.
  document.addEventListener("focusout", (event) => {
    const target = event.target as HTMLInputElement;
    if (target.matches && target.matches(".secret-input, .url-input")) {
      // Collapse the selection to the start of the input field. This is a more
      // reliable way to "unselect" text in an input than using window.getSelection().
      target.selectionStart = target.selectionEnd = 0;
      target.scrollLeft = 0;
    }
  });
}
