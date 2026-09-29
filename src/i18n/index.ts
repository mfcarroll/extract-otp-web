/**
 * Runtime translation for messages the app shows while running (upload log
 * entries, errors, screen reader announcements).
 *
 * English is bundled as the fallback. Each translated page is generated at
 * build time with its own messages embedded as JSON in
 * `<script type="application/json" id="i18n-messages">`, and its language in
 * `<html lang>`, so there is no language state to manage here. Page content is
 * translated at build time; see scripts/i18n.
 */
import en from './en.json';

export type MessageKey = keyof typeof en;
type PluralForms = Partial<Record<Intl.LDMLPluralRule, string>>;
type Message = string | PluralForms;
type Vars = Record<string, string | number>;

let catalogue: { locale: string; messages: Partial<Record<string, Message>> };

function getCatalogue(): typeof catalogue {
  if (catalogue) return catalogue;
  catalogue = { locale: 'en', messages: {} };
  if (typeof document === 'undefined') return catalogue;

  catalogue.locale = document.documentElement.lang || 'en';
  const embedded = document.getElementById('i18n-messages');
  if (embedded?.textContent) {
    try {
      catalogue.messages = JSON.parse(embedded.textContent);
    } catch {
      // Fall back to English rather than fail to start.
    }
  }
  return catalogue;
}

function pickForm(message: Message, locale: string, vars?: Vars): string {
  if (typeof message === 'string') return message;
  const count = Number(vars?.count ?? 0);
  const form = new Intl.PluralRules(locale).select(count);
  return message[form] ?? message.other ?? '';
}

/**
 * Returns the message for `key` in the page's language, falling back to
 * English. `{name}` placeholders are replaced from `vars`; messages with
 * plural forms choose one using `vars.count`.
 */
export function t(key: MessageKey, vars?: Vars): string {
  const { locale, messages } = getCatalogue();
  const translated = messages[key];
  const text = translated
    ? pickForm(translated, locale, vars)
    : pickForm(en[key] as Message, 'en', vars);

  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    name in vars ? String(vars[name]) : match
  );
}
