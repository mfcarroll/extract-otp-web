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

/**
 * Generic helper to query the DOM for multiple elements.
 * @param selector The CSS selector for the elements.
 * @returns A static NodeListOf the found HTMLElements.
 */
export function $all<T extends HTMLElement>(selector: string): NodeListOf<T> {
  return document.querySelectorAll<T>(selector);
}
