// Prerender the public pages and write their agent-facing twins.
//
// After `vite build` (the client) and `vite build --ssr` (src/site/prerender.tsx
// into dist-ssr), this renders every public route to static HTML inside the
// built index document, so a fetch of the page returns its content without
// running any script, and the client hydrates it. From the same render it
// derives a Markdown twin of each page (`/docs/getting-started.md`), the
// everything-in-one `llms-full.txt`, and `sitemap.xml`. The untouched build
// output is kept as `_shell.html` for the account routes, which render on the
// client. Markup guides the conversion through `data-md` attributes:
//   data-md="skip"      left out (chrome: navigation, rails, buttons)
//   data-md-alt="…"     replaced by that sentence (figures, demos)
//   data-md="code"      a fenced block, one line per child
//   data-md="fig"       an italic figure line
//   data-md="definitions" / "steps" / "doc-steps" / "callout" / "package" /
//   "inline" / "table" / "list"   structured blocks, see the rules below
//   data-md-heading="…" a level-3 heading before the element's content
//   hidden + data-md-only   static content for readers without script

import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const ssr = resolve(root, 'dist-ssr');

const template = readFileSync(resolve(dist, 'index.html'), 'utf8');
if (!template.includes('<div id="root"></div>')) {
  throw new Error('dist/index.html has no empty root to prerender into; build the client first');
}
const origin = /<link rel="canonical" href="([^"]+)\/"/.exec(template)?.[1];
if (!origin) throw new Error('dist/index.html has no canonical origin');

const entry = resolve(ssr, 'prerender.js');
if (!existsSync(entry))
  throw new Error('dist-ssr/prerender.js is missing; build the SSR entry first');
const { render, publicRoutes } = await import(pathToFileURL(entry).href);
const routes = publicRoutes();

const escapeAttribute = (value) =>
  value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;');
const escapeText = (value) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;');
// String.prototype.replace reads `$&`, `$'` and friends in a string
// replacement; rendered HTML (a `$` prompt before a quote) must go in as is.
const literal = (value) => () => value;

// ---- Markdown ---------------------------------------------------------------

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});
turndown.use(gfm);

const text = (node) => (node?.textContent ?? '').replace(/\s+/g, ' ').trim();
const attribute = (node, name) => (node.getAttribute ? node.getAttribute(name) : null);
const children = (node) => Array.from(node.children ?? []);
const inner = (node) => turndown.turndown(node.innerHTML ?? '').trim();
const fence = (lines, language = '') =>
  `\n\n\`\`\`${language}\n${lines.join('\n').replace(/\n+$/, '')}\n\`\`\`\n\n`;

turndown.addRule('skip', {
  filter: (node) =>
    attribute(node, 'data-md') === 'skip' ||
    node.nodeName === 'BUTTON' ||
    node.nodeName === 'IMG' ||
    node.nodeName === 'SVG' ||
    node.nodeName === 'DIALOG' ||
    (node.nodeName === 'A' && node.classList?.contains('x-heading-anchor')),
  replacement: () => '',
});

turndown.addRule('alt', {
  filter: (node) => attribute(node, 'data-md-alt') !== null,
  replacement: (_content, node) => `\n\n${attribute(node, 'data-md-alt')}\n\n`,
});

turndown.addRule('code', {
  filter: (node) => attribute(node, 'data-md') === 'code',
  replacement: (_content, node) => {
    const lines = children(node).map((child) => {
      const classes = child.classList ?? { contains: () => false };
      if (classes.contains('cp-term-cmd')) return `$ ${text(child.lastElementChild)}`;
      if (classes.contains('cp-term-ok')) return `  ✓ ${text(child.lastElementChild)}`;
      if (classes.contains('cp-term-out')) return `  ${text(child)}`;
      if (classes.contains('cp-term-gap')) return '';
      if (classes.contains('cp-term-idle')) return '$';
      return text(child);
    });
    return fence(lines, 'text');
  },
});

turndown.addRule('fig', {
  filter: (node) => attribute(node, 'data-md') === 'fig',
  replacement: (_content, node) =>
    `\n\n*${children(node).map(text).filter(Boolean).join(' · ')}*\n\n`,
});

turndown.addRule('definitions', {
  filter: (node) => attribute(node, 'data-md') === 'definitions',
  replacement: (_content, node) =>
    `\n\n${children(node)
      .map((row) => {
        const term = row.querySelector('dt');
        const definition = row.querySelector('dd');
        return `**${text(term)}:** ${text(definition)}`;
      })
      .join('\n\n')}\n\n`,
});

