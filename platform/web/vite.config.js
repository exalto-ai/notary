import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { localPreviewApi } from './scripts/local-preview-api.mjs';
export default defineConfig(({ command }) => {
  const local = command === 'serve';
  const sample = local && process.env.EXALTO_LOCAL_PREVIEW === '1';
  const capture =
    process.env.VITE_CAPTURE_ORIGIN ??
    (local ? 'http://localhost:4174' : 'https://capture.exalto.ai');
  const website =
    process.env.VITE_WEBSITE_ORIGIN ?? (local ? 'http://localhost:4175' : 'https://exalto.ai');
  const api = sample
    ? ''
    : (process.env.VITE_API_ORIGIN ?? (local ? 'http://localhost:8080' : 'https://api.exalto.ai'));
  for (const value of [capture, website, ...(api ? [api] : [])]) {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.origin !== value)
      throw new Error('Site and API URLs must be canonical HTTP(S) origins');
  }
  return {
    resolve: { alias: { '@': resolve(import.meta.dirname, 'src') } },
    define: {
      __CAPTURE_ORIGIN__: JSON.stringify(capture),
      __WEBSITE_ORIGIN__: JSON.stringify(website),
      __API_ORIGIN__: JSON.stringify(api),
      __LOCAL_PREVIEW__: JSON.stringify(sample),
      __BRAND_ASSET_VERSION__: JSON.stringify('capture'),
    },
    plugins: [
      react(),
      tailwindcss(),
      ...(sample ? [localPreviewApi({ capture, website })] : []),
      {
        name: 'site-html',
        transformIndexHtml: (html) =>
          html
            .replaceAll('%CAPTURE_ORIGIN%', capture)
            .replaceAll('%BRAND_ASSET_VERSION%', 'capture'),
        closeBundle() {
          if (command !== 'build') return;
          const file = resolve(import.meta.dirname, 'dist/llms.txt');
          writeFileSync(file, readFileSync(file, 'utf8').replaceAll('%CAPTURE_ORIGIN%', capture));
        },
      },
    ],

    server: { host: 'localhost', port: 4174, strictPort: true },
    preview: { host: 'localhost', port: 4174, strictPort: true },
  };
});
