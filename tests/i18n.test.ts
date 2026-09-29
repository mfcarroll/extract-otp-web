import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  auditLocale,
  extractPageSource,
  fingerprint,
  renderPage,
  validateMessage,
  validateContributors,
  validatePageText,
} from '../scripts/i18n/core.mjs';

const englishLink = {
  text: 'See <a href="https://example.com/" target="_blank" rel="noopener noreferrer">the docs</a>.',
  markup: true,
};

describe('validatePageText', () => {
  it('accepts allowed markup and links the English already uses', () => {
    expect(
      validatePageText(
        'Voir <a href="https://example.com/" target="_blank" rel="noopener noreferrer">la doc</a>. <strong>Important</strong>',
        englishLink
      )
    ).toEqual([]);
  });

  it('rejects links to anywhere the English does not link', () => {
    const problems = validatePageText(
      '<a href="https://evil.example/">x</a>',
      englishLink
    );
    expect(problems.join()).toMatch(/does not appear in the English/);
  });

  it('rejects scripts, event handlers and other tags', () => {
    expect(
      validatePageText('<script>alert(1)</script>', englishLink).join()
    ).toMatch(/<script>/);
    expect(
      validatePageText('<img src="x" onerror="alert(1)">', englishLink).join()
    ).toMatch(/<img>/);
    expect(
      validatePageText(
        '<strong onclick="alert(1)">x</strong>',
        englishLink
      ).join()
    ).toMatch(/onclick/);
    expect(
      validatePageText(
        '<a href="https://example.com/" onclick="alert(1)">x</a>',
        englishLink
      ).join()
    ).toMatch(/onclick/);
  });

  it('requires noopener on links that open a new tab', () => {
    expect(
      validatePageText(
        '<a href="https://example.com/" target="_blank">x</a>',
        englishLink
      ).join()
    ).toMatch(/noopener/);
  });

  it('allows no markup where the English is plain text', () => {
    expect(
      validatePageText('Bonjour', { text: 'Hello', markup: false })
    ).toEqual([]);
    expect(
      validatePageText('<em>Bonjour</em>', {
        text: 'Hello',
        markup: false,
      }).join()
    ).toMatch(/not allowed/);
  });
});

describe('validateMessage', () => {
  it('requires the same placeholders as the English', () => {
    expect(
      validateMessage(
        'Ligne {line} : {message}',
        'Line {line}: {message}',
        'fr'
      )
    ).toEqual([]);
    expect(
      validateMessage('Ligne {line}', 'Line {line}: {message}', 'fr').join()
    ).toMatch(/placeholders/);
  });

  it('checks plural forms against the language', () => {
    const english = {
      one: '{count} secret extracted.',
      other: '{count} secrets extracted.',
    };
    expect(
      validateMessage({ other: '已提取 {count} 条密钥。' }, english, 'zh-Hans')
    ).toEqual([]);
    expect(
      validateMessage({ one: 'x', other: 'y' }, english, 'zh-Hans').join()
    ).toMatch(/not a plural form/);
    expect(validateMessage({ one: '{count} x' }, english, 'fr').join()).toMatch(
      /"other"/
    );
    expect(
      validateMessage({ other: '{total} x' }, english, 'fr').join()
    ).toMatch(/unknown placeholder/);
  });

  it('rejects markup in messages', () => {
    expect(validateMessage('<b>x</b>', 'x', 'fr').join()).toMatch(/< or >/);
  });
});

const html = `<!doctype html><html lang="en"><head><title data-i18n="meta.title">Title</title></head><body>
  <p data-i18n="intro">Hello <strong>world</strong></p>
  <p data-i18n="shared">Same text</p><p data-i18n="shared">Same   text</p>
  <input data-i18n-attr="placeholder:input.placeholder" placeholder="Type here">
  <template><span data-i18n="card.name">Name:</span></template>
  <nav id="language-switcher" hidden></nav>
  <p id="draft-banner" hidden>Draft</p>
  <p id="machine-notice" hidden><a class="machine-notice-english" href="./">English</a></p>
</body></html>`;

describe('extractPageSource', () => {
  it('finds text, attributes and template content', () => {
    const source = extractPageSource(html);
    expect(source.get('intro')).toEqual({
      text: 'Hello <strong>world</strong>',
      markup: true,
    });
    expect(source.get('input.placeholder')).toEqual({
      text: 'Type here',
      markup: false,
    });
    expect(source.get('card.name')?.text).toBe('Name:');
    expect(source.get('shared')?.text).toBe('Same text');
  });

  it('rejects one key used for different text', () => {
    expect(() =>
      extractPageSource('<p data-i18n="k">A</p><p data-i18n="k">B</p>')
    ).toThrow(/different English/);
  });
});

