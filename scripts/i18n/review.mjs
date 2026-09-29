/**
 * A spreadsheet (CSV) for reviewing a translation without touching JSON:
 * one row per string, in page order, with where it appears, the English, the
 * current translation, and columns for a suggested change and a comment.
 *
 * Markup is shown as simple markers ([b]...[/b], [link]...[/link]) so a
 * reviewer can't break it; links keep their existing targets on import.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT, fingerprint, normalize } from './core.mjs';

const MESSAGE_CONTEXT = JSON.parse(
  readFileSync(path.join(ROOT, 'scripts/i18n/message-context.json'), 'utf8')
);

export const COLUMNS = [
  'Where it appears',
  'English',
  'Current translation',
  'Suggested change',
  'Comment',
  'Status',
  'ID (please leave unchanged)',
];

// --- Where each page string appears ---

function text(el) {
  return normalize(el?.textContent ?? '');
}

function locationOf(el, attr, inTemplate) {
  const inside = (selector) => el.closest(selector);
  let where;
  if (el.tagName === 'TITLE') where = 'Browser tab and search result title';
  else if (el.tagName === 'META') where = 'Search result description';
  else if (inTemplate) where = 'Each extracted account';
  else if (inside('#draft-banner'))
    where = 'Banner shown on draft translations';
  else if (el.tagName === 'H1') where = 'Page heading';
  else if (inside('.tab-buttons')) where = 'Tab names';
  else if (inside('#tab-what')) where = 'Tab: What is this?';
  else if (inside('#tab-use')) {
    // The step (h3) and app (h4) headings that come before this element.
    let h3 = null;
    let h4 = null;
    for (const node of inside('#tab-use').querySelectorAll('*')) {
      if (node === el) {
        // A heading's own location is the section above it, not the previous one.
        if (el.tagName === 'H3') [h3, h4] = [null, null];
        if (el.tagName === 'H4') h4 = null;
        break;
      }
      if (node.tagName === 'H3') [h3, h4] = [node, null];
      if (node.tagName === 'H4') h4 = node;
    }
    where = ['Tab: How do I use it?', h3, h4]
      .filter(Boolean)
      .map((part) => (typeof part === 'string' ? part : text(part)))
      .join(' › ');
  } else if (inside('.faq-item')) {
    const question = inside('.faq-item').querySelector('.faq-title');
    where = inside('.faq-title') ? 'FAQ question' : `FAQ › ${text(question)}`;
  } else if (inside('.file-input-wrapper')) where = 'Main buttons';
  else if (inside('#results-container')) where = 'List of extracted accounts';
  else if (inside('#export-container'))
    where = 'Buttons below the extracted accounts';
  else if (inside('footer')) where = 'Footer';
  else if (inside('#camera-modal')) where = 'Camera scanner window';
  else if (inside('#manual-modal')) where = 'Enter Code window';
  else if (inside('#qr-modal')) where = 'Large QR code window';
  else where = 'Page';

  if (attr === 'placeholder') where += ' (placeholder text in the input box)';
  else if (attr?.startsWith('data-tooltip'))
    where += ' (tooltip on the copy button)';
  else if (attr === 'aria-label' || inside('.visually-hidden')) {
    where += ' (read aloud by screen readers)';
  }
  return where;
}

/** Page strings in the order they appear, with where each appears. */
export function describePage(html) {
  const { document } = new JSDOM(html).window;
  const out = new Map();
  const visit = (node, inTemplate) => {
    for (const el of node.children) {
      if (el.tagName === 'TEMPLATE') {
        visit(el.content, true);
        continue;
      }
      const key = el.getAttribute('data-i18n');
      if (key && !out.has(key)) {
        out.set(key, {
          key,
          where: locationOf(el, null, inTemplate),
          attr: false,
        });
      }
      for (const pair of (el.getAttribute('data-i18n-attr') ?? '').split(';')) {
        const [attr, attrKey] = pair.split(':').map((s) => s.trim());
        if (attr && attrKey && !out.has(attrKey)) {
          out.set(attrKey, {
            key: attrKey,
            where: locationOf(el, attr, inTemplate),
            attr: true,
          });
        }
      }
      visit(el, inTemplate);
    }
  };
  visit(document.documentElement, false);
  return [...out.values()];
}

// --- Markup <-> markers ---

const TAG_MARKERS = { STRONG: 'b', EM: 'i', CODE: 'code' };

function fragment(html) {
  const { document } = new JSDOM('').window;
  const template = document.createElement('template');
  template.innerHTML = html;
  return { document, content: template.content };
}

/** Converts stored HTML to reviewer-friendly text with markers. */
export function toMarkers(html) {
  const { content } = fragment(html);
  const linkCount = content.querySelectorAll('a').length;
  let n = 0;
  const walk = (node) =>
    [...node.childNodes]
      .map((child) => {
        if (child.nodeType === 3) return child.textContent;
        if (child.tagName === 'BR') return '[br]';
        if (child.tagName === 'A') {
          const name = linkCount > 1 ? `link${++n}` : 'link';
          return `[${name}]${walk(child)}[/${name}]`;
        }
        const marker = TAG_MARKERS[child.tagName];
        return marker ? `[${marker}]${walk(child)}[/${marker}]` : walk(child);
      })
      .join('');
  return normalize(walk(content));
}

