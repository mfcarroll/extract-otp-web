import { Navigation } from './navigation';
import { isMobile } from './viewport';
import { announceOpen, onOtherOpen } from './footerPopups';

/**
 * The footer language switcher: a disclosure button that shows a list of
 * links to the other language versions of the page (rendered at build time
 * by scripts/i18n). It follows the WAI disclosure navigation pattern, and
 * plugs into the app's keyboard navigation like the theme switcher.
 */
export function initLanguageSwitcher(): void {
  const nav = document.getElementById('language-switcher');
  const toggle = nav?.querySelector<HTMLButtonElement>('.language-toggle');
  const menu = nav?.querySelector<HTMLUListElement>('.language-menu');
  if (!nav || !toggle || !menu) return;

  const links = Array.from(menu.querySelectorAll<HTMLAnchorElement>('a'));
  const current =
    links.find((link) => link.getAttribute('aria-current') === 'page') ??
    links[0];

  const isOpen = () => toggle.getAttribute('aria-expanded') === 'true';

  const open = () => {
    if (!isOpen()) announceOpen('language');
    menu.hidden = false;
    toggle.setAttribute('aria-expanded', 'true');
  };

  const close = () => {
    menu.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
  };

  const openAndFocusCurrent = () => {
    open();
    return current;
  };

  const closeAndFocusToggle = () => {
    close();
    return toggle;
  };

  onOtherOpen('language', () => {
    if (isOpen()) close();
  });

  // On pointer devices, open on hover and close when the pointer leaves, as
  // the theme switcher does. A short delay forgives brief exits, and the menu
  // has a hover bridge over the gap to the button (see _footer.css).
  let closeTimer: number | undefined;
  nav.addEventListener('mouseenter', () => {
    if (isMobile()) return;
    window.clearTimeout(closeTimer);
    open();
  });
  nav.addEventListener('mouseleave', () => {
    if (isMobile()) return;
    closeTimer = window.setTimeout(() => {
      // Keep it open if keyboard focus is inside it.
      if (!nav.contains(document.activeElement)) close();
    }, 150);
  });

  toggle.addEventListener('click', (event: MouseEvent) => {
    if (isOpen()) {
      // On pointer devices the menu is already open from hovering, so a
      // mouse click keeps it open; keyboard activation still toggles.
      if (event.detail !== 0 && !isMobile()) return;
      close();
    } else {
      open();
      // Keyboard activation (Enter/Space arrive as a click with detail 0)
      // moves to the current language; a mouse click leaves focus on the button.
      if (event.detail === 0) current.focus();
    }
  });

  // Close when focus or a click moves outside the switcher.
  nav.addEventListener('focusout', (event) => {
    if (!nav.contains(event.relatedTarget as Node | null)) close();
  });
  document.addEventListener('click', (event) => {
    if (isOpen() && !nav.contains(event.target as Node)) close();
  });

  Navigation.registerKeyAction(toggle, 'arrowup', openAndFocusCurrent);
  Navigation.registerKeyAction(toggle, 'arrowdown', openAndFocusCurrent);

  links.forEach((link, index) => {
    const step = (offset: number) => () =>
      links[(index + offset + links.length) % links.length];
    Navigation.registerKeyAction(link, 'arrowup', step(-1));
    Navigation.registerKeyAction(link, 'arrowdown', step(1));
    Navigation.registerKeyAction(link, 'home', () => links[0]);
    Navigation.registerKeyAction(link, 'end', () => links[links.length - 1]);
    Navigation.registerKeyAction(link, 'escape', closeAndFocusToggle);
    Navigation.registerKeyAction(link, 'arrowleft', closeAndFocusToggle);
    Navigation.registerKeyAction(link, 'arrowright', closeAndFocusToggle);
  });
}
