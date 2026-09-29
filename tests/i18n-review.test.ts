import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  describePage,
  fromMarkers,
  parseCsv,
  toCsv,
  toMarkers,
} from '../scripts/i18n/review.mjs';
import en from '../src/i18n/en.json';
import context from '../scripts/i18n/message-context.json';

const links =
  'See <a href="https://a.example/" target="_blank" rel="noopener noreferrer">one</a> and ' +
  '<a href="https://b.example/" target="_blank" rel="noopener noreferrer">two</a>, <strong>important</strong> &gt; x<br>next';

describe('review markers', () => {
  it('shows markup as simple markers', () => {
    expect(toMarkers(links)).toBe(
      'See [link1]one[/link1] and [link2]two[/link2], [b]important[/b] > x[br]next'
    );
    expect(toMarkers('<a href="https://a.example/">only</a>')).toBe(
      '[link]only[/link]'
    );
  });

  it('turns markers back into HTML, keeping each link’s target', () => {
    const html = fromMarkers(
      'Voir [link2]deux[/link2] et [link1]un[/link1], [b]important[/b] > x',
      links
    );
    expect(html).toBe(
      'Voir <a href="https://b.example/" target="_blank" rel="noopener noreferrer">deux</a> et ' +
        '<a href="https://a.example/" target="_blank" rel="noopener noreferrer">un</a>, <strong>important</strong> &gt; x'
    );
  });

  it('rejects unknown links and unbalanced markers, and escapes raw HTML', () => {
    expect(() => fromMarkers('[link3]x[/link3]', links)).toThrow(/link3/);
    expect(() => fromMarkers('[b]x', links)).toThrow(/never closed/);
    expect(() => fromMarkers('x[/b]', links)).toThrow(/doesn't match/);
    expect(fromMarkers('<script>alert(1)</script>', links)).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;'
    );
  });
});

describe('CSV', () => {
  it('round-trips commas, quotes, new lines and non-Latin text', () => {
    const rows = [
      ['a,b', 'say "hi"', 'line\nbreak'],
      ['中文', '« français »', ''],
    ];
    expect(parseCsv(toCsv(rows))).toEqual(rows);
  });
});

describe('describePage', () => {
  const page = describePage(readFileSync('index.html', 'utf8'));
  const where = (key: string) => page.find((p) => p.key === key)?.where;

  it('lists every string once, in page order, with where it appears', () => {
    expect(page[0].key).toBe('meta.title');
    expect(new Set(page.map((p) => p.key)).size).toBe(page.length);
    expect(where('use.extract.scan')).toBe(
      'Tab: How do I use it? › 2. Extract Secrets'
    );
    expect(where('faq.safe.camera')).toMatch(/^FAQ › Is it safe/);
    expect(where('card.name')).toBe('Each extracted account');
    expect(where('camera.switch')).toBe(
      'Camera scanner window (read aloud by screen readers)'
    );
    expect(where('manual.placeholder')).toMatch(/placeholder/);
  });
});

it('describes where every app message appears', () => {
  expect(Object.keys(en).filter((key) => !(key in context))).toEqual([]);
});
