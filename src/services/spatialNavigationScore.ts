import { Direction } from "./navigationTypes";

/**
 * Finds the closest navigable element using a scoring system that heavily
 * prioritizes alignment on the cross-axis.
 * @param currentEl The starting element.
 * @param direction The direction of navigation.
 * @param candidates The list of potential target elements.
 * @returns The best candidate element or null.
 */
export function findClosestElementByScore(
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
