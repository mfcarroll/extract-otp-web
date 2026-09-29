#!/usr/bin/env node
/**
 * Translation tooling.
 *
 *   npm run i18n -- check            Validate every language (used in CI).
 *   npm run i18n -- todo <code>      Print the English for missing and stale
 *                                    strings, as JSON ready to translate.
 *   npm run i18n -- import <code> <file.json>
 *                                    Merge translations ({ "page": { key: text },
 *                                    "messages": { key: text } }) into the
 *                                    language file, recording which English
 *                                    each was translated from.
 *   npm run i18n -- confirm <code|all> <key>...
 *                                    Mark translations as still correct after
 *                                    an English edit that doesn't affect them
 *                                    (a typo fix, say), clearing the warning.
 *
 * `check` fails on invalid, unknown or (for published languages) missing
 * strings. Stale strings, where the English changed after translation, are
 * reported as warnings.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
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
    const status = locale.published ? 'published' : 'draft';
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

const [command, ...args] = process.argv.slice(2);
if (command === 'check') check();
else if (command === 'todo' && args[0]) todo(args[0]);
else if (command === 'import' && args[0] && args[1])
  importFile(args[0], args[1]);
else if (command === 'confirm' && args.length > 1)
  confirm(args[0], args.slice(1));
else {
  console.error(
    'Usage: npm run i18n -- check | todo <code> | import <code> <file.json> | confirm <code|all> <key>...'
  );
  process.exit(1);
}
