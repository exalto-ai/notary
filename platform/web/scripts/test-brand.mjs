import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const llms = readFileSync(resolve(root, 'public/llms.txt'), 'utf8');
const mark = readFileSync(resolve(root, 'public/notary-mark.svg'), 'utf8');
const favicon = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
const captureTile = readFileSync(
  resolve(root, '../../brand/exalto-capture/svg/exalto-capture-tile.svg'),
  'utf8',
);
const preview = readFileSync(resolve(root, 'public/social-preview.png'));
const shell = readFileSync(resolve(root, 'src/site/components/Shell.tsx'), 'utf8');
const traces = readFileSync(resolve(root, 'src/site/pages/account/Traces.tsx'), 'utf8');

function requireText(source, expected, label) {
  if (!source.includes(expected))
    throw new Error(`${label} is missing ${JSON.stringify(expected)}`);
}

requireText(html, '<title>Exalto Capture</title>', 'default browser title');
if (!llms.startsWith('# Exalto Capture\n')) {
  throw new Error('llms.txt must begin with the formal endorsed identity');
}
requireText(mark, '<title id="title">Exalto Seal</title>', 'public mark title');
requireText(favicon, '<title id="title">Exalto Seal</title>', 'favicon title');
// The site leads with the macOS download, so its browser icon is the app's own
// mark rather than a separate drawing that drifts from the shipped kit.
for (const geometry of captureTile.match(/<(?:g|circle|path|rect)[^>]*>/g) ?? []) {
  requireText(favicon, geometry, 'favicon Exalto Capture mark');
}
for (const icon of ['favicon.ico', 'apple-touch-icon-180.png', 'icon-192.png', 'icon-512.png']) {
  if (!readFileSync(resolve(root, `public/${icon}`)).length) {
    throw new Error(`public/${icon} is empty`);
  }
}
requireText(shell, 'aria-label="Exalto Capture home"', 'site header identity');
// The wordmark is typeset, never an image, and the product word sits beside it.
requireText(shell, 'Exalto', 'site header family');
requireText(shell, 'Capture', 'site header product');
requireText(shell, "'Fraunces Variable'", 'wordmark typeface');
requireText(shell, 'https://exalto.ai', 'site footer identity');
requireText(
  traces,
  'the hosted package holds the conversation you disclosed exactly as it was admitted',
  'hosted Trace disclosure warning',
);
for (const [label, source] of [
  ['HTML metadata', html],
  ['llms.txt', llms],
  ['site shell', shell],
  ['account traces', traces],
]) {
  for (const retired of ['Notary by Exalto', 'Continue to Notary', 'aria-label="Notary home"']) {
    if (source.includes(retired)) throw new Error(`${label} retains retired identity ${retired}`);
  }
}
if (packageJson.name !== '@exalto/notary-web') {
  throw new Error('hosted frontend package identity is stale');
}
if (preview.readUInt32BE(16) !== 1200 || preview.readUInt32BE(20) !== 630) {
  throw new Error('social preview must be 1200x630');
}
process.stdout.write('Hosted identity metadata and assets are consistent.\n');
