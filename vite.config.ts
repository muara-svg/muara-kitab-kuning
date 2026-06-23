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
      // Konfigurasi Sistem Service Worker PWA agar terintegrasi sempurna di WebView Capacitor
      VitePWA({
        registerType: 'autoUpdate',
        injectRegister: 'inline',
        devOptions: {
          enabled: false // Menghindari interferensi cache pada mode development
        },
        workbox: {
          // Melakukan pre-caching seluruh aset penting demi performa memuat aplikasi instan
          globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,ttf,eot}'],
          // Memastikan rute jatuh ke berkas index.html saat luring (SPA mode fallback)
          navigateFallback: 'index.html',
          // Menghindari crash akibat kegagalan request eksternal saat luring
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/images\.unsplash\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'unsplash-images-cache',
                expiration: {
                  maxEntries: 50,
                  maxAgeSeconds: 30 * 24 * 60 * 60 // Cache foto-foto santri selama 30 hari
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
              }
            },
            {
              urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts',
                expiration: {
                  maxEntries: 10,
                  maxAgeSeconds: 365 * 24 * 60 * 60 // 1 Tahun
                },
                cacheableResponse: {
                  statuses: [0, 200]
                }
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
            {
              src: 'assets/app-icon-192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'assets/app-icon-512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    // =========================================================================
    // 🛡️ SUNTIKAN INTEGRATION: MENGECUALIKAN MODUL NATIVE HP DI LINGKUNGAN CLOUD WEB (VERCEL)
    // =========================================================================
    build: {
      rollupOptions: {
        external: [
          '@capacitor/local-notifications',
          '@capacitor/app',
          '@capacitor/android',
          '@capacitor/core'
        ],
        output: {
          globals: {
            '@capacitor/local-notifications': 'window.CapacitorLocalNotifications || {}',
            '@capacitor/app': 'window.CapacitorApp || {}',
            '@capacitor/android': 'window.CapacitorAndroid || {}',
            '@capacitor/core': 'window.CapacitorCore || {}'
          }
        }
      }
    },
    // =========================================================================
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});