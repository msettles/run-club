// Web Push Notification & Browser Notification Service for Woodland Woodchuckers

export interface ClubNotification {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  targetRunId?: string;
  sender: string;
  read?: boolean;
  kind?: 'announcement' | 'push'; // push = received on this device from the Firebase console
  link?: string;
}

const NOTIFICATIONS_STORAGE_KEY = 'woodchuckers_notifications_v1';
export function showLocalNotification(title: string, body: string, url?: string): void {
  if (typeof window === 'undefined' || !('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, {
          body,
          icon: '/woodchuck.svg',
          badge: '/woodchuck.svg',
          vibrate: [100, 50, 100],
          data: { url: url || '/' },
        } as NotificationOptions);
      });
    } else {
      new Notification(title, {
        body,
        icon: '/woodchuck.svg',
      });
    }
  } catch (e) {
    console.warn('Unable to show notification:', e);
  }
}

export function getStoredNotifications(): ClubNotification[] {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function storeNotification(notif: ClubNotification): void {
  try {
    const existing = getStoredNotifications();
    const updated = [notif, ...existing.slice(0, 49)];
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to store notification:', e);
  }
}
