import { $ } from "./dom";
import { copyToClipboard } from "./results";

type Direction = "up" | "down" | "left" | "right";
type NavDirection = Direction | "home" | "end";
type NavigationRule = () => HTMLElement | null;
type KeyActionRule = () => HTMLElement | null;
type Prioritizer = (
  candidates: HTMLElement[],
  direction: Direction,
  from: HTMLElement
) => HTMLElement | null;

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
  reason?: "rule" | "prioritizer"
) {
  if (!nextEl) return;

  if (currentEl) {
    currentEl.tabIndex = -1;
  }
  nextEl.tabIndex = 0;
  nextEl.focus();

  if (reason === "rule") {
    highlightFocus(nextEl, "rgba(255, 0, 0, 0.7)"); // Red for custom rule
  } else if (reason === "prioritizer") {
    highlightFocus(nextEl, "rgba(0, 255, 0, 0.7)"); // Green for prioritizer
  }
}

function findNext(
  currentEl: HTMLElement,
  direction: NavDirection
): HTMLElement | null {
  // 1. Check for element-specific override rules first (Requirement 7)
  const elementRules = rules.get(currentEl);
  if (elementRules && elementRules[direction]) {
    const nextEl = elementRules[direction]!();
    if (nextEl) setFocus(currentEl, nextEl, "rule");
    return null; // Rule handled focus, so we return null to the keydown handler
  }

  // If no specific rule was found for Home/End, do nothing further.
  if (direction === "home" || direction === "end") {
    return null;
  }

  const currentSection = getSection(currentEl);
  if (!currentSection) return null;

  let nextEl: HTMLElement | null = null;

  // 2. Try to navigate spatially within the current section (Requirement 2)
  const sectionNavigables = getSectionNavigables(currentSection);
  nextEl = findClosestNavigableElement(currentEl, direction, sectionNavigables);

  // 3. Intra-section wrap-around for left/right (Requirement 3)
  if (!nextEl && (direction === "left" || direction === "right")) {
    const currentIndex = sectionNavigables.indexOf(currentEl);
    if (currentIndex !== -1) {
      const nextIndex =
        (currentIndex +
          (direction === "right" ? 1 : -1) +
          sectionNavigables.length) %
        sectionNavigables.length;
      if (sectionNavigables.length > 1) {
        nextEl = sectionNavigables[nextIndex];
      }
    }
  }

  // 4 & 5. If no element found, move to the next/previous section
  if (!nextEl) {
    const allSections = getNavigableSections();
    let currentSectionIndex = allSections.indexOf(currentSection);

    if (currentSectionIndex !== -1) {
      const step = direction === "down" || direction === "right" ? 1 : -1;
      let nextSectionIndex = currentSectionIndex + step;

      // Loop through sections until we find one with navigable items or run out of sections.
      while (nextSectionIndex >= 0 && nextSectionIndex < allSections.length) {
        const nextSection = allSections[nextSectionIndex];
        const nextSectionNavigables = getSectionNavigables(nextSection);

        if (nextSectionNavigables.length > 0) {
          if (direction === "up" || direction === "down") {
            // 5. Spatial move for vertical navigation
            nextEl = findClosestNavigableElement(
              currentEl,
              direction,
              nextSectionNavigables
            );
            // If spatial search fails, fall back to a sequential choice
            if (!nextEl) {
              nextEl =
                direction === "up"
                  ? nextSectionNavigables[nextSectionNavigables.length - 1]
                  : nextSectionNavigables[0];
            }
          } else {
            // 4. Sequential move for horizontal navigation
            nextEl =
              direction === "right"
                ? nextSectionNavigables[0]
                : nextSectionNavigables[nextSectionNavigables.length - 1];
          }
          // We found a target, so break the loop.
          break;
        }
        // If the section was empty, move to the next one in the same direction.
        nextSectionIndex += step;
      }
    }
  }

  // 6. Apply prioritizers to the potential next element (Requirement 6)
  if (nextEl) {
    for (const prioritizer of prioritizers) {
      // For now, we only pass the single best candidate. This could be expanded.
      const prioritizedEl = prioritizer([nextEl], direction, currentEl);
      if (prioritizedEl) {
        setFocus(currentEl, prioritizedEl, "prioritizer");
        return null; // Prioritizer handled focus
      }
    }
  }

  if (nextEl) {
    setFocus(currentEl, nextEl);
  }

  return null; // Let the keydown handler know we handled it.
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
    setFocus(target, nextEl, "rule");
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
   * The main keyboard navigation handler for the entire application.
   */
  handleKeydown,
};

export function initNavigation(): void {
  document.addEventListener("keydown", Navigation.handleKeydown);
}
