# Contributing

Thank you for helping! Most contributions don't need any coding.

- [Translations](#translations): improve a translation, or add a new language
- [Reporting problems](#reporting-problems)
- [Code](#code)

## Translations

The tool is available in several languages. Each one is either:

- **Reviewed**: checked by a fluent speaker.
- **Machine-translated**: published with a short note saying so, until someone reviews it.
- **Draft**: still being worked on, and not yet linked from the site.

The language links at the bottom of the tool show which languages are published.

### Point out a wording problem

If something reads wrong, is confusing, or doesn't match the app, [open a translation request](https://github.com/mfcarroll/extract-otp-web/issues/new?template=translation.yml). Tell us the language, where you saw it, and what it should say. That's all.

### Review a whole translation

Reviewing is the most valuable help for a machine translation, and you don't need to touch any code:

1. [Open a translation request](https://github.com/mfcarroll/extract-otp-web/issues/new?template=translation.yml) saying which language you'd like to review, or contact the maintainer.
2. You'll get a spreadsheet (it opens in Google Sheets or Excel) with every piece of text in page order: where it appears, the English, the current translation, and columns for your **suggested change** and any **comment**. Links and bold text appear as markers, like `[link]this text is a link[/link]` or `[b]bold[/b]`. Keep the markers around the right words.
3. Open the page in your language alongside it, so you can see each piece of text in context.
4. Send the spreadsheet back. Your changes are applied, and you're credited on the tool's Acknowledgements page if you'd like to be.

The rows marked **★ Priority** come first. They're the safety wording (what the tool does with your data, and what to do with screenshots and saved files), so please check those most carefully, even if you don't get through the rest.

### Add a new language

[Open a translation request](https://github.com/mfcarroll/extract-otp-web/issues/new?template=translation.yml) for the language. A machine translation can be drafted to start from, and you can review it with the spreadsheet as above.

### If you use GitHub

You can also edit a language's file directly, `src/i18n/translations/<code>.json`, and GitHub will open a pull request for you. Each entry's `text` is the translation. Please leave the `source` values as they are; they record which English each translation was made from.

To be credited, add yourself to the `contributors` list at the top of the file. Each field is optional: your `name` (otherwise your `github` username is shown), and a `url` to link to (otherwise your GitHub profile). Empty fields are ignored.

## Reporting problems

[Open an issue](https://github.com/mfcarroll/extract-otp-web/issues/new/choose) describing what happened, what you expected, and your browser and device. **Never include real secrets, QR codes or screenshots of them**: they give full access to your accounts.

## Code

You'll need [Node.js](https://nodejs.org/) 22 or later.

```bash
git clone https://github.com/mfcarroll/extract-otp-web.git
cd extract-otp-web
npm install
npm run dev
```

Before opening a pull request, run the same checks as CI:

```bash
npm run check && npm run i18n -- check && npm test -- --run && npm run build
```

`npm run format` formats the code with Prettier.

### How translations work

English is written once:

- **Page text** lives in `index.html`. Each translatable element has a `data-i18n="key"` attribute, or `data-i18n-attr="attribute:key"` for attributes such as `aria-label` or `placeholder`. Elements marked `data-i18n-critical` hold safety wording and get extra checks.
- **Messages the app shows while running** (errors, upload log entries) live in `src/i18n/en.json`, and are used in code with `t('key')`. Messages with counts have plural forms, such as `one` and `other`.

Each other language is a single file, `src/i18n/translations/<code>.json`, found by scanning that folder, so adding a language changes no shared file. It starts with a `language` block:

```json
"language": {
  "name": "Français",
  "lang": "fr-CA",
  "hreflang": "fr",
  "status": "machine",
  "contributors": [{ "name": "", "github": "", "url": "" }]
}
```

The build generates a separate page for each language, so search engines index every language:

| `status`   | Page             | Linked and indexed | Notice                                              |
| ---------- | ---------------- | ------------------ | --------------------------------------------------- |
| `draft`    | `/draft/<code>/` | No                 | Banner saying it's under review                     |
| `machine`  | `/<code>/`       | Yes                | Short note linking to the English and to this guide |
| `reviewed` | `/<code>/`       | Yes                | None                                                |

The development server serves every language at the same addresses.

Every translation records a fingerprint (`source`) of the English it was made from. When the English changes, the translation is reported as out of date. Translations may only use a few inline tags (`<a>`, `<strong>`, `<em>`, `<code>`, `<br>`), and links may only point where the English already does. Untranslated or invalid strings fall back to English.

### Translation commands

| Command                                                      | What it does                                                                                                              |
| ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `npm run i18n -- add es Español es`                          | Start a new language, as a draft.                                                                                         |
| `npm run i18n -- check`                                      | Validate every language. CI runs this.                                                                                    |
| `npm run i18n -- todo es`                                    | Print, as JSON, the English that's missing a translation or changed since it was translated.                              |
| `npm run i18n -- import es file.json`                        | Merge translations in that same shape into the language file.                                                             |
| `npm run i18n -- critical es`                                | Print the safety-critical strings with their translations, for a careful check.                                           |
| `npm run i18n -- review-export es`                           | Write `translation-review-es.csv`, the reviewer spreadsheet described above.                                              |
| `npm run i18n -- review-import es translation-review-es.csv` | Apply a returned spreadsheet: shows each change and any comments, and rejects anything invalid without changing the file. |
| `npm run i18n -- confirm all <key>`                          | Mark translations as still correct after an English edit that doesn't affect them, such as a typo fix.                    |

### Machine translations

Before a machine translation is published (`"status": "machine"`), check the safety-critical strings (`npm run i18n -- critical <code>`) by translating each one back into English independently and comparing the meaning with the original. Watch for things like "delete" turning into "hide", or a lost negation. Record the result in the commit message.
