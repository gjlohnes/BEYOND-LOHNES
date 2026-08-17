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
        theme_color: '#0b0b0d', background_color: '#0b0b0d', start_url: './#/today'
      },
      workbox: { navigateFallback: 'index.html' }
    })
  ]
});