const config = {
  siteUrl: 'https://example.github.io/app/',
  defaultLocale: 'en',
  locales: [
    {
      code: 'en',
      lang: 'en',
      hreflang: 'en',
      path: '',
      name: 'English',
      status: 'reviewed',
      published: true,
    },
    {
      code: 'fr',
      lang: 'fr-CA',
      hreflang: 'fr',
      path: 'fr/',
      name: 'Français',
      status: 'machine',
      published: true,
    },
    {
      code: 'zh',
      lang: 'zh-Hans',
      hreflang: 'zh-Hans',
      path: 'zh/',
      name: '中文',
      status: 'draft',
      published: false,
    },
  ],
};

describe('auditLocale', () => {
  it('reports missing, stale, unknown and invalid strings', () => {
    const pageSource = extractPageSource(html);
    const translations = {
      page: {
        intro: {
          source: fingerprint('Hello <strong>world</strong>'),
          text: 'Bonjour <strong>monde</strong>',
        },
        'meta.title': { source: 'outdated', text: 'Titre' },
        'card.name': {
          source: fingerprint('Name:'),
          text: '<script>x</script>',
        },
        removed: { source: 'x', text: 'y' },
      },
      messages: {},
    };
    const report = auditLocale('fr', 'fr-CA', {
      pageSource,
      englishMessages: { hi: 'Hi' },
      translations,
    });
    const keys = (items: { key: string }[]) => items.map((i) => i.key).sort();
    expect(keys(report.stale)).toEqual(['meta.title']);
    expect(keys(report.invalid)).toEqual(['card.name']);
    expect(keys(report.unknown)).toEqual(['removed']);
    expect(keys(report.missing)).toEqual(['hi', 'input.placeholder', 'shared']);
  });
});

describe('renderPage', () => {
  const pageSource = extractPageSource(html);
  const translations = {
    page: {
      intro: { source: '', text: 'Bonjour <strong>monde</strong>' },
      'input.placeholder': { source: '', text: 'Tapez ici' },
      'card.name': { source: '', text: 'Nom :' },
      'meta.title': {
        source: '',
        text: '<a href="https://evil.example/">x</a>',
      },
    },
    messages: {
      hi: { source: '', text: 'Salut </script><script>alert(1)</script>' },
    },
  };
  const render = (
    code: string,
    visible = config.locales.filter((l) => l.published)
  ) =>
    renderPage(html, {
      config,
      base: '/app/',
      locale: config.locales.find((l) => l.code === code)!,
      visible,
      translations: code === 'en' ? null : translations,
      pageSource,
      englishMessages: { hi: 'Hi' },
    });

  it('translates text, attributes and templates, keeping English where a translation is invalid', () => {
    const out = render('fr');
    expect(out).toContain('<html lang="fr-CA">');
    expect(out).toContain('Bonjour <strong>monde</strong>');
    expect(out).toContain('placeholder="Tapez ici"');
    expect(out).toContain('Nom :');
    expect(out).toContain('<title data-i18n="meta.title">Title</title>');
    expect(out).not.toContain('evil.example');
  });

  it('embeds runtime messages without allowing them to close the script tag', () => {
    const out = render('fr');
    expect(out).toContain('id="i18n-messages"');
    expect(out).not.toContain('</script><script>alert(1)');
  });

  it('links published languages for search engines and in the switcher', () => {
    const out = render('fr');
    expect(out).toContain(
      '<link rel="canonical" href="https://example.github.io/app/fr/">'
    );
    expect(out).toContain(
      'hreflang="en" href="https://example.github.io/app/"'
    );
    expect(out).toContain('hreflang="x-default"');
    expect(out).not.toContain('app/zh/');
    expect(out).toMatch(
      /<a class="navigable" href="\/app\/fr\/"[^>]*aria-current="page"/
    );
    expect(out).not.toContain('noindex');
    expect(out).toContain('<p id="draft-banner" hidden="">');
  });

  it('shows the machine-translation notice, linking to the English page', () => {
    expect(render('fr')).toContain(
      '<p id="machine-notice"><a class="machine-notice-english" href="/app/">'
    );
    expect(render('en')).toContain('<p id="machine-notice" hidden="">');
  });

  it('marks draft languages noindex and leaves them out of hreflang', () => {
    const out = render('zh', config.locales);
    expect(out).toContain('<meta name="robots" content="noindex">');
    expect(out).toContain('<p id="draft-banner">Draft</p>');
    expect(out).not.toContain('rel="alternate"');
    expect(out).toContain('href="/app/zh/"');
  });

  it('keeps the switcher hidden when only one language is visible', () => {
    const out = render('en', [config.locales[0]]);
    expect(out).toContain('<nav id="language-switcher" hidden="">');
  });
});

