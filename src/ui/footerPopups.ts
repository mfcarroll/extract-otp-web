/**
 * The footer's pop-up controls (theme and language switchers) announce when
 * they open, so only one is ever open at a time.
 */
const EVENT = 'footer-popup-open';

export function announceOpen(id: string): void {
  document.dispatchEvent(new CustomEvent(EVENT, { detail: id }));
}

export function onOtherOpen(id: string, close: () => void): void {
  document.addEventListener(EVENT, (event) => {
    if ((event as CustomEvent<string>).detail !== id) close();
  });
}
