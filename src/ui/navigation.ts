import { $ } from "./dom";
import { copyToClipboard } from "./clipboard";

type Direction = "up" | "down" | "left" | "right";
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

/**
 * Briefly highlights an element to provide visual feedback for navigation events.
 * @param el The element to highlight.
 * @param color The color to use for the highlight.
 */
function highlightFocus(el: HTMLElement, color: string) {
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

function findClosestNavigableElement(
  currentEl: HTMLElement,
  direction: Direction,
  candidates: HTMLElement[]
): HTMLElement | null {
  const allNavigables = candidates.filter((el) => el !== currentEl);

  const currentRect = currentEl.getBoundingClientRect();

  let filteredCandidates: HTMLElement[] = [];
  const tolerance = 1; // Use a 1px tolerance for geometric calculations
  switch (direction) {
    case "down":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().top > currentRect.bottom - tolerance
      );
      break;
    case "up":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().bottom < currentRect.top + tolerance
      );
      break;
    case "right":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().left > currentRect.right - tolerance
      );
      break;
    case "left":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().right < currentRect.left + tolerance
      );
      break;
  }

  if (filteredCandidates.length === 0) {
    return null;
  }

  const getDistanceOnCrossAxis = (rect: DOMRect): number => {
    if (direction === "up" || direction === "down") {
      const currentCenter = currentRect.left + currentRect.width / 2;
      const targetCenter = rect.left + rect.width / 2;
      return Math.abs(currentCenter - targetCenter);
    } else {
      const currentCenter = currentRect.top + currentRect.height / 2;
      const targetCenter = rect.top + rect.height / 2;
      return Math.abs(currentCenter - targetCenter);
    }
  };

  const getDistanceOnPrimaryAxis = (rect: DOMRect): number => {
    switch (direction) {
      case "up":
        return currentRect.top - rect.bottom;
      case "down":
        return rect.top - currentRect.bottom;
      case "left":
        return currentRect.left - rect.right;
      case "right":
        return rect.left - currentRect.right;
    }
  };

  filteredCandidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const primaryDistA = getDistanceOnPrimaryAxis(rectA);
    const crossDistA = getDistanceOnCrossAxis(rectA);
    const scoreA = primaryDistA + crossDistA * 2; // Weight alignment more heavily

    const rectB = b.getBoundingClientRect();
    const primaryDistB = getDistanceOnPrimaryAxis(rectB);
    const crossDistB = getDistanceOnCrossAxis(rectB);
    const scoreB = primaryDistB + crossDistB * 2;

    return scoreA - scoreB;
  });

  return filteredCandidates[0] || null;
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
    currentEl.tabIndex = -1;
  }
  nextEl.tabIndex = 0;
  nextEl.focus();

  // If this was a directional move, record it.
  if (direction && currentEl) {
    lastMove = { from: currentEl, to: nextEl, direction };
  } else {
    // Any non-directional focus change (e.g. from a key action) should clear the memory.
    lastMove = null;
  }

  if (reason === "rule") {
    highlightFocus(nextEl, "rgba(255, 0, 0, 0.7)"); // Red for custom rule
  } else if (reason === "prioritizer") {
    highlightFocus(nextEl, "rgba(0, 255, 0, 0.7)"); // Green for prioritizer
  } else if (reason === "reversal") {
    highlightFocus(nextEl, "rgba(255, 165, 0, 0.7)"); // Orange for reversal
  }
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
    direction !== "home" &&
    direction !== "end" &&
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
    if (target.matches(".secret-input, .url-input")) {
      const inputElement = target as HTMLInputElement;
      const button = inputElement.parentElement?.querySelector(".copy-button");
      if (button) {
        copyToClipboard(inputElement.value, button as HTMLElement);
      }
    } else if (target.matches(".copy-button")) {
      const input = target.parentElement?.querySelector(
        "input"
      ) as HTMLInputElement;
      if (input) {
        copyToClipboard(target.dataset.copyText || input.value, target);
      }
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
}
