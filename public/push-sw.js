/*
 * Woodland Woodchuckers push notifications (Firebase Cloud Messaging).
 *
 * Registered with scope /push/ so it doesn't replace the PWA's own service
 * worker (Workbox, scope /). It only shows notifications sent from the
 * Firebase console and opens the app when one is tapped.
 */

const DEFAULT_TITLE = 'Woodland Woodchuckers';
const DEFAULT_LINK = '/';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }
  // FCM web payloads carry { notification: { title, body, image }, data: {...}, fcmOptions: { link } }
  const n = payload.notification || {};
  const data = payload.data || {};
  const title = n.title || data.title || DEFAULT_TITLE;
  const link = (payload.fcmOptions && payload.fcmOptions.link) || n.click_action || data.link || DEFAULT_LINK;

  event.waitUntil(
    self.registration.showNotification(title, {
      body: n.body || data.body || '',
      icon: n.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      image: n.image,
      data: { link },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.link) || DEFAULT_LINK, self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => w.url.startsWith(self.location.origin));
      if (open) {
        open.focus();
        return open.navigate ? open.navigate(target) : undefined;
      }
      return self.clients.openWindow(target);
    })
  );
});
