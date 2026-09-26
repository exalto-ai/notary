import react from '@vitejs/plugin-react';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';
import { docMdx, docMetadata } from './scripts/docs-mdx.mjs';

const localBrowser = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

export default defineConfig({
  optimizeDeps: { include: ['openapi-fetch', 'react-dom/client'] },
  plugins: [docMetadata(), docMdx(), react({ include: /\.(js|jsx|ts|tsx|md|mdx)$/ })],
  test: {
    include: ['src/site/App.browser.test.tsx'],
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(
        localBrowser ? { launchOptions: { executablePath: localBrowser } } : undefined,
      ),
      instances: [{ browser: 'chromium' }],
      viewport: { width: 1280, height: 900 },
    },
  },
});
