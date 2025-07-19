/**
 * Generic helper to query the DOM and throw an error if the element is not found.
 * @param selector The CSS selector for the element.
 * @returns The found HTMLElement.
 */
export function $<T extends HTMLElement>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element)
    throw new Error(`Element with selector "${selector}" not found.`);
  return element;
}
