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
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'woodchuck.svg', 'Woodchucker2.jpg', 'Woodchucker2026.png'],
      manifest: {
        name: 'Woodland Woodchuckers Run Club',
        short_name: 'Woodchuckers',
        description: 'Run schedules, member check-ins, and GPX trail routes for Woodland Woodchuckers',
        theme_color: '#1a607c',
        background_color: '#edf7fa',
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
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 600,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-leaflet': ['leaflet'],
          'vendor-firebase': ['firebase/app', 'firebase/auth', 'firebase/firestore'],
          'vendor-confetti': ['canvas-confetti'],
        },
      },
    },
  },
})
