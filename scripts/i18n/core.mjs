/**
 * Build-time translation support.
 *
 * English is written once: page text in index.html (elements marked with
 * data-i18n / data-i18n-attr) and runtime messages in src/i18n/en.json. Each
 * other language is one file, src/i18n/translations/<code>.json, found by
 * scanning that folder, so adding a language touches no shared file:
 *
 *   {
 *     "language": {
 *       "name": "Français", "lang": "fr-CA", "hreflang": "fr", "published": false,
 *       "contributors": [{ "name": "…", "github": "…", "url": "https://…" }]
 *     },
 *     "page":     { "<key>": { "source": "<hash>", "text": "..." } },
 *     "messages": { "<key>": { "source": "<hash>", "text": "..." | { "one": ..., "other": ... } } }
 *   }
 *
 * `source` is a fingerprint of the English each translation was made from, so
 * edits to the English show up as stale translations.
 *
 * Translations are contributor-supplied, so the markup they may contain is
 * limited to a small allowlist, and links may only point where the English
 * already does.
 */
import { createHash } from 'node:crypto';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

export const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..'
);
const I18N_DIR = path.join(ROOT, 'src/i18n');

const TRANSLATIONS_DIR = path.join(I18N_DIR, 'translations');

/**
 * Site settings plus every language: English from src/i18n/config.json, then
 * one per translation file, in order of language code. A published
 * language's page is at <base><code>/; a draft's is at <base>draft/<code>/,
 * built but not linked from published pages.
 */
export function loadConfig() {
  const config = JSON.parse(
    readFileSync(path.join(I18N_DIR, 'config.json'), 'utf8')
  );
  const english = {
    ...config.english,
    code: config.defaultLocale,
    path: '',
    published: true,
  };
  const codes = existsSync(TRANSLATIONS_DIR)
    ? readdirSync(TRANSLATIONS_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => file.slice(0, -'.json'.length))
        .sort()
    : [];
  const others = codes.map((code) => {
    if (!/^[a-z]{2,3}(-[a-z0-9]+)*$/.test(code)) {
      throw new Error(
        `Translation file name "${code}.json" is not a language code`
      );
    }
    const { language } = loadTranslations(code);
    if (!language?.name || !language?.lang) {
      throw new Error(
        `${code}.json needs a "language" block with "name" and "lang"`
      );
    }
    return {
      code,
      name: language.name,
      lang: language.lang,
      hreflang: language.hreflang ?? language.lang,
      path: language.published === true ? `${code}/` : `draft/${code}/`,
      published: language.published === true,
      contributors: validateContributors(code, language.contributors ?? []),
    };
  });
  return {
    siteUrl: config.siteUrl,
    defaultLocale: config.defaultLocale,
    locales: [english, ...others],
  };
}

export function loadEnglishMessages() {
  return JSON.parse(readFileSync(path.join(I18N_DIR, 'en.json'), 'utf8'));
}

/**
 * People credited for a translation, shown using the most personal details
 * they give: their name if provided (otherwise their GitHub username),
 * linked to their `url` if provided (otherwise their GitHub profile).
 * A url needs a name or username to show, so a bare link is never shown.
 */
