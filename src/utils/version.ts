/**
 * version.ts - Application version and build tracking
 */

export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0';
export const COMMIT_HASH = typeof __COMMIT_HASH__ !== 'undefined' ? __COMMIT_HASH__ : 'dev';
export const BUILD_NUMBER = typeof __COMMIT_COUNT__ !== 'undefined' ? __COMMIT_COUNT__ : '0';
export const BUILD_TIME = typeof __BUILD_TIME__ !== 'undefined' ? __BUILD_TIME__ : '';

/** Release version from package.json, e.g. "v1.1.0" (bump it there for a release). */
export const VERSION_LABEL = `v${APP_VERSION}`;

/** Full version string with build number (commit count), commit hash and build time */
export const FULL_VERSION = `${VERSION_LABEL} (build ${BUILD_NUMBER} • ${COMMIT_HASH} • ${BUILD_TIME})`;

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
