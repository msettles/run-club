/*
 * Woodland Woodchuckers push notifications (Firebase Cloud Messaging).
 *
 * Registered with scope /push/ so it doesn't replace the PWA's own service
 * worker (Workbox, scope /). It only shows notifications sent from the
 * Firebase console and opens the app when one is tapped.
 */

const DEFAULT_TITLE = 'Woodland Woodchuckers';
const DEFAULT_LINK = '/';

// Received pushes are kept in IndexedDB (same database the app reads) so they
// also show in the app's bell feed. Keep the newest 50.
const INBOX_DB = 'woodchuckers-push';
const INBOX_STORE = 'messages';
const INBOX_MAX = 50;

function openInbox() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(INBOX_DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(INBOX_STORE, { keyPath: 'id' });
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function saveToInbox(message) {
  const db = await openInbox();
  await new Promise((resolve, reject) => {
    const tx = db.transaction(INBOX_STORE, 'readwrite');
    const store = tx.objectStore(INBOX_STORE);
    store.put(message);
    const all = store.getAll();
    all.onsuccess = () => {
      const extra = all.result.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(INBOX_MAX);
      extra.forEach((m) => store.delete(m.id));
    };
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach((w) => w.postMessage({ type: 'woodchuckers-push-received', message }));
}

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { notification: { body: event.data ? event.data.text() : '' } };
  }
  // FCM web payloads carry { notification: { title, body, image }, data: {...}, fcmOptions: { link } }
  const n = payload.notification || {};
  const data = payload.data || {};
  const title = n.title || data.title || DEFAULT_TITLE;
  const link = (payload.fcmOptions && payload.fcmOptions.link) || n.click_action || data.link || DEFAULT_LINK;

  const body = n.body || data.body || '';
  const message = {
    id: payload.fcmMessageId || `push-${Date.now()}`,
    title,
    body,
    link,
    timestamp: new Date().toISOString(),
  };

  event.waitUntil(Promise.all([saveToInbox(message).catch(() => {}),
    self.registration.showNotification(title, {
      body,
      icon: n.icon || '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      image: n.image,
      data: { link },
    }),
  ]));
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
