/**
 * version.ts - Application version and build tracking
 */

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.0.0';
export const COMMIT_HASH = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
export const BUILD_NUMBER = typeof __COMMIT_COUNT__ !== 'undefined' ? __COMMIT_COUNT__ : '0';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

/** Concise version tag for header badges: e.g. "v1.0.31" */
export const VERSION_LABEL = `v1.0.${BUILD_NUMBER}`;

/** Full version string with commit hash and timestamp */
export const FULL_VERSION = `${VERSION_LABEL} (${COMMIT_HASH} • ${BUILD_TIME})`;

/**
 * Checks for Service Worker updates, purges stale browser caches, and performs a hard refresh.
 */
export async function forceAppUpdate(): Promise<void> {
  if ('serviceWorker' in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations();
      for (const reg of registrations) {
        await reg.update();
      }
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      }
    } catch (e) {
      console.warn('Error clearing service worker caches:', e);
    }
  }
  window.location.reload();
}
