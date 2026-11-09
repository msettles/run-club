/**
 * Phone / browser push notifications via Firebase Cloud Messaging (FCM).
 *
 * Option A (free, Spark plan): devices sign up here; an admin sends from the
 * Firebase console (Messaging → New campaign → Notifications, target this web
 * app). Nothing in the app can send pushes: that needs server credentials.
 *
 * Each device: browser permission → push service worker (/push-sw.js, scope
 * /push/) → FCM token. Signed-in runners' devices are recorded in
 * push_devices/{sha256(token)} so admins can see how many are signed up.
 */
import { getMessaging, getToken, deleteToken, isSupported } from 'firebase/messaging';
import { doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { app, db, isFirebaseConfigured } from './firebase';

const VAPID_KEY = import.meta.env.VITE_FIREBASE_VAPID_KEY || '';
const ENABLED_KEY = 'woodchuckers_push_device_v1'; // this device signed up (token saved)

export type PushStatus = 'unsupported' | 'needs-install' | 'not-configured' | 'blocked' | 'off' | 'on';

const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone);

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/** Where this device stands. iPhones only support web push from the Home Screen app. */
export async function getPushStatus(): Promise<PushStatus> {
  if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) {
    return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  }
  if (!isFirebaseConfigured || !app || !VAPID_KEY) return 'not-configured';
  if (!(await isSupported().catch(() => false))) return isIOS() && !isStandalone() ? 'needs-install' : 'unsupported';
  if (Notification.permission === 'denied') return 'blocked';
  return Notification.permission === 'granted' && localStorage.getItem(ENABLED_KEY) ? 'on' : 'off';
}

async function pushRegistration(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/push-sw.js', { scope: '/push/' });
}

/**
 * Sign this device up for club notifications. Must be called from a tap
 * (browsers only show the permission prompt in response to a user gesture).
 */
export async function enablePushOnThisDevice(account?: { email?: string; memberKey?: string }): Promise<PushStatus> {
  const status = await getPushStatus();
  if (status === 'unsupported' || status === 'needs-install' || status === 'not-configured' || status === 'blocked') {
    return status;
  }
  const permission = await Notification.requestPermission();
  if (permission !== 'granted') return permission === 'denied' ? 'blocked' : 'off';

  const registration = await pushRegistration();
  const token = await getToken(getMessaging(app!), { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
  if (!token) throw new Error('Could not get a notification token for this device.');

  if (db && account?.email) {
    await setDoc(doc(db, 'push_devices', await sha256Hex(token)), {
      token,
      userEmail: account.email.toLowerCase(),
      memberKey: account.memberKey || null,
      platform: isIOS() ? 'ios' : /android/i.test(navigator.userAgent) ? 'android' : 'desktop',
      updatedAt: serverTimestamp(),
    });
  }
  try {
    localStorage.setItem(ENABLED_KEY, '1');
  } catch {
    // ignore
  }
  return 'on';
}

/** Turn notifications off on this device. */
export async function disablePushOnThisDevice(): Promise<void> {
  if (!app) return;
  try {
    const registration = await pushRegistration();
    const messaging = getMessaging(app);
    const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }).catch(() => null);
    if (token && db) {
      await deleteDoc(doc(db, 'push_devices', await sha256Hex(token))).catch(() => {});
    }
    await deleteToken(messaging).catch(() => {});
  } finally {
    try {
      localStorage.removeItem(ENABLED_KEY);
    } catch {
      // ignore
    }
  }
}

// ---- Received pushes (saved by public/push-sw.js) for the bell feed ----

export interface ReceivedPush {
  id: string;
  title: string;
  body: string;
  link?: string;
  timestamp: string;
}

/** Pushes this device has received (newest first). Empty if none or unsupported. */
export function readReceivedPushes(): Promise<ReceivedPush[]> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve([]);
    const req = indexedDB.open('woodchuckers-push', 1);
    req.onupgradeneeded = () => req.result.createObjectStore('messages', { keyPath: 'id' });
    req.onerror = () => resolve([]);
    req.onsuccess = () => {
      const db = req.result;
      try {
        const all = db.transaction('messages', 'readonly').objectStore('messages').getAll();
        all.onsuccess = () => {
          resolve((all.result as ReceivedPush[]).sort((a, b) => b.timestamp.localeCompare(a.timestamp)));
          db.close();
        };
        all.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    };
  });
}

/** Call back whenever the push worker receives a push while the app is open. */
export function onPushReceived(cb: (msg: ReceivedPush) => void): () => void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return () => {};
  const handler = (e: MessageEvent) => {
    if (e.data?.type === 'woodchuckers-push-received' && e.data.message) cb(e.data.message as ReceivedPush);
  };
  navigator.serviceWorker.addEventListener('message', handler);
  return () => navigator.serviceWorker.removeEventListener('message', handler);
}
