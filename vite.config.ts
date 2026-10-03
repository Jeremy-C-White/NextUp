import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    base: './',
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        manifest: {
          name: 'NextUp',
          short_name: 'NextUp',
          description: 'NextUp v1.0.59 with MP4/HLS-first phone playback and VLC fallback for MKV.',
          start_url: '.',
          scope: '.',
          display: 'standalone',
          theme_color: '#020617',
          background_color: '#020617',
          icons: [
            { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
            { src: 'icon-512.png', sizes: '512x512', type: 'image/png' }
          ]
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: ({ url, request }) => request.destination === 'image' &&
                (url.hostname === 'image.tmdb.org' || url.hostname === 'static.tvmaze.com'),
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'nextup-artwork-v1',
                cacheableResponse: { statuses: [0, 200] },
                expiration: {
                  maxEntries: 180,
                  maxAgeSeconds: 30 * 24 * 60 * 60,
                  purgeOnQuotaError: true
                }
              }
            }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    envPrefix: ['VITE_', 'TMDB_'],
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
