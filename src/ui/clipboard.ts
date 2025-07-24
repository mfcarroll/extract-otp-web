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
      setTimeout(() => buttonElement.classList.remove("copied"), 1500);
    })
    .catch((err) => {
      console.error("Could not copy text: ", err);
    });
};