turndown.addRule('steps', {
  filter: (node) => attribute(node, 'data-md') === 'steps',
  replacement: (_content, node) =>
    `\n\n${children(node)
      .map((item) => {
        const number = text(item.querySelector('.cp-qs-num'));
        const title = text(item.querySelector('h3'));
        const note = item.querySelector('.cp-qs-text p');
        const command = item.querySelector('code');
        const commandText = (command?.textContent ?? '').replace(/^\$\s*/, '').trim();
        return `### ${number} ${title}\n\n${note ? inner(note) : ''}${fence([commandText], 'sh')}`.trim();
      })
      .join('\n\n')}\n\n`,
});

turndown.addRule('doc-steps', {
  filter: (node) => attribute(node, 'data-md') === 'doc-steps',
  replacement: (_content, node) =>
    `\n\n${children(node)
      .map((item, index) => {
        const title = text(item.querySelector('h3'));
        const body = item.querySelector('.cp-doc-step-body');
        return `${index + 1}. **${title}.** ${body ? inner(body).replace(/\n+/g, ' ') : ''}`.trim();
      })
      .join('\n')}\n\n`,
});

turndown.addRule('callout', {
  filter: (node) => attribute(node, 'data-md') === 'callout',
  replacement: (_content, node) => {
    const head = node.querySelector('.cp-box-head');
    const body = node.querySelector('.cp-callout-body');
    const lines = [head ? `**${text(head)}**` : '', body ? inner(body) : '']
      .filter(Boolean)
      .join('\n\n')
      .split('\n')
      .map((line) => (line ? `> ${line}` : '>'));
    return `\n\n${lines.join('\n')}\n\n`;
  },
});

turndown.addRule('package', {
  filter: (node) => attribute(node, 'data-md') === 'package',
  replacement: (_content, node) => {
    const name = text(node.querySelector('.cp-package-name'));
    const rows = children(node)
      .filter((row) => row.classList?.contains('cp-package-row'))
      .map((row) => {
        const entry = text(row.querySelector('.cp-package-entry')).replace(/^[├└]──\s*/, '');
        const number = text(row.querySelector('.cp-package-num'));
        const description = text(row.querySelector('.cp-package-desc'));
        return `- \`${entry}\` (${number}): ${description}`;
      });
    return `\n\n\`${name}\`\n\n${rows.join('\n')}\n\n`;
  },
});

turndown.addRule('inline', {
  filter: (node) => attribute(node, 'data-md') === 'inline',
  replacement: (_content, node) =>
    `\n\n${children(node)
      .map((child) => {
        if (child.nodeName === 'A') return turndown.turndown(child.outerHTML).trim();
        const parts = children(child);
        return parts.length === 2 ? `**${text(parts[0])}** ${text(parts[1])}` : text(child);
      })
      .filter(Boolean)
      .join(' · ')}\n\n`,
});

turndown.addRule('box-head', {
  filter: (node) => node.classList?.contains('cp-box-head') ?? false,
  replacement: (_content, node) => `\n\n**${text(node)}**\n\n`,
});

turndown.addRule('article-number', {
  filter: (node) => node.classList?.contains('cp-app-num') ?? false,
  replacement: () => '',
});

turndown.addRule('table', {
  filter: (node) => attribute(node, 'data-md') === 'table',
  replacement: (_content, node) => {
    const rows = children(node).map((row) => children(row).map((cell) => text(cell)));
    if (!rows.length) return '';
    const [head, ...body] = rows;
    const line = (cells) => `| ${cells.map((cell) => cell.replaceAll('|', '\\|')).join(' | ')} |`;
    return `\n\n${[line(head), line(head.map(() => '---')), ...body.map(line)].join('\n')}\n\n`;
  },
});

turndown.addRule('list', {
  filter: (node) => attribute(node, 'data-md') === 'list',
  replacement: (_content, node) =>
    `\n\n${children(node)
      .map((row) => {
        const [key, description] = children(row);
        const label =
          key?.nodeName === 'A'
            ? `[${text(key)}](${new URL(attribute(key, 'href') ?? '/', origin).href})`
            : `\`${text(key)}\``;
        return `- ${label}: ${text(description)}`;
      })
      .join('\n')}\n\n`,
});

turndown.addRule('heading-before', {
  filter: (node) => attribute(node, 'data-md-heading') !== null,
  replacement: (content, node) =>
    `\n\n### ${attribute(node, 'data-md-heading')}\n\n${content.trim()}\n\n`,
});

// Links are written relative in the application; the twin is read anywhere.
turndown.addRule('absolute-links', {
  filter: (node) =>
    node.nodeName === 'A' && attribute(node, 'href') !== null && !attribute(node, 'data-md'),
  replacement: (content, node) => {
    const target = attribute(node, 'href') ?? '';
    if (!content.trim()) return '';
    if (target.startsWith('#')) return content;
    return `[${content}](${new URL(target, origin).href})`;
  },
});

// Added last, so it takes precedence over the link rule above.
turndown.addRule('heading-anchor', {
  filter: (node) =>
    node.nodeName === 'A' && (node.classList?.contains('x-heading-anchor') ?? false),
  replacement: () => '',
});

