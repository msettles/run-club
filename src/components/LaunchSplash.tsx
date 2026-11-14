import { useEffect } from 'react';

/** Dismiss the static launch artwork only after React has mounted. */
export function LaunchSplash() {
  useEffect(() => {
    const splash = document.getElementById('launch-splash');
    if (!splash) return;

    const installed = window.matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
    if (!installed) {
      splash.remove();
      return;
    }

    let fadeTimer: ReturnType<typeof setTimeout> | undefined;
    // Briefly hold the artwork on fast launches, without waiting for network data.
    const holdTimer = setTimeout(() => {
      splash.classList.add('is-ready');
      fadeTimer = setTimeout(() => splash.remove(), 180);
    }, 800);

    return () => {
      clearTimeout(holdTimer);
      clearTimeout(fadeTimer);
    };
  }, []);

  return null;
}
