// Verify the agent-facing build output: every public page is prerendered with
// its content, has a Markdown twin that reads as the page, the index files
// agree with what was built, and nothing retired slipped into the twins.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const dist = resolve(import.meta.dirname, '../dist');
const read = (name) => readFileSync(resolve(dist, name), 'utf8');
const failures = [];
const expect = (condition, message) => {
  if (!condition) failures.push(message);
};

const pages = [
  ['index.html', 'index.md', 'Sometimes the exchange itself is the evidence.'],
  ['docs.html', 'docs.md', 'How Capture and Seal fit.'],
  ['docs/getting-started.html', 'docs/getting-started.md', 'Choose how to capture.'],
  ['docs/agents.html', 'docs/agents.md', 'For agents.'],
  ['docs/how-it-works.html', 'docs/how-it-works.md', 'Trust and guarantees.'],
  ['docs/hosted-credits.html', 'docs/hosted-credits.md', 'What it costs.'],
  ['docs/trace-packages.html', 'docs/trace-packages.md', 'Seal and verify.'],
  ['docs/share.html', 'docs/share.md', 'Share a sealed trace.'],
  ['privacy.html', 'privacy.md', 'Privacy Policy'],
  ['terms.html', 'terms.md', 'Terms of Service'],
];

const banned = [
  [/notariz(?:e|ed|ation)\b/i, 'retired verb notarize'],
  [/\bcheckpoints?\b/i, 'retired word checkpoint'],
  [/[—–]/, 'em or en dash'],
  [/\bENP\b/, 'retired protocol acronym'],
];

for (const [html, md, heading] of pages) {
  expect(existsSync(resolve(dist, html)), `${html} was not prerendered`);
  expect(existsSync(resolve(dist, md)), `${md} was not written`);
  if (!existsSync(resolve(dist, html)) || !existsSync(resolve(dist, md))) continue;
  const page = read(html);
  const twin = read(md);
  expect(page.includes(`<div id="root"><`), `${html} has an empty root`);
  expect(page.includes(heading), `${html} does not carry its heading "${heading}"`);
  expect(twin.startsWith(`# ${heading}`), `${md} does not start with "# ${heading}"`);
  expect(
    page.includes(`type="text/markdown" href="/${md}"`),
    `${html} does not link its Markdown twin`,
  );
  expect(!twin.includes('data-md'), `${md} leaked a data-md attribute`);
  expect(!/<\/?(div|span|svg|button)\b/.test(twin), `${md} contains unconverted HTML`);
  if (md !== 'privacy.md' && md !== 'terms.md') {
    for (const [pattern, label] of banned) {
      // The landing's copy is the website copy doc's, checkpoint included.
      if (md === 'index.md' && label === 'retired word checkpoint') continue;
      const match = pattern.exec(
        twin.replace(/\/v1\/traces\/[^\s`]*\/notarizations|notarization_failed/g, ''),
      );
      expect(!match, `${md} contains ${label}: ${match?.[0]}`);
    }
  }
}

expect(read('_shell.html').includes('<div id="root"></div>'), '_shell.html must stay empty');

const full = read('llms-full.txt');
for (const [, md, heading] of pages) {
  expect(full.includes(`# ${heading}`), `llms-full.txt is missing ${md}`);
}

const index = read('llms.txt');
expect(index.startsWith('# Exalto Capture\n'), 'llms.txt must start with the product name');
for (const link of index.matchAll(/\]\((https:\/\/capture\.exalto\.ai\/[^)]+)\)/g)) {
  const path = new URL(link[1]).pathname.slice(1);
  const candidates = [path, `${path}.html`, path.replace(/\/$/, '') || 'index.html'];
  expect(
    candidates.some((candidate) => existsSync(resolve(dist, candidate))),
    `llms.txt links to ${link[1]}, which is not in the build`,
  );
}

const sitemap = read('sitemap.xml');
for (const [html] of pages) {
  const path = html === 'index.html' ? '/' : `/${html.replace(/\.html$/, '')}`;
  expect(
    sitemap.includes(`<loc>https://capture.exalto.ai${path}</loc>`),
    `sitemap.xml lacks ${path}`,
  );
}

const agents = read('docs/agents.md');
for (const required of [
  'capture --json status',
  'capture --json traces list --metadata-only',
  'capture --json traces seal <trace_id> --wait',
  'capture --json traces verify <trace_id>',
  'curl -fsSL https://capture.exalto.ai/install.sh | sh',
]) {
  expect(agents.includes(required), `docs/agents.md is missing "${required}"`);
}

if (failures.length) {
  for (const failure of failures) process.stderr.write(`${failure}\n`);
  process.exit(1);
}
process.stdout.write(
  `Agent-facing output checked: ${pages.length} pages, their twins, llms.txt, llms-full.txt and the sitemap.\n`,
);
