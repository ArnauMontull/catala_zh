/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'script-defer',
      includeAssets: ['icons/apple-touch-icon.png', 'icons/icon.svg'],
      manifest: {
        name: 'Català 中文',
        short_name: 'Català 中文',
        description: 'Catalan ⇄ Chinese pocket dictionary and review · 加泰罗尼亚语 ⇄ 中文 词典',
        lang: 'en',
        start_url: './',
        scope: './',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#b8402e',
        background_color: '#fbf5ec',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // App shell only: dictionary data lives in IndexedDB, not in the SW cache.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        globIgnores: ['data/**', 'data-sample/**', 'icons/icon-512-maskable.png'],
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/data\//, /^\/data-sample\//],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  build: { target: 'es2020' },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
