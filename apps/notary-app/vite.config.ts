import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: [
      { find: '@', replacement: resolve(process.cwd(), '../../runtime/apps/admin-dashboard/src') },
      { find: 'react', replacement: resolve(process.cwd(), 'node_modules/react') },
      { find: 'react-dom', replacement: resolve(process.cwd(), 'node_modules/react-dom') },
      { find: '@mantine/core', replacement: resolve(process.cwd(), 'node_modules/@mantine/core') },
      { find: '@mantine/hooks', replacement: resolve(process.cwd(), 'node_modules/@mantine/hooks') },
      { find: '@mantine/notifications', replacement: resolve(process.cwd(), 'node_modules/@mantine/notifications') },
      { find: '@tanstack/react-query', replacement: resolve(process.cwd(), 'node_modules/@tanstack/react-query') },
      { find: 'class-variance-authority', replacement: resolve(process.cwd(), 'node_modules/class-variance-authority') },
      { find: 'clsx', replacement: resolve(process.cwd(), 'node_modules/clsx') },
      { find: 'lucide-react', replacement: resolve(process.cwd(), 'node_modules/lucide-react') },
      { find: 'radix-ui', replacement: resolve(process.cwd(), 'node_modules/radix-ui') },
      { find: 'tailwind-merge', replacement: resolve(process.cwd(), 'node_modules/tailwind-merge') },
      { find: 'tw-animate-css', replacement: resolve(process.cwd(), 'node_modules/tw-animate-css') },
      { find: 'shadcn/tailwind.css', replacement: resolve(process.cwd(), 'node_modules/shadcn/dist/tailwind.css') },
      { find: 'shadcn', replacement: resolve(process.cwd(), 'node_modules/shadcn') },
    ],
  },
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
    proxy: {
      '/admin-api': {
        target: 'http://127.0.0.1:8788',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/admin-api/, ''),
      },
    },
    fs: {
      allow: [resolve(process.cwd(), '../../runtime/apps/admin-dashboard')],
    },
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: process.env.TAURI_ENV_DEBUG ? false : 'esbuild',
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
