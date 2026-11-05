import React, { useEffect, useState } from 'react';
import { Download, Bell, BellRing, Smartphone, X } from 'lucide-react';
import { 
  isPushNotificationSupported, 
  getPushPermissionStatus, 
  requestPushPermission 
} from '../services/notifications';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const InstallPwaBanner: React.FC = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<NotificationPermission>('default');
  const [dismissed, setDismissed] = useState<boolean>(() => {
    return localStorage.getItem('woodchuckers_pwa_banner_dismissed') === 'true';
  });

  useEffect(() => {
    // Check if running in standalone PWA mode
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone) {
      setIsInstalled(true);
    }

    // Check iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for Android beforeinstallprompt
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    if (isPushNotificationSupported()) {
      setPushStatus(getPushPermissionStatus());
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      if (choice.outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const handleEnablePush = async () => {
    const granted = await requestPushPermission();
    setPushStatus(granted ? 'granted' : 'denied');
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('woodchuckers_pwa_banner_dismissed', 'true');
  };

  if (dismissed && (isInstalled || pushStatus === 'granted')) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-emerald-800 to-emerald-900 text-white border-b border-emerald-700/60 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-emerald-700/80 rounded-lg text-emerald-200">
            <Smartphone className="w-4 h-4" />
          </span>
          <div>
            <strong className="font-bold">Runner Mobile App:</strong>{' '}
            <span className="text-emerald-100 hidden sm:inline">
              Install Woodchuckers on your phone for 1-tap check-ins and push notifications.
            </span>
            <span className="text-emerald-100 sm:hidden">
              Install app for 1-tap check-ins & alerts.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Notification Button */}
          {pushStatus !== 'granted' && (
            <button
              onClick={handleEnablePush}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg transition shadow-xs"
              title="Enable Run Reminders and Alerts"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Enable Alerts</span>
            </button>
          )}

          {pushStatus === 'granted' && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-emerald-200 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-700/50">
              <BellRing className="w-3 h-3 text-emerald-400" />
              <span>Push Active</span>
            </span>
          )}

          {/* Install Button */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-emerald-900 hover:bg-emerald-50 font-bold rounded-lg transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-emerald-700" />
              <span>Install PWA</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="p-1 text-emerald-300 hover:text-white rounded"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS Safari Guide Modal/Tooltip */}
      {showIOSGuide && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-stone-900/70 p-4">
          <div className="bg-white text-stone-900 rounded-2xl max-w-sm w-full p-5 shadow-2xl border border-stone-200 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-base flex items-center gap-2">
                <span>📲</span> Install on iPhone / iPad
              </h4>
              <button
                onClick={() => setShowIOSGuide(false)}
                className="text-stone-400 hover:text-stone-700 p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <ol className="text-xs text-stone-600 space-y-2.5 list-decimal list-inside bg-stone-50 p-3.5 rounded-xl border border-stone-200">
              <li>In Safari, tap the <strong>Share</strong> button at the bottom of the screen (the square with an arrow pointing up).</li>
              <li>Scroll down the menu and tap <strong>"Add to Home Screen"</strong>.</li>
              <li>Tap <strong>"Add"</strong> in the top-right corner.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-emerald-600 text-white rounded-xl font-bold text-xs hover:bg-emerald-700 transition"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