turndown.addRule('micro', {
  filter: (node) => node.classList?.contains('cp-micro') ?? false,
  replacement: (_content, node) => (text(node) ? `\n\n**${text(node)}**\n\n` : ''),
});

function toMarkdown(route, html) {
  const main = /<main[\s\S]*?<\/main>/.exec(html)?.[0] ?? html;
  const body = turndown
    .turndown(main)
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const url = `${origin}${route.path}`;
  const lines = [];
  if (route.kind === 'landing') {
    const heading = /^# ([^\n]*)/.exec(body)?.[1] ?? route.title;
    lines.push(
      `# ${heading}`,
      '',
      `> ${route.description}`,
      '',
      `This is capture.exalto.ai as Markdown. The docs index is ${origin}/llms.txt; the whole site in one file is ${origin}/llms-full.txt; the page for agents is ${origin}/docs/agents.md.`,
    );
  } else {
    lines.push(
      `# ${route.title}`,
      '',
      `> ${route.description}`,
      '',
      `${route.kind === 'legal' ? 'A legal page of capture.exalto.ai' : 'Part of the Exalto Capture docs'}. Page: ${url}. Every page is listed in ${origin}/llms.txt; the whole site in one file is ${origin}/llms-full.txt.`,
    );
  }
  lines.push('', body.replace(/^# [^\n]*\n+/, ''));
  if (route.path === '/docs') {
    lines.push('', '## All pages', '');
    for (const other of routes.filter((candidate) => candidate.kind === 'docs')) {
      lines.push(`- [${other.label}](${origin}${other.path}.md): ${other.description}`);
    }
  }
  return `${lines.join('\n').trim()}\n`;
}

// ---- Write ------------------------------------------------------------------

writeFileSync(resolve(dist, '_shell.html'), template);

const twins = [];
for (const route of routes) {
  const { html } = render(route.path);
  const twinPath = `${route.path === '/' ? '/index' : route.path}.md`;
  const page = template
    .replace('<div id="root"></div>', literal(`<div id="root">${html}</div>`))
    .replace(/<title>[^<]*<\/title>/, literal(`<title>${escapeText(route.title)}</title>`))
    .replace(
      /<meta name="description" content="[^"]*" \/>/,
      literal(`<meta name="description" content="${escapeAttribute(route.description)}" />`),
    )
    .replace(
      /<link rel="canonical" href="[^"]*" \/>/,
      literal(`<link rel="canonical" href="${origin}${route.path}" />`),
    )
    .replace(
      /<meta property="og:url" content="[^"]*" \/>/,
      literal(`<meta property="og:url" content="${origin}${route.path}" />`),
    )
    .replace(
      /<link rel="alternate" type="text\/markdown" href="[^"]*" title="[^"]*" \/>/,
      literal(
        `<link rel="alternate" type="text/markdown" href="${twinPath}" title="This page as Markdown" />`,
      ),
    );
  if (route.kind !== 'landing') {
    // The social card and structured data describe the product, not the page.
    const titled = page
      .replace(
        /<meta property="og:title" content="[^"]*" \/>/,
        literal(
          `<meta property="og:title" content="${escapeAttribute(route.title)} · Exalto Capture" />`,
        ),
      )
      .replace(
        /<meta name="twitter:title" content="[^"]*" \/>/,
        literal(
          `<meta name="twitter:title" content="${escapeAttribute(route.title)} · Exalto Capture" />`,
        ),
      )
      .replace(
        /<meta property="og:description" content="[^"]*" \/>/,
        literal(
          `<meta property="og:description" content="${escapeAttribute(route.description)}" />`,
        ),
      )
      .replace(
        /<meta name="twitter:description" content="[^"]*" \/>/,
        literal(
          `<meta name="twitter:description" content="${escapeAttribute(route.description)}" />`,
        ),
      );
    write(`${route.file}.html`, titled);
  } else {
    write('index.html', page);
  }
  const markdown = toMarkdown(route, html);
  write(twinPath.slice(1), markdown);
  twins.push({ route, markdown });
}

write('llms-full.txt', `${twins.map(({ markdown }) => markdown.trim()).join('\n\n---\n\n')}\n`);

const today = new Date().toISOString().slice(0, 10);
write(
  'sitemap.xml',
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${routes
    .map(
      (route) =>
        `  <url><loc>${origin}${route.path}</loc><lastmod>${today}</lastmod><changefreq>${route.kind === 'legal' ? 'yearly' : 'weekly'}</changefreq></url>`,
    )
    .join('\n')}\n</urlset>\n`,
);

rmSync(ssr, { recursive: true, force: true });
process.stdout.write(
  `Prerendered ${routes.length} public pages with Markdown twins, llms-full.txt and sitemap.xml.\n`,
);

function write(relative, content) {
  const file = resolve(dist, relative);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, content);
}
