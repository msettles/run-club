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
const PUSH_ENABLED_KEY = 'woodchuckers_push_enabled_v1';

export function isPushNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator;
}

export function getPushPermissionStatus(): NotificationPermission {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  return Notification.permission;
}

export async function requestPushPermission(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    console.warn('Push notifications are not supported in this browser.');
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    const granted = permission === 'granted';
    localStorage.setItem(PUSH_ENABLED_KEY, granted ? 'true' : 'false');
    
    if (granted) {
      // Send a welcome notification
      showLocalNotification(
        '🦫 Woodchuckers Alerts Active!',
        'You will now receive run reminders, weather alerts, and check-in announcements.'
      );
    }
    return granted;
  } catch (error) {
    console.error('Failed to request notification permission:', error);
    return false;
  }
}

export function showLocalNotification(title: string, body: string, url?: string): void {
  if (getPushPermissionStatus() !== 'granted') return;

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
