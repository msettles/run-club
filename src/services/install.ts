/**
 * "Install app" (PWA) support shared by the top banner and the footer link.
 *
 * Chrome/Edge/Android fire `beforeinstallprompt` once, early in the page load;
 * it's captured here at startup (imported from main.tsx) so any component can
 * offer installing later. iPhone Safari has no prompt: users add the app via
 * Share → Add to Home Screen.
 */
import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
let installedThisSession = false;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault(); // we show our own Install buttons instead of the mini-infobar
    deferredPrompt = e as BeforeInstallPromptEvent;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    installedThisSession = true;
    notify();
  });
}

export const isIOSDevice = (): boolean =>
  typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export const isAppInstalled = (): boolean =>
  installedThisSession ||
  (typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches || Boolean((navigator as any).standalone)));

/** Show the browser's install prompt, if it offered one. */
export async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
  if (!deferredPrompt) return 'unavailable';
  const prompt = deferredPrompt;
  await prompt.prompt();
  const { outcome } = await prompt.userChoice;
  if (outcome === 'accepted') {
    deferredPrompt = null;
    installedThisSession = true;
  }
  notify();
  return outcome;
}

/** Live install state for components. */
export function useInstallState(): { installed: boolean; canPrompt: boolean; isIOS: boolean } {
  const read = () => ({ installed: isAppInstalled(), canPrompt: Boolean(deferredPrompt), isIOS: isIOSDevice() });
  const [state, setState] = useState(read);
  useEffect(() => {
    const update = () => setState(read());
    listeners.add(update);
    update();
    return () => {
      listeners.delete(update);
    };
  }, []);
  return state;
}
