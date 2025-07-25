import { Direction } from "./navigationTypes";

/**
 * Finds the closest navigable element using a line-of-sight projection model.
 * It prioritizes elements that are directly in the path of navigation.
 * @param currentEl The starting element.
 * @param direction The direction of navigation.
 * @param candidates The list of potential target elements.
 * @returns The best candidate element or null.
 */
export function findClosestElementByProjection(
  currentEl: HTMLElement,
  direction: Direction,
  candidates: HTMLElement[]
): HTMLElement | null {
  const allNavigables = candidates.filter((el) => el !== currentEl);
  if (allNavigables.length === 0) return null;

  const currentRect = currentEl.getBoundingClientRect();

  // 1. Filter candidates to only those in the general direction of navigation.
  let filteredCandidates: HTMLElement[] = [];
  const tolerance = 1; // Use a 1px tolerance for geometric calculations
  switch (direction) {
    case "down":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().top >= currentRect.bottom - tolerance
      );
      break;
    case "up":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().bottom <= currentRect.top + tolerance
      );
      break;
    case "right":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().left >= currentRect.right - tolerance
      );
      break;
    case "left":
      filteredCandidates = allNavigables.filter(
        (el) => el.getBoundingClientRect().right <= currentRect.left + tolerance
      );
      break;
  }

  if (filteredCandidates.length === 0) {
    return null;
  }

  const originX = currentRect.left + currentRect.width / 2;
  const originY = currentRect.top + currentRect.height / 2;

  // 2. Find candidates that intersect the projected line from the center.
  let intersectingCandidates: HTMLElement[] = [];
  if (direction === "up" || direction === "down") {
    intersectingCandidates = filteredCandidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      return originX >= rect.left && originX <= rect.right;
    });
  } else {
    // direction is "left" or "right"
    intersectingCandidates = filteredCandidates.filter((el) => {
      const rect = el.getBoundingClientRect();
      return originY >= rect.top && originY <= rect.bottom;
    });
  }

  // 3. If there are intersecting candidates, find the closest one.
  if (intersectingCandidates.length > 0) {
    intersectingCandidates.sort((a, b) => {
      const rectA = a.getBoundingClientRect();
      const rectB = b.getBoundingClientRect();
      let distA, distB;
      switch (direction) {
        case "up":
          distA = currentRect.top - rectA.bottom;
          distB = currentRect.top - rectB.bottom;
          break;
        case "down":
          distA = rectA.top - currentRect.bottom;
          distB = rectB.top - currentRect.bottom;
          break;
        case "left":
          distA = currentRect.left - rectA.right;
          distB = currentRect.left - rectB.right;
          break;
        case "right":
          distA = rectA.left - currentRect.right;
          distB = rectB.left - currentRect.right;
          break;
      }
      return distA - distB;
    });
    return intersectingCandidates[0];
  }

  // 4. If no direct intersection, find the element "closest" to the projected line.
  // This uses a scoring model similar to the original, but without the heavy
  // weighting on alignment, making it a good fallback.
  filteredCandidates.sort((a, b) => {
    const rectA = a.getBoundingClientRect();
    const rectB = b.getBoundingClientRect();

    let primaryDistA, primaryDistB, crossDistA, crossDistB;

    if (direction === "up" || direction === "down") {
      // Primary axis is Y, cross axis is X
      primaryDistA =
        direction === "up"
          ? currentRect.top - rectA.bottom
          : rectA.top - currentRect.bottom;
      primaryDistB =
        direction === "up"
          ? currentRect.top - rectB.bottom
          : rectB.top - currentRect.bottom;
      crossDistA = Math.abs(originX - (rectA.left + rectA.width / 2));
      crossDistB = Math.abs(originX - (rectB.left + rectB.width / 2));
    } else {
      // Primary axis is X, cross axis is Y
      primaryDistA =
        direction === "left"
          ? currentRect.left - rectA.right
          : rectA.left - currentRect.right;
      primaryDistB =
        direction === "left"
          ? currentRect.left - rectB.right
          : rectB.left - currentRect.right;
      crossDistA = Math.abs(originY - (rectA.top + rectA.height / 2));
      crossDistB = Math.abs(originY - (rectB.top + rectB.height / 2));
    }

    // A simple score combining primary and cross-axis distance.
    const scoreA = primaryDistA + crossDistA;
    const scoreB = primaryDistB + crossDistB;

    return scoreA - scoreB;
  });

  return filteredCandidates[0] || null;
}
