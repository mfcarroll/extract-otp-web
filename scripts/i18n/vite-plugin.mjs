/**
 * Generates one page per language from index.html.
 *
 * - Build: the English page is written as usual, then each other language is
 *   written to <outDir>/<path>/index.html, plus sitemap.xml. Only published
 *   languages are built unless I18N_DRAFTS=1 is set.
 * - Dev server: every language (including drafts) is served at <base><path>.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import {
  extractPageSource,
  loadConfig,
  loadEnglishMessages,
  loadTranslations,
  pageUrl,
  renderPage,
} from './core.mjs';

export default function i18nPages() {
  let base = '/';
  let root = process.cwd();
  let outDir = 'dist';
  let isBuild = false;
  let builtHtml = null;

  // Read fresh each time so edits to translations show up without a restart.
  function context(includeDrafts) {
    const config = loadConfig();
    const visible = config.locales.filter((l) => l.published || includeDrafts);
    return { config, visible, englishMessages: loadEnglishMessages() };
  }

  function localeForUrl(url, locales) {
    const pathname = (url ?? '/').split('?')[0];
    const relative = pathname.startsWith(base)
      ? pathname.slice(base.length)
      : pathname.replace(/^\//, '');
    return locales.find(
      (l) =>
        l.path &&
        (relative === l.path ||
          relative === l.path.replace(/\/$/, '') ||
          relative === `${l.path}index.html`)
    );
  }

  function render(html, locale, ctx) {
    const english = locale.code === ctx.config.defaultLocale;
    return renderPage(html, {
      ...ctx,
      base,
      locale,
      translations: english ? null : loadTranslations(locale.code),
      // The source comes from the unrendered page so keys match the English.
      pageSource: extractPageSource(
        readFileSync(path.join(root, 'index.html'), 'utf8')
      ),
    });
  }

  return {
    name: 'i18n-pages',

    configResolved(config) {
      base = config.base;
      root = config.root;
      outDir = path.resolve(config.root, config.build.outDir);
      isBuild = config.command === 'build';
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const { config } = context(true);
        const locale = localeForUrl(req.url, config.locales);
        if (!locale) return next();
        if (
          !req.url.split('?')[0].endsWith('/') &&
          !req.url.includes('index.html')
        ) {
          res.statusCode = 301;
          res.setHeader('Location', `${base}${locale.path}`);
          return res.end();
        }
        try {
          const raw = readFileSync(path.join(root, 'index.html'), 'utf8');
          const html = await server.transformIndexHtml(
            req.url,
            raw,
            req.originalUrl
          );
          res.setHeader('Content-Type', 'text/html');
          res.end(html);
        } catch (error) {
          next(error);
        }
      });
    },

    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const c = context(!isBuild || process.env.I18N_DRAFTS === '1');
        if (isBuild) builtHtml = html;
        const locale =
          (!isBuild &&
            localeForUrl(ctx.originalUrl ?? ctx.path, c.config.locales)) ||
          c.config.locales.find((l) => l.code === c.config.defaultLocale);
        return render(html, locale, c);
      },
    },

    closeBundle() {
      if (!isBuild || !builtHtml) return;
      const c = context(process.env.I18N_DRAFTS === '1');
      for (const locale of c.visible) {
        if (locale.code === c.config.defaultLocale) continue;
        const dir = path.join(outDir, locale.path);
        mkdirSync(dir, { recursive: true });
        writeFileSync(
          path.join(dir, 'index.html'),
          render(builtHtml, locale, c)
        );
      }
      writeFileSync(path.join(outDir, 'sitemap.xml'), sitemap(c.config));
    },
  };
}

function sitemap(config) {
  const published = config.locales.filter((l) => l.published);
  const alternates =
    published.length > 1
      ? published
          .map(
            (l) =>
              `    <xhtml:link rel="alternate" hreflang="${l.hreflang}" href="${pageUrl(config, l)}"/>`
          )
          .join('\n') + '\n'
      : '';
  const urls = published
    .map(
      (l) =>
        `  <url>\n    <loc>${pageUrl(config, l)}</loc>\n${alternates}  </url>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls}
</urlset>
`;
}
