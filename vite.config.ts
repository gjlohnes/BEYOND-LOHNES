import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      strategies: 'generateSW',
      manifest: {
        name: 'BEYOND', short_name: 'BEYOND', display: 'standalone',
        theme_color: '#0b0b0d', background_color: '#0b0b0d', start_url: './#/today',
        icons: [
          { src: './icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: { navigateFallback: 'index.html' },
    }),
  ],
});