const MARKER = /\[(\/?)(link\d*|b|i|code|br)\]/g;

/**
 * Converts reviewer text back to HTML. Links take their attributes, in order,
 * from `reference` (the current translation, else the English).
 */
export function fromMarkers(value, reference) {
  const { document, content } = fragment(reference);
  const links = [...content.querySelectorAll('a')];
  const root = document.createElement('div');
  const stack = [root];
  let last = 0;
  const top = () => stack[stack.length - 1];
  for (const match of value.matchAll(MARKER)) {
    top().append(value.slice(last, match.index));
    last = match.index + match[0].length;
    const [, closing, name] = match;
    if (name === 'br') {
      top().append(document.createElement('br'));
      continue;
    }
    if (closing) {
      if (top().dataset?.marker !== name)
        throw new Error(`[/${name}] doesn't match an opening marker`);
      delete top().dataset.marker;
      stack.pop();
      continue;
    }
    let el;
    if (name.startsWith('link')) {
      const index = name === 'link' ? 0 : Number(name.slice(4)) - 1;
      const source = links[index];
      if (!source)
        throw new Error(`[${name}] doesn't match a link in the English`);
      el = source.cloneNode(false);
    } else {
      el = document.createElement({ b: 'strong', i: 'em', code: 'code' }[name]);
    }
    el.dataset.marker = name;
    top().append(el);
    stack.push(el);
  }
  top().append(value.slice(last));
  if (stack.length > 1)
    throw new Error(`[${top().dataset.marker}] is never closed`);
  return normalize(root.innerHTML);
}

// --- CSV ---

export function toCsv(rows) {
  const cell = (value) => {
    const s = String(value ?? '');
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // The byte-order mark makes Excel read the file as UTF-8.
  return '﻿' + rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
}

export function parseCsv(input) {
  const s = input.replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell || row.length) rows.push([...row, cell]);
  return rows.filter((r) => r.some((value) => value.trim()));
}

// --- Rows ---

/**
 * Builds the review rows for one language. Each row is
 * [where, english, current, suggested, comment, status, id].
 */
export function reviewRows({
  html,
  locale,
  englishMessages,
  translations,
  audit,
}) {
  const status = new Map();
  for (const { area, key } of audit.missing)
    status.set(`${area}:${key}`, 'Missing');
  for (const { area, key } of audit.stale)
    status.set(`${area}:${key}`, 'English changed since translated');

  const rows = [];

  // Safety-critical strings come first, so a reviewer covers them even if
  // they don't get through everything.
  const described = describePage(html);
  const isCritical = (d) => Boolean(audit.pageSource.get(d.key)?.critical);
  const ordered = [
    ...described
      .filter(isCritical)
      .map((d) => ({ ...d, where: `★ Priority: ${d.where}` })),
    ...described.filter((d) => !isCritical(d)),
  ];
  for (const { key, where, attr } of ordered) {
    const englishHtml = audit.pageSource.get(key).text;
    const current = translations.page[key]?.text;
    const show = (value) =>
      value === undefined ? '' : attr ? value : toMarkers(value);
    rows.push([
      where,
      show(englishHtml),
      show(current),
      '',
      '',
      status.get(`page:${key}`) ?? '',
      `page:${key}`,
    ]);
  }

  // Plural forms the language uses for everyday numbers (French "many", for
  // example, only applies to round millions, so reviewers aren't asked for it).
  const rules = new Intl.PluralRules(locale.lang);
  const categories = rules
    .resolvedOptions()
    .pluralCategories.filter((form) =>
      Array.from({ length: 1001 }, (_, n) => rules.select(n)).includes(form)
    );
  for (const [key, english] of Object.entries(englishMessages)) {
    const where = MESSAGE_CONTEXT[key] ?? 'Message shown by the app';
    const current = translations.messages[key]?.text;
    const state = status.get(`messages:${key}`) ?? '';
    if (typeof english === 'string') {
      rows.push([
        where,
        english,
        current ?? '',
        '',
        '',
        state,
        `messages:${key}`,
      ]);
      continue;
    }
    for (const form of categories) {
      const label =
        categories.length > 1
          ? ` (${form === 'one' ? 'singular' : `plural form "${form}"`})`
          : '';
      rows.push([
        where + label,
        english[form] ?? english.other,
        typeof current === 'object' ? (current[form] ?? '') : '',
        '',
        '',
        state,
        `messages:${key}#${form}`,
      ]);
    }
  }
  // The ID records what the translation column held at export, so an edit
  // to that column can be told apart from a sheet that is simply out of date.
  return rows.map((row) => [
    ...row.slice(0, 6),
    `${row[6]}~${fingerprint(row[2])}`,
  ]);
}
