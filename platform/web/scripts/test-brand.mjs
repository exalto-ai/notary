import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const html = readFileSync(resolve(root, 'index.html'), 'utf8');
const packageJson = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf8'));
const llms = readFileSync(resolve(root, 'public/llms.txt'), 'utf8');
const mark = readFileSync(resolve(root, 'public/notary-mark.svg'), 'utf8');
const favicon = readFileSync(resolve(root, 'public/favicon.svg'), 'utf8');
const preview = readFileSync(resolve(root, 'public/social-preview.png'));
const siteCaddy = readFileSync(resolve(root, 'Caddyfile'), 'utf8');
const flyCaddy = readFileSync(resolve(root, 'Caddyfile.fly'), 'utf8');
const gatewayCaddy = readFileSync(resolve(root, '../../deploy/gateway.Caddyfile'), 'utf8');
const siteApp = readFileSync(resolve(root, 'src/site/SiteApp.tsx'), 'utf8');
const publicTracePages = readFileSync(resolve(root, 'src/site/PublicTracePages.tsx'), 'utf8');
const accountDashboard = readFileSync(resolve(root, 'src/site/AccountDashboard.tsx'), 'utf8');

function requireText(source, expected, label) {
  if (!source.includes(expected))
    throw new Error(`${label} is missing ${JSON.stringify(expected)}`);
}

requireText(html, '<title>Exalto Seal</title>', 'default browser title');
requireText(html, 'property="og:site_name" content="Exalto Seal"', 'Open Graph identity');
requireText(
  html,
  'content="Exalto Seal · Verifiable intelligence · Sealed traces for independent verification"',
  'social-preview alt text',
);
requireText(html, '"name": "Exalto Seal"', 'structured metadata');
if (!llms.startsWith('# Exalto Seal\n')) {
  throw new Error('llms.txt must begin with the formal endorsed identity');
}
requireText(mark, '<title id="title">Exalto Seal</title>', 'public mark title');
requireText(favicon, '<title id="title">Exalto Seal</title>', 'favicon title');
requireText(siteApp, 'aria-label="Exalto Seal home"', 'site header identity');
requireText(siteApp, '<small>SEAL</small>', 'site header product label');
requireText(
  siteApp,
  '<b>Exalto Seal</b> <span>· Evidence stays yours</span>',
  'site footer identity',
);
requireText(publicTracePages, "'Shared trace · Exalto Seal'", 'shared Trace title identity');
requireText(
  accountDashboard,
  'Sealed traces you’ve shared through Exalto Seal.',
  'hosted Trace account identity',
);
for (const [label, source] of [
  ['HTML metadata', html],
  ['llms.txt', llms],
  ['site app', siteApp],
  ['public Trace pages', publicTracePages],
  ['account dashboard', accountDashboard],
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
for (const [label, caddy] of [
  ['site Caddyfile', siteCaddy],
  ['Fly Caddyfile', flyCaddy],
  ['gateway Caddyfile', gatewayCaddy],
]) {
  requireText(caddy, '@shared path /s/*', label);
  requireText(caddy, 'X-Robots-Tag "noindex, nofollow, noarchive"', label);
}
requireText(
  flyCaddy,
  'redir @retired_notary https://seal.exalto.ai{uri} permanent',
  'Seal hostname redirect',
);

process.stdout.write('Hosted identity metadata and assets are consistent.\n');
