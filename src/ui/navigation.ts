import { $ } from "./dom";
import { copyToClipboard } from "./results";

type Direction = "up" | "down" | "left" | "right" | "home" | "end";
type NavigationRule = () => HTMLElement | null;
type KeyActionRule = () => HTMLElement | null;
type Prioritizer = (
  candidates: HTMLElement[],
  direction: Direction,
  from: HTMLElement
) => HTMLElement | null;

const rules = new Map<
  HTMLElement,
  Partial<Record<Direction, NavigationRule>>
>();
const keyActionRules = new Map<
  HTMLElement,
  Partial<Record<string, KeyActionRule>>
>();
const prioritizers: Prioritizer[] = [];

function findClosestNavigableElement(
  currentEl: HTMLElement,
  direction: Direction
): HTMLElement | null {
  const allNavigables = Array.from(
    document.querySelectorAll<HTMLElement>(".navigable")
  ).filter((el) => el !== currentEl && el.offsetParent !== null);

  const currentRect = currentEl.getBoundingClientRect();

  let candidates: HTMLElement[] = [];
  const tolerance = 1; // Use a 1px tolerance for geometric calculations
  switch (direction) {
    case "down":
      candidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().top >= currentRect.bottom - tolerance
      );
      break;
    case "up":
      candidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().bottom <= currentRect.top + tolerance
      );
      break;
    case "right":
      candidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().left >= currentRect.right - tolerance
      );
      break;
    case "left":
      candidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().right <= currentRect.left + tolerance
      );
      break;
  }

  if (candidates.length === 0) {
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
      // This case should not be reachable from `findClosestNavigableElement`,
      // but it makes the function exhaustive and satisfies the type checker.
      default:
        throw new Error(
          `Invalid direction for distance calculation: ${direction}`
        );
    }
  };

  candidates.sort((a, b) => {
    const distA = getDistanceOnPrimaryAxis(a.getBoundingClientRect());
    const distB = getDistanceOnPrimaryAxis(b.getBoundingClientRect());
    return distA - distB;
  });

  // --- Prioritizer Logic ---
  // Run prioritizers *after* sorting by primary distance. This allows a
  // prioritizer to add semantic meaning to the "closest" group of candidates,
  // preventing focus from jumping over entire sections.
  for (const prioritizer of prioritizers) {
    const prioritizedEl = prioritizer(candidates, direction, currentEl);
    // The prioritizer's choice must be one of the potential candidates.
    if (prioritizedEl && candidates.includes(prioritizedEl)) {
      return prioritizedEl;
    }
  }

  const minPrimaryDistance = getDistanceOnPrimaryAxis(
    candidates[0].getBoundingClientRect()
  );

  const threshold =
    direction === "up" || direction === "down"
      ? currentRect.height
      : currentRect.width;

  const band = candidates.filter((el) => {
    const primaryDist = getDistanceOnPrimaryAxis(el.getBoundingClientRect());
    return primaryDist < minPrimaryDistance + threshold;
  });

  band.sort((a, b) => {
    const crossDistA = getDistanceOnCrossAxis(a.getBoundingClientRect());
    const crossDistB = getDistanceOnCrossAxis(b.getBoundingClientRect());
    return crossDistA - crossDistB;
  });

  return band[0] || null;
}

function setFocus(currentEl: HTMLElement | null, nextEl: HTMLElement | null) {
  if (!nextEl) return;

  if (currentEl) {
    currentEl.tabIndex = -1;
  }
  nextEl.tabIndex = 0;
  nextEl.focus();
}

function findNext(
  currentEl: HTMLElement,
  direction: Direction
): HTMLElement | null {
  const elementRules = rules.get(currentEl);
  if (elementRules && elementRules[direction]) {
    return elementRules[direction]!();
  }

  // --- Fallback for Home/End if no specific rule is found ---
  if (direction === "home" || direction === "end") {
    const allNavigables = Array.from(
      document.querySelectorAll<HTMLElement>(".navigable")
    ).filter((el) => el.offsetParent !== null);
    if (allNavigables.length > 0) {
      return direction === "home"
        ? allNavigables[0]
        : allNavigables[allNavigables.length - 1];
    }
    return null;
  }

  // --- Fallback for Arrow keys ---
  let nextEl = findClosestNavigableElement(currentEl, direction);

  if (!nextEl && (direction === "left" || direction === "right")) {
    const allNavigables = Array.from(
      document.querySelectorAll<HTMLElement>(".navigable")
    ).filter((el) => el.offsetParent !== null);

    allNavigables.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      if (Math.abs(rectA.top - rectB.top) > 5) {
        return rectA.top - rectB.top;
      }
      return rectA.left - rectB.left;
    });

    const currentIndex = allNavigables.indexOf(currentEl);
    if (currentIndex !== -1) {
      const nextIndex =
        (currentIndex +
          (direction === "left" ? -1 : 1) +
          allNavigables.length) %
        allNavigables.length;
      nextEl = allNavigables[nextIndex];
    }
  }

  return nextEl;
}

function handleKeydown(event: KeyboardEvent) {
  const target = event.target as HTMLElement;
  const key = event.key;

  // --- NEW: Check for specific, non-directional key action rules first ---
  // This allows components to define custom behavior for keys like 'Escape'.
  const elementActionRules = keyActionRules.get(target);
  if (elementActionRules && elementActionRules[key.toLowerCase()]) {
    event.preventDefault();
    const nextEl = elementActionRules[key.toLowerCase()]!();
    setFocus(target, nextEl);
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

  let nextEl: HTMLElement | null = null;
  let direction: Direction | null = null;

  if (key.startsWith("Arrow")) {
    const direction = key.substring(5).toLowerCase() as Direction;
    event.preventDefault();
    nextEl = findNext(target, direction);
  } else if (key === "Home" || key === "End") {
    const direction = key.toLowerCase() as Direction;
    event.preventDefault();
    nextEl = findNext(target, direction);
  }

  if (nextEl) {
    setFocus(target, nextEl);
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
    direction: Direction,
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
   * The main keyboard navigation handler for the entire application.
   */
  handleKeydown,
};

export function initNavigation(): void {
  document.addEventListener("keydown", Navigation.handleKeydown);
}
