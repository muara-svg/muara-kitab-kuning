import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      {
        name: 'firestore-interceptor',
        resolveId(source, importer) {
          if (
            source === 'firebase/firestore' && 
            importer && 
            !importer.includes('customFirestore.ts') && 
            !importer.includes('firebaseConfig.ts')
          ) {
            return path.resolve(__dirname, 'src/lib/customFirestore.ts');
          }
          return null;
        }
      },
      react(), 
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        devOptions: { enabled: false },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,eot}'],
          navigateFallback: 'index.html',
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: { maxEntries: 10, maxAgeSeconds: 365 * 24 * 60 * 60 },
                cacheableResponse: { statuses: [0, 200] }
              }
            }
          ]
        },
        manifest: {
          name: 'MUARA - Kitab Kuning Digital',
          short_name: 'MUARA',
          description: 'Aplikasi Pembelajaran Kitab Kuning Digital Interaktif Indonesia',
          theme_color: '#064e3b',
          background_color: '#f8fafc',
          display: 'standalone',
          orientation: 'portrait',
          start_url: '.',
          icons: [
            { src: 'assets/app-icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: 'assets/app-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
          ]
        }
      })
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});