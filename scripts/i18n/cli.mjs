#!/usr/bin/env node
/**
 * Translation tooling.
 *
 *   npm run i18n -- add <code> <name> <lang> [hreflang]
 *                                    Start a new (draft) language, e.g.
 *                                    add fr Français fr-CA fr
 *   npm run i18n -- check            Validate every language (used in CI).
 *   npm run i18n -- todo <code>      Print the English for missing and stale
 *                                    strings, as JSON ready to translate.
 *   npm run i18n -- import <code> <file.json>
 *                                    Merge translations ({ "page": { key: text },
 *                                    "messages": { key: text } }) into the
 *                                    language file, recording which English
 *                                    each was translated from.
 *   npm run i18n -- review-export <code> [file.csv]
 *                                    Write a spreadsheet for reviewing a
 *                                    translation: where each string appears,
 *                                    the English, the translation, and columns
 *                                    for a suggested change and a comment.
 *   npm run i18n -- review-import <code> <file.csv>
 *                                    Apply the suggested changes (or edits to
 *                                    the translation column) from that sheet.
 *   npm run i18n -- critical <code>  Print the safety-critical strings
 *                                    (marked data-i18n-critical) with their
 *                                    translations, for a careful check.
 *   npm run i18n -- confirm <code|all> <key>...
 *                                    Mark translations as still correct after
 *                                    an English edit that doesn't affect them
 *                                    (a typo fix, say), clearing the warning.
 *
 * `check` fails on invalid, unknown or (for published languages) missing
 * strings. Stale strings, where the English changed after translation, are
 * reported as warnings.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  ROOT,
  auditLocale,
  extractPageSource,
  fingerprint,
  loadConfig,
  loadEnglishMessages,
  loadTranslations,
  translationPath,
  validateMessage,
  validatePageText,
} from './core.mjs';
import {
  COLUMNS,
  describePage,
  fromMarkers,
  parseCsv,
  reviewRows,
  toCsv,
} from './review.mjs';

const config = loadConfig();
const englishMessages = loadEnglishMessages();
const pageSource = extractPageSource(
  readFileSync(path.join(ROOT, 'index.html'), 'utf8')
);
const others = config.locales.filter((l) => l.code !== config.defaultLocale);

function findLocale(code) {
  const locale = others.find((l) => l.code === code);
  if (!locale) {
    console.error(
      `Unknown language "${code}". Known: ${others.map((l) => l.code).join(', ')}`
    );
    process.exit(1);
  }
  return locale;
}

function englishFor(area, key) {
  return area === 'page' ? pageSource.get(key)?.text : englishMessages[key];
}

function check() {
  let failed = false;
  for (const locale of others) {
    const report = auditLocale(locale.code, locale.lang, {
      pageSource,
      englishMessages,
      translations: loadTranslations(locale.code),
    });
    const total = pageSource.size + Object.keys(englishMessages).length;
    const { status } = locale;
    console.log(
      `\n${locale.name} (${locale.code}, ${status}): ${total - report.missing.length}/${total} translated`
    );

    const print = (label, items) => {
      if (!items.length) return;
      console.log(`  ${label} (${items.length}):`);
      for (const { area, key, detail } of items)
        console.log(`    ${area}:${key}${detail ? `  ${detail}` : ''}`);
    };
    print('ERROR invalid', report.invalid);
    print('ERROR unknown key', report.unknown);
    if (locale.published) print('ERROR missing', report.missing);
    else if (report.missing.length)
      console.log(
        `  missing (${report.missing.length}), allowed while in draft`
      );
    print(
      'warning: English changed since translation',
      report.stale.map((s) => ({ ...s, detail: '' }))
    );

    if (
      report.invalid.length ||
      report.unknown.length ||
      (locale.published && report.missing.length)
    ) {
      failed = true;
    }
  }
  if (!others.length) console.log('Only English is configured.');
  process.exit(failed ? 1 : 0);
}

function todo(code) {
  const locale = findLocale(code);
  const report = auditLocale(locale.code, locale.lang, {
    pageSource,
    englishMessages,
    translations: loadTranslations(locale.code),
  });
  const out = { page: {}, messages: {} };
  for (const { area, key } of [...report.missing, ...report.stale])
    out[area][key] = englishFor(area, key);
  console.log(JSON.stringify(out, null, 2));
}

function importFile(code, file) {
  const locale = findLocale(code);
  const incoming = JSON.parse(readFileSync(path.resolve(file), 'utf8'));
  const current = loadTranslations(locale.code);
  let problems = 0;
  for (const area of ['page', 'messages']) {
    for (const [key, text] of Object.entries(incoming[area] ?? {})) {
      const english =
        area === 'page' ? pageSource.get(key) : englishMessages[key];
      if (english === undefined) {
        console.error(`${area}:${key}: no such English string`);
        problems++;
        continue;
      }
      const issues =
        area === 'page'
          ? validatePageText(text, english)
          : validateMessage(text, english, locale.lang);
      if (issues.length) {
        console.error(`${area}:${key}: ${issues.join('; ')}`);
        problems++;
        continue;
      }
      current[area][key] = { source: fingerprint(englishFor(area, key)), text };
    }
  }
  if (problems) {
    console.error(`\nNot imported: ${problems} problem(s).`);
    process.exit(1);
  }
  save(locale.code, current);
  console.log(
    `Imported into ${path.relative(ROOT, translationPath(locale.code))}.`
  );
}

function save(code, translations) {
  const sorted = (entries) =>
    Object.fromEntries(
      Object.entries(entries).sort(([a], [b]) => a.localeCompare(b))
    );
  const output = {
    language: translations.language,
    page: sorted(translations.page),
    messages: sorted(translations.messages),
  };
  mkdirSync(path.dirname(translationPath(code)), { recursive: true });
  writeFileSync(translationPath(code), JSON.stringify(output, null, 2) + '\n');
}

function confirm(code, keys) {
  const locales = code === 'all' ? others : [findLocale(code)];
  let failed = false;
  for (const locale of locales) {
    const current = loadTranslations(locale.code);
    for (const key of keys) {
      const area = key in current.page ? 'page' : 'messages';
      const entry = current[area][key];
      const english = englishFor(area, key);
      if (!entry || english === undefined) {
        console.error(`${locale.code}: no translation for ${key}`);
        failed = true;
        continue;
      }
      entry.source = fingerprint(english);
      console.log(`${locale.code}: ${key} confirmed`);
    }
    save(locale.code, current);
  }
  process.exit(failed ? 1 : 0);
}

function addLanguage(code, name, lang, hreflang) {
  if (existsSync(translationPath(code))) {
    console.error(`${code}.json already exists.`);
    process.exit(1);
  }
  save(code, {
    language: {
      name,
      lang,
      hreflang: hreflang ?? lang,
      status: 'draft',
      contributors: [{ name: '', github: '', url: '' }],
    },
    page: {},
    messages: {},
  });
  console.log(
    `Created ${path.relative(ROOT, translationPath(code))}. Next: npm run i18n -- todo ${code}`
  );
}

function rowsFor(locale, translations) {
  const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const audit = auditLocale(locale.code, locale.lang, {
    pageSource,
    englishMessages,
    translations,
  });
  return reviewRows({
    html,
    locale,
    englishMessages,
    translations,
    audit: { ...audit, pageSource },
  });
}

function reviewExport(code, file) {
  const locale = findLocale(code);
  const rows = rowsFor(locale, loadTranslations(code));
  const header = [...COLUMNS];
  header[2] = `${locale.name} (current)`;
  const out = path.resolve(file ?? `translation-review-${code}.csv`);
  writeFileSync(out, toCsv([header, ...rows]));
  console.log(
    `Wrote ${rows.length} strings to ${path.relative(process.cwd(), out)}`
  );
}

function reviewImport(code, file) {
  const locale = findLocale(code);
  const current = loadTranslations(code);
  // IDs look like "page:key~fingerprint of the exported translation".
  const idOf = (cell) => (cell ?? '').trim().split('~');
  const exported = new Map(
    rowsFor(locale, current).map((row) => [idOf(row[6])[0], row])
  );
  const attrKeys = new Set(
    describePage(readFileSync(path.join(ROOT, 'index.html'), 'utf8'))
      .filter((d) => d.attr)
      .map((d) => d.key)
  );
  const [header, ...rows] = parseCsv(readFileSync(path.resolve(file), 'utf8'));
  const idColumn = header.findIndex((h) => h.startsWith('ID'));
  if (idColumn < 0) throw new Error('No ID column found in the sheet.');

  const changes = [];
  const comments = [];
  const problems = [];
  for (const row of rows) {
    const [id, exportedHash] = idOf(row[idColumn]);
    const original = exported.get(id);
    if (!original) {
      if (id) problems.push(`${id}: not a string in this translation`);
      continue;
    }
    const [where] = original;
    const suggested = row[3]?.trim();
    const edited = row[2]?.trim();
    // An edit to the translation column counts only if it differs from what
    // was exported, so re-importing an older sheet doesn't undo newer changes.
    const editedDirectly =
      exportedHash && fingerprint(edited ?? '') !== exportedHash;
    const value = suggested || (editedDirectly ? edited : '');
    if (row[4]?.trim()) comments.push(`${where}\n    ${row[4].trim()}`);
    if (!value) continue;

    const [area, rest] = id.split(':');
    const [key, form] = rest.split('#');
    try {
      if (area === 'page') {
        const english = pageSource.get(key);
        let text = value;
        if (!attrKeys.has(key)) {
          const translated = current.page[key]?.text;
          const sameLinks =
            translated &&
            (translated.match(/<a /g) ?? []).length ===
              (english.text.match(/<a /g) ?? []).length;
          text = fromMarkers(value, sameLinks ? translated : english.text);
        }
        const issues = validatePageText(text, english);
        if (issues.length) throw new Error(issues.join('; '));
        changes.push({ where, before: original[2], after: value });
        current.page[key] = { source: fingerprint(english.text), text };
      } else {
        const english = englishMessages[key];
        let text = value;
        if (form) {
          const existing = current.messages[key]?.text;
          text = {
            ...(typeof existing === 'object' ? existing : {}),
            [form]: value,
          };
        }
        const issues = validateMessage(text, english, locale.lang);
        if (
          issues.length &&
          !(form && issues.every((i) => i.includes('"other"')))
        ) {
          throw new Error(issues.join('; '));
        }
        changes.push({ where, before: original[2], after: value });
        current.messages[key] = { source: fingerprint(english), text };
      }
    } catch (error) {
      problems.push(`${where} (${id}): ${error.message}`);
    }
  }

  for (const { where, before, after } of changes) {
    console.log(`\n${where}\n  - ${before || '(missing)'}\n  + ${after}`);
  }
  if (comments.length) console.log(`\nComments:\n  ${comments.join('\n  ')}`);
  if (problems.length) {
    console.error(
      `\nNot imported, ${problems.length} problem(s):\n  ${problems.join('\n  ')}`
    );
    process.exit(1);
  }
  save(code, current);
  console.log(
    `\n${changes.length} change(s) applied to ${path.relative(ROOT, translationPath(code))}.`
  );
}

function critical(code) {
  const locale = findLocale(code);
  const { page } = loadTranslations(code);
  for (const [key, { text, critical }] of pageSource) {
    if (!critical) continue;
    console.log(
      `\n${key}\n  EN: ${text}\n  ${locale.code.toUpperCase()}: ${page[key]?.text ?? '(missing)'}`
    );
  }
}

const [command, ...args] = process.argv.slice(2);
if (command === 'add' && args.length >= 3) addLanguage(...args);
else if (command === 'check') check();
else if (command === 'todo' && args[0]) todo(args[0]);
else if (command === 'import' && args[0] && args[1])
  importFile(args[0], args[1]);
else if (command === 'review-export' && args[0]) reviewExport(args[0], args[1]);
else if (command === 'review-import' && args[0] && args[1])
  reviewImport(args[0], args[1]);
else if (command === 'critical' && args[0]) critical(args[0]);
else if (command === 'confirm' && args.length > 1)
  confirm(args[0], args.slice(1));
else {
  console.error(
    'Usage: npm run i18n -- add <code> <name> <lang> [hreflang] | check | todo <code> | import <code> <file.json> | review-export <code> [file.csv] | review-import <code> <file.csv> | critical <code> | confirm <code|all> <key>...'
  );
  process.exit(1);
}
