import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'child_process'
import fs from 'fs'

let commitHash = 'dev'
let commitCount = '0'
try {
  commitHash = execSync('git rev-parse --short HEAD').toString().trim()
  commitCount = execSync('git rev-list --count HEAD').toString().trim()
} catch {
  // fallback if git is unavailable
}

let appVersion = '1.0.0'
try {
  const pkg = JSON.parse(fs.readFileSync('./package.json', 'utf-8'))
  appVersion = pkg.version || '1.0.0'
} catch {
  // fallback
}

const now = new Date()
const buildTime = now.toLocaleString('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
  timeZone: 'America/Los_Angeles',
})

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __COMMIT_HASH__: JSON.stringify(commitHash),
    __COMMIT_COUNT__: JSON.stringify(commitCount),
    __BUILD_TIME__: JSON.stringify(buildTime),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Firebase's hosted OAuth callback/iframe must reach the server rather
        // than the offline app shell; intercepting them silently loses sign-in.
        navigateFallbackDenylist: [/^\/__/],
        // Staff-only screens, the route generator and local-mode sample data are
        // not downloaded for every visitor. They are cached when first opened.
        globIgnores: ['**/node_modules/**/*', 'sw.js', 'workbox-*.js'].concat(
          ['AdminDashboard', 'RouteStudioModal', 'RouteChoicesEditor', 'NewRunModal', 'EditRunModal', 'BrandAssetsModal', 'FirebaseSetupGuide', 'initialData', 'worker']
            .map((name) => `assets/${name}-*.js`)),
        runtimeCaching: [{
          // Build output names contain a content hash, so a cached copy never goes stale.
          urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.startsWith('/assets/'),
          handler: 'CacheFirst',
          options: { cacheName: 'on-demand-assets', expiration: { maxEntries: 40 }, cacheableResponse: { statuses: [200] } },
        }],
      },
      includeAssets: ['favicon.ico', 'runclub-icon.png', 'apple-touch-icon.png', 'Woodchucker2.jpg', 'Woodchucker2026.png', 'Woodchucker2026-black-cream.png'],
      manifest: {
        name: 'Woodland Woodchuckers Run Club',
        short_name: 'Woodchuckers',
        description: 'Run schedules, member check-ins, and GPX trail routes for Woodland Woodchuckers',
        theme_color: '#1a607c',
        background_color: '#1a607c',
        display: 'standalone',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ]
      }
    })
  ],
  build: {
    manifest: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('commonjsHelpers')) return 'vendor-interop';
          if (id.includes('/node_modules/leaflet/')) return 'vendor-leaflet';
          if (/\/node_modules\/(?:firebase\/(?:app|auth|firestore)\/|@firebase\/(?:app|auth|firestore|component|util|logger|app-check-interop|auth-interop)\/)/.test(id)) return 'vendor-firebase';
          if (id.includes('/node_modules/canvas-confetti/')) return 'vendor-confetti';
        },
      },
    },
  },
})
