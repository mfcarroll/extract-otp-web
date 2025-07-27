import { announceToScreenReader } from "./notifications";

/**
 * Copies a string to the user's clipboard and provides visual feedback on a button.
 * @param text The text to copy.
 * @param buttonElement The button element that triggered the copy action.
 */
export const copyToClipboard = (
  text: string,
  buttonElement: HTMLElement
): void => {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      buttonElement.classList.add("copied");
      // Announce success to screen readers
      const subject = (
        buttonElement.getAttribute("aria-label") || "Content"
      ).replace("Copy ", "");
      announceToScreenReader(`${subject} copied to clipboard.`);
      setTimeout(() => buttonElement.classList.remove("copied"), 1500);
    })
    .catch((err) => {
      console.error("Could not copy text: ", err);
      // Announce failure to screen readers
      announceToScreenReader("Failed to copy to clipboard.");
    });
};

/**
 * Handles the logic for a copy action, whether triggered by mouse or keyboard.
 * It finds the relevant input and button, selects the text, and copies it.
 * @param triggerElement The element that initiated the copy action.
 */
export function handleCopyAction(triggerElement: HTMLElement): void {
  const container = triggerElement.closest(
    ".secret-container, .otp-url-container"
  );
  if (!container) return;

  const input = container.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    ".text-input"
  );
  const button = container.querySelector<HTMLButtonElement>(".copy-button");
  if (!input || !button) return;

  // Determine what text to copy. If the button itself (or its icon) was the
  // trigger, it might have a special `data-copy-text` attribute (for the URL).
  // Otherwise, just copy the input's visible value.
  const textToCopy = triggerElement.matches(".copy-button, .copy-button *")
    ? button.dataset.copyText || input.value
    : input.value;

  input.select();
  copyToClipboard(textToCopy, button);
}
