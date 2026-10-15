// Render the 1200×630 social preview from the built site's own styles, the
// way the Proof of Thought site renders its card: the hero H1 beside the
// sealed receipt. Run after `npm run build:site`; commits public/social-preview.png.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { preview } from 'vite';

const root = resolve(import.meta.dirname, '..');
const dist = resolve(root, 'dist');
const stylesheet = readdirSync(resolve(dist, 'assets')).find(
  (name) => name.startsWith('index-') && name.endsWith('.css'),
);
if (!stylesheet) throw new Error('Build the site first: dist/assets has no stylesheet');

const mark = readFileSync(resolve(root, 'src/site/public/PublicShell.tsx'), 'utf8').includes(
  'M-34,-16 L-34,-30',
)
  ? `<svg width="40" height="40" viewBox="-46 -46 92 92" aria-hidden="true"><g style="stroke:currentColor;stroke-width:4;stroke-linecap:round;fill:none"><path d="M-34,-16 L-34,-30 A4,4 0 0 1 -30,-34 L-16,-34"/><path d="M16,-34 L30,-34 A4,4 0 0 1 34,-30 L34,-16"/><path d="M34,16 L34,30 A4,4 0 0 1 30,34 L16,34"/><path d="M-16,34 L-30,34 A4,4 0 0 1 -34,30 L-34,16"/></g><circle r="15" style="fill:none;stroke:currentColor;stroke-width:4"/><circle r="6.5" style="fill:currentColor"/></svg>`
  : '';

const html = `<!doctype html>
<html class="cp-root"><head><meta charset="utf-8">
<link rel="stylesheet" href="/assets/${stylesheet}">
<style>
  html, body { margin: 0; width: 1200px; height: 630px; overflow: hidden; }
  .og { width: 1200px; height: 630px; min-height: 0; padding: 52px 56px; display: flex; flex-direction: column; }
  .og-brand { display: flex; align-items: center; gap: 14px; font-family: var(--font-heading); font-weight: 800; font-size: 28px; letter-spacing: -0.03em; }
  .og-row { display: flex; gap: 48px; align-items: flex-end; flex: 1; margin-top: 24px; }
  .og-copy { flex: 1 1 0; display: flex; flex-direction: column; justify-content: flex-end; gap: 28px; }
  .og-copy h1 { font-size: 76px; line-height: 0.92; letter-spacing: -0.045em; max-width: 12ch; }
  .og-copy .cp-label { font-size: 13px; line-height: 18px; }
  .og-receipt { flex: 0 0 420px; align-self: stretch; }
  .og-receipt .cp-receipt { height: 100%; }
</style></head>
<body><div class="cp og">
  <div class="og-brand">${mark}<span>Exalto Capture</span></div>
  <div class="og-row">
    <div class="og-copy">
      <h1>Sometimes the exchange itself is the evidence.</h1>
      <p class="cp-label">The flight recorder for your AI work · capture.exalto.ai</p>
    </div>
    <div class="og-receipt">
      <div class="cp-receipt cp-paper">
        <div class="cp-receipt-head"><span class="cp-micro">Sealed trace</span><span class="cp-state-tag" data-tag="fill-ink">Verified</span></div>
        <div><div class="cp-receipt-id">trc-8f3k2q</div><div class="cp-receipt-meta">reasoning-50 · Item 37 · openai · gpt-5</div></div>
        <div class="cp-receipt-rows">
          <div class="cp-receipt-row"><b>Provenance</b><span>api.openai.com · authenticated TLS</span><i>✓</i></div>
          <div class="cp-receipt-row"><b>Integrity</b><span>sha256 9c41…e07b · 6 entries</span><i>✓</i></div>
          <div class="cp-receipt-row"><b>Time</b><span>14:03:52 UTC · Exalto Seal</span><i>✓</i></div>
        </div>
        <div class="cp-receipt-keys">
          <span class="cp-micro">Disclosed</span><span>Request and response bodies</span>
          <span class="cp-micro">Hidden</span><span>Every header value, your API key included</span>
          <span class="cp-micro">Notary</span><span>Exalto Seal · key 02a7…c41e</span>
        </div>
        <p class="cp-receipt-note">Verified against the notary’s public key. Anyone can verify.</p>
        <div class="cp-receipt-field"><div>seal.exalto.ai/trc-8f3k2q</div></div>
      </div>
    </div>
  </div>
</div></body></html>`;

const server = await preview({
  root,
  preview: { port: 0, host: '127.0.0.1', strictPort: false },
  logLevel: 'silent',
});
const origin = server.resolvedUrls?.local[0]?.replace(/\/$/, '');
if (!origin) throw new Error('preview server did not report an address');
const browser = await chromium.launch(
  process.env.PLAYWRIGHT_EXECUTABLE_PATH
    ? { executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH }
    : undefined,
);
try {
  const page = await browser.newPage({
    viewport: { width: 1200, height: 630 },
    deviceScaleFactor: 1,
  });
  await page.route('**/og.html', (route) =>
    route.fulfill({ body: html, contentType: 'text/html' }),
  );
  await page.goto(`${origin}/og.html`, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  const png = await page.screenshot({
    type: 'png',
    clip: { x: 0, y: 0, width: 1200, height: 630 },
  });
  writeFileSync(resolve(root, 'public/social-preview.png'), png);
  process.stdout.write(`Rendered public/social-preview.png (${png.length} bytes)\n`);
} finally {
  await browser.close();
  await server.close();
}