export function validateContributors(code, contributors) {
  if (!Array.isArray(contributors)) {
    throw new Error(`${code}.json: "contributors" must be a list`);
  }
  // Empty fields count as absent, and an entry with nothing filled in is
  // skipped, so a blank { "name": "", "github": "", "url": "" } is a template.
  const filled = contributors.map((entry) =>
    Object.fromEntries(
      Object.entries(entry ?? {})
        .map(([key, value]) => [
          key,
          typeof value === 'string' ? value.trim() : value,
        ])
        .filter(
          ([, value]) => value !== '' && value !== undefined && value !== null
        )
    )
  );
  return filled.flatMap((c, i) => {
    if (!Object.keys(c).length) return [];
    const where = `${code}.json contributor ${i + 1}`;
    if (
      c.github !== undefined &&
      !/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/.test(c.github)
    ) {
      throw new Error(`${where}: "${c.github}" is not a GitHub username`);
    }
    if (c.url !== undefined && !/^https:\/\/[^\s"<>]+$/.test(c.url)) {
      throw new Error(`${where}: url must start with https://`);
    }
    const name = c.name || c.github;
    if (!name) {
      throw new Error(`${where}: needs a name or github to show`);
    }
    const url = c.url ?? (c.github ? `https://github.com/${c.github}` : null);
    return [{ name, url }];
  });
}

export function translationPath(code) {
  return path.join(TRANSLATIONS_DIR, `${code}.json`);
}

export function loadTranslations(code) {
  const file = translationPath(code);
  if (!existsSync(file)) return { language: null, page: {}, messages: {} };
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return {
    language: data.language ?? null,
    page: data.page ?? {},
    messages: data.messages ?? {},
  };
}

/** Collapses whitespace the way HTML rendering does, so formatting changes don't count as edits. */
export function normalize(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function fingerprint(value) {
  const text =
    typeof value === 'string' ? normalize(value) : JSON.stringify(value);
  return createHash('sha256').update(text).digest('hex').slice(0, 10);
}

/** The document plus the contents of each <template>, which querySelectorAll does not reach. */
function roots(document) {
  return [
    document,
    ...[...document.querySelectorAll('template')].map((t) => t.content),
  ];
}

function* annotated(document) {
  for (const root of roots(document)) {
    for (const el of root.querySelectorAll('[data-i18n]')) {
      yield { el, key: el.getAttribute('data-i18n'), attr: null };
    }
    for (const el of root.querySelectorAll('[data-i18n-attr]')) {
      for (const pair of el.getAttribute('data-i18n-attr').split(';')) {
        const [attr, key] = pair.split(':').map((s) => s.trim());
        if (attr && key) yield { el, key, attr };
      }
    }
  }
}

/**
 * Extracts the English page strings from index.html.
 * Returns Map<key, { text, markup }> where `markup` is true for HTML content.
 * Throws if one key is used for different English text.
 */
export function extractPageSource(html) {
  const { document } = new JSDOM(html).window;
  const source = new Map();
  for (const { el, key, attr } of annotated(document)) {
    const text = normalize(attr ? (el.getAttribute(attr) ?? '') : el.innerHTML);
    const entry = { text, markup: !attr && el.children.length > 0 };
    const existing = source.get(key);
    if (existing && existing.text !== text) {
      throw new Error(
        `Key "${key}" is used for different English text:\n  ${existing.text}\n  ${text}`
      );
    }
    source.set(key, entry);
  }
  return source;
}

// --- Validation ---

const INLINE_TAGS = new Set(['A', 'STRONG', 'EM', 'CODE', 'BR']);
const LINK_ATTRS = new Set(['href', 'target', 'rel', 'aria-label']);

function links(fragment) {
  return new Set(
    [...fragment.querySelectorAll('a')].map((a) => a.getAttribute('href'))
  );
}

function parseFragment(html) {
  const { document } = new JSDOM('').window;
  const template = document.createElement('template');
  template.innerHTML = html;
  return template.content;
}

/**
 * Checks one page translation against its English source. Returns a list of
 * problems (empty when valid).
 */
export function validatePageText(translation, english) {
  const problems = [];
  if (typeof translation !== 'string' || !translation.trim())
    return ['empty translation'];

  const fragment = parseFragment(translation);
  const elements = [...fragment.querySelectorAll('*')];
  if (!english.markup) {
    if (elements.length > 0)
      problems.push('markup is not allowed here (the English is plain text)');
    return problems;
  }

  const allowedLinks = links(parseFragment(english.text));
  for (const el of elements) {
    if (!INLINE_TAGS.has(el.tagName)) {
      problems.push(`<${el.tagName.toLowerCase()}> is not allowed`);
      continue;
    }
    for (const { name, value } of el.attributes) {
      if (el.tagName !== 'A' || !LINK_ATTRS.has(name)) {
        problems.push(
          `attribute ${name} on <${el.tagName.toLowerCase()}> is not allowed`
        );
      } else if (name === 'target' && value !== '_blank') {
        problems.push(`target="${value}" is not allowed`);
      }
    }
    if (el.tagName === 'A') {
      const href = el.getAttribute('href');
      if (!allowedLinks.has(href))
        problems.push(`link to ${href} does not appear in the English`);
      if (
        el.getAttribute('target') === '_blank' &&
        !/\bnoopener\b/.test(el.getAttribute('rel') ?? '')
      ) {
        problems.push(`link to ${href} opens a new tab without rel="noopener"`);
      }
    }
  }
  return problems;
}

function placeholders(text) {
  return [...text.matchAll(/\{(\w+)\}/g)]
    .map((m) => m[1])
    .sort()
    .join(',');
}

/** Checks one runtime message translation. `english` is the en.json value. */
export function validateMessage(translation, english, locale) {
  const problems = [];
  const forms =
    typeof translation === 'string' ? { other: translation } : translation;
  if (!forms || typeof forms !== 'object')
    return ['translation must be a string or plural forms'];
  if (typeof english === 'string' && typeof translation !== 'string') {
    return ['the English has no plural forms, so this must be a plain string'];
  }
  if (typeof english !== 'string' && typeof forms.other !== 'string') {
    problems.push('plural messages need an "other" form');
  }

  const categories = new Set(
    new Intl.PluralRules(locale).resolvedOptions().pluralCategories
  );
  const englishOther = typeof english === 'string' ? english : english.other;
  for (const [form, text] of Object.entries(forms)) {
    if (typeof text !== 'string' || !text.trim()) {
      problems.push(`form "${form}" is empty`);
      continue;
    }
    if (typeof translation !== 'string' && !categories.has(form)) {
      problems.push(`"${form}" is not a plural form in ${locale}`);
    }
    if (/[<>]/.test(text)) problems.push(`form "${form}" contains < or >`);
    // A form may drop {count} (as English "one" does), but may not introduce new placeholders.
    const allowed = new Set(
      placeholders(englishOther).split(',').filter(Boolean)
    );
    for (const name of placeholders(text).split(',').filter(Boolean)) {
      if (!allowed.has(name)) problems.push(`unknown placeholder {${name}}`);
    }
  }
  if (
    typeof english === 'string' &&
    placeholders(english) !== placeholders(forms.other)
  ) {
    problems.push(
      `placeholders differ from the English (${placeholders(english) || 'none'})`
    );
  }
  return problems;
}

/**
 * Compares a language's translations with the current English.
 * Returns { missing, stale, unknown, invalid } lists of { area, key, detail }.
 */
export function auditLocale(
  code,
  lang,
  { pageSource, englishMessages, translations }
) {
  const report = { missing: [], stale: [], unknown: [], invalid: [] };
  const areas = [
    [
      'page',
      pageSource,
      (entry) => entry.text,
      (tr, en) => validatePageText(tr, en),
    ],
    [
      'messages',
      new Map(Object.entries(englishMessages)),
      (en) => en,
      (tr, en) => validateMessage(tr, en, lang),
    ],
  ];
  for (const [area, english, sourceOf, validate] of areas) {
    const entries = translations[area];
    for (const [key, en] of english) {
      const entry = entries[key];
      if (!entry) {
        report.missing.push({ area, key, detail: sourceOf(en) });
        continue;
      }
      const problems = validate(entry.text, en);
      if (problems.length)
        report.invalid.push({ area, key, detail: problems.join('; ') });
      if (entry.source !== fingerprint(sourceOf(en)))
        report.stale.push({ area, key, detail: sourceOf(en) });
    }
    for (const key of Object.keys(entries)) {
      if (!english.has(key)) report.unknown.push({ area, key, detail: '' });
    }
  }
  return report;
}

// --- Rendering ---

export function pageUrl(config, locale) {
  return new URL(locale.path, config.siteUrl).href;
}

function escapeJsonForScript(value) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Produces the page for one language from the (English) built index.html.
 *
 * `visible` are the languages to link to from the switcher and hreflang tags.
 * Untranslated or invalid strings stay in English.
 */
export function renderPage(
  html,
  { config, base, locale, visible, translations, pageSource, englishMessages }
) {
  const dom = new JSDOM(html);
  const { document } = dom.window;

  if (translations) {
    for (const { el, key, attr } of annotated(document)) {
      const english = pageSource.get(key);
      const entry = translations.page[key];
      if (!english || !entry || validatePageText(entry.text, english).length)
        continue;
      if (attr) el.setAttribute(attr, entry.text);
      else el.innerHTML = entry.text;
    }

    const messages = {};
    for (const [key, entry] of Object.entries(translations.messages)) {
      if (
        key in englishMessages &&
        !validateMessage(entry.text, englishMessages[key], locale.lang).length
      ) {
        messages[key] = entry.text;
      }
    }
    const script = document.createElement('script');
    script.type = 'application/json';
    script.id = 'i18n-messages';
    script.textContent = escapeJsonForScript(messages);
    document.head.appendChild(script);
  }

  document.documentElement.lang = locale.lang;

  // Search engines: canonical URL, the other language versions, and no
  // indexing for languages that have not been published yet.
  const head = document.head;
  head
    .querySelectorAll('link[rel="canonical"], link[rel="alternate"][hreflang]')
    .forEach((n) => n.remove());
  const addLink = (attrs) => {
    const link = document.createElement('link');
    for (const [name, value] of Object.entries(attrs))
      link.setAttribute(name, value);
    head.appendChild(link);
  };
  addLink({ rel: 'canonical', href: pageUrl(config, locale) });
  const published = config.locales.filter((l) => l.published);
  if (locale.published && published.length > 1) {
    for (const l of published)
      addLink({
        rel: 'alternate',
        hreflang: l.hreflang,
        href: pageUrl(config, l),
      });
    const fallback = config.locales.find(
      (l) => l.code === config.defaultLocale
    );
    addLink({
      rel: 'alternate',
      hreflang: 'x-default',
      href: pageUrl(config, fallback),
    });
  }
  if (!locale.published) {
    document.getElementById('draft-banner')?.removeAttribute('hidden');
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex';
    head.appendChild(robots);
  }

  // Credit translators of the languages this page links to. Built with DOM
  // methods, so names and URLs from translation files are never parsed as HTML.
  const credits = document.getElementById('translation-credits');
  if (credits) {
    const people = new Map();
    for (const l of visible) {
      for (const person of l.contributors ?? []) {
        const id = `${person.name}|${person.url}`;
        if (!people.has(id)) people.set(id, { ...person, languages: [] });
        people.get(id).languages.push(l.name);
      }
    }
    if (people.size) {
      // Chinese and Japanese use full-width punctuation and no spaces.
      const cjk = /^(zh|ja)\b/.test(locale.lang);
      const p = cjk
        ? { lead: '', sep: '、', open: '（', close: '）', end: '。', and: '、' }
        : { lead: ' ', sep: ', ', open: ' (', close: ')', end: '.', and: ', ' };
      credits.removeAttribute('hidden');
      // Drop formatting whitespace after the label so `lead` controls spacing.
      while (
        credits.lastChild?.nodeType === 3 &&
        !credits.lastChild.textContent.trim()
      ) {
        credits.lastChild.remove();
      }
      [...people.values()].forEach((person, i) => {
        credits.append(i === 0 ? p.lead : p.sep);
        let name = document.createElement('span');
        if (person.url) {
          name = document.createElement('a');
          name.href = person.url;
          name.target = '_blank';
          name.rel = 'noopener noreferrer';
        }
        name.textContent = person.name;
        credits.append(name, p.open + person.languages.join(p.and) + p.close);
      });
      credits.append(p.end);
    }
  }

  const switcher = document.getElementById('language-switcher');
  if (switcher && visible.length > 1) {
    switcher.removeAttribute('hidden');
    const parts = ['<span class="footer-separator">|</span>'];
    visible.forEach((l, i) => {
      if (i > 0)
        parts.push(
          '<span class="language-separator" aria-hidden="true">·</span>'
        );
      const current = l.code === locale.code ? ' aria-current="page"' : '';
      const draft = l.published ? '' : ' data-draft="true"';
      parts.push(
        `<a class="navigable" href="${base}${l.path}" hreflang="${l.hreflang}" lang="${l.lang}"${current}${draft}>${l.name}</a>`
      );
    });
    switcher.innerHTML = parts.join('');
  }

  return dom.serialize();
}