describe('translator credits', () => {
  const creditsHtml = `<!doctype html><html><head></head><body>
    <p id="translation-credits" hidden>
      <span data-i18n="faq.thanks.translators">By:</span>
    </p>
    <nav id="language-switcher" hidden></nav></body></html>`;
  const people = config.locales.map((l) => ({ ...l }));
  people[1].contributors = validateContributors('fr', [
    { name: 'Jean <b>Tremblay</b>', url: 'https://example.com/jean' },
    { github: 'shared-person' },
  ]);
  people[2].contributors = validateContributors('zh', [
    { github: 'shared-person' },
  ]);
  const render = (visible: typeof people) =>
    renderPage(creditsHtml, {
      config: { ...config, locales: people },
      base: '/app/',
      locale: people[0],
      visible,
      translations: null,
      pageSource: new Map(),
      englishMessages: {},
    });

  it('lists each person once with their languages, escaping names', () => {
    const out = render(people);
    expect(out).toContain('<p id="translation-credits">');
    expect(out).toContain('>Jean &lt;b&gt;Tremblay&lt;/b&gt;</a> (Français)');
    expect(out).toContain('href="https://github.com/shared-person"');
    expect(out).toContain('>shared-person</a> (Français, 中文).');
  });

  it('only credits languages the page links to', () => {
    const out = render([people[0], people[2]]);
    expect(out).not.toContain('Jean');
    expect(out).toContain('shared-person</a> (中文)');
  });

  it('uses Chinese punctuation on Chinese pages', () => {
    const out = renderPage(creditsHtml, {
      config: { ...config, locales: people },
      base: '/app/',
      locale: people[2],
      visible: [people[0], people[2]],
      translations: { page: {}, messages: {} },
      pageSource: new Map(),
      englishMessages: {},
    });
    expect(out).toContain('</span><a');
    expect(out).toContain('>shared-person</a>（中文）。');
  });

  it('stays hidden when nobody is credited', () => {
    expect(render([people[0]])).toContain(
      '<p id="translation-credits" hidden="">'
    );
  });

  it('prefers a name over a username, and a url over a GitHub profile', () => {
    const [both, nameAndGithub, githubOnly, nameOnly] = validateContributors(
      'fr',
      [
        { name: 'Jean', github: 'jean', url: 'https://jean.example/' },
        { name: 'Marie', github: 'marie' },
        { github: 'luc' },
        { name: 'Anne' },
      ]
    );
    expect(both).toEqual({ name: 'Jean', url: 'https://jean.example/' });
    expect(nameAndGithub).toEqual({
      name: 'Marie',
      url: 'https://github.com/marie',
    });
    expect(githubOnly).toEqual({ name: 'luc', url: 'https://github.com/luc' });
    expect(nameOnly).toEqual({ name: 'Anne', url: null });
  });

  it('shows a username linked to their url if they give no name', () => {
    expect(
      validateContributors('fr', [
        { github: 'luc', url: 'https://luc.example/' },
      ])
    ).toEqual([{ name: 'luc', url: 'https://luc.example/' }]);
  });

  it('treats empty fields as absent and skips blank entries', () => {
    expect(
      validateContributors('fr', [
        { name: '', github: '', url: '' },
        { name: '', github: 'luc', url: '' },
        { name: ' Anne ', github: '', url: '' },
      ])
    ).toEqual([
      { name: 'luc', url: 'https://github.com/luc' },
      { name: 'Anne', url: null },
    ]);
  });

  it('rejects a url with nothing to show', () => {
    expect(() =>
      validateContributors('fr', [{ url: 'https://x.example/' }])
    ).toThrow(/to show/);
  });

  it('rejects unsafe or invalid contributor details', () => {
    expect(() =>
      validateContributors('fr', [{ url: 'javascript:alert(1)', name: 'x' }])
    ).toThrow(/https/);
    expect(() => validateContributors('fr', [{ github: 'bad/name' }])).toThrow(
      /GitHub/
    );
  });
});

describe('t()', () => {
  beforeEach(() => {
    vi.resetModules();
    document.documentElement.lang = 'en';
    document.getElementById('i18n-messages')?.remove();
  });

  async function loadWith(lang: string, messages?: object) {
    document.documentElement.lang = lang;
    if (messages) {
      const script = document.createElement('script');
      script.type = 'application/json';
      script.id = 'i18n-messages';
      script.textContent = JSON.stringify(messages);
      document.head.appendChild(script);
    }
    return (await import('../src/i18n')).t;
  }

  it('uses English by default, with plurals and placeholders', async () => {
    const t = await loadWith('en');
    expect(t('log.extracted', { count: 1 })).toBe('1 secret extracted.');
    expect(t('log.extracted', { count: 3 })).toBe('3 secrets extracted.');
    expect(t('selection.count', { count: 2, total: 5 })).toBe(
      '2 of 5 selected'
    );
  });

  it('uses the page’s embedded messages and falls back to English for missing ones', async () => {
    const t = await loadWith('fr-CA', {
      'log.extracted': {
        one: '{count} secret extrait.',
        other: '{count} secrets extraits.',
      },
    });
    expect(t('log.extracted', { count: 0 })).toBe('0 secret extrait.');
    expect(t('log.extracted', { count: 2 })).toBe('2 secrets extraits.');
    expect(t('export.noData')).toBe('No data to export.');
  });
});
