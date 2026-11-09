import React, { useEffect, useState } from 'react';
import { Download, Bell, BellRing, Smartphone, X } from 'lucide-react';
import { enablePushOnThisDevice, getPushStatus, type PushStatus } from '../services/push';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

interface InstallPwaBannerProps {
  // Signed-in runner, so their device is recorded for the admin count (optional).
  pushAccount?: { email: string; memberKey?: string };
}

const PUSH_MESSAGES: Partial<Record<PushStatus, string>> = {
  'needs-install': 'On iPhone, notifications only work from the Home Screen app. Add Woodchuckers to your Home Screen, open it from there, then tap Enable Alerts.',
  blocked: 'Notifications are blocked for this site. Allow them in your browser or phone settings, then tap Enable Alerts again.',
  unsupported: "This browser doesn't support push notifications.",
};

export const InstallPwaBanner: React.FC<InstallPwaBannerProps> = ({ pushAccount }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState<boolean>(false);
  const [isIOS, setIsIOS] = useState<boolean>(false);
  const [showIOSGuide, setShowIOSGuide] = useState<boolean>(false);
  const [pushStatus, setPushStatus] = useState<PushStatus>('off');
  const [pushMessage, setPushMessage] = useState<string | null>(null);
  const [pushBusy, setPushBusy] = useState<boolean>(false);
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

    getPushStatus().then(setPushStatus).catch(() => setPushStatus('unsupported'));

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
    setPushMessage(null);
    setPushBusy(true);
    try {
      const status = await enablePushOnThisDevice(pushAccount);
      setPushStatus(status);
      if (status === 'needs-install') setShowIOSGuide(true);
      setPushMessage(status === 'on' ? null : PUSH_MESSAGES[status] || null);
    } catch (err) {
      console.error('Enabling notifications failed:', err);
      setPushMessage("Couldn't turn on notifications. Please check your connection and try again.");
    } finally {
      setPushBusy(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('woodchuckers_pwa_banner_dismissed', 'true');
  };

  if (dismissed && (isInstalled || pushStatus === 'on')) {
    return null;
  }

  return (
    <div className="bg-gradient-to-r from-woodland-900 to-woodland-950 text-white border-b border-woodland-700/60 px-4 py-2.5 shadow-sm">
      <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <span className="p-1.5 bg-woodland-800 rounded-lg text-woodland-200">
            <Smartphone className="w-4 h-4" />
          </span>
          <div>
            <strong className="font-bold">Runner Mobile App:</strong>{' '}
            <span className="text-woodland-100 hidden sm:inline">
              Install Woodchuckers on your phone for 1-tap check-ins and push notifications.
            </span>
            <span className="text-woodland-100 sm:hidden">
              Install app for 1-tap check-ins &amp; alerts.
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 ml-auto">
          {/* Notification Button */}
          {pushStatus !== 'on' && pushStatus !== 'not-configured' && pushStatus !== 'unsupported' && (
            <button
              onClick={handleEnablePush}
              disabled={pushBusy}
              className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-600 text-stone-950 font-bold rounded-lg transition shadow-xs"
              title="Enable Run Reminders and Alerts"
            >
              <Bell className="w-3.5 h-3.5" />
              <span>{pushBusy ? 'Enabling…' : 'Enable Alerts'}</span>
            </button>
          )}

          {pushStatus === 'on' && (
            <span className="hidden sm:flex items-center gap-1 text-[11px] text-woodland-200 bg-woodland-950/40 px-2 py-0.5 rounded border border-woodland-700/50">
              <BellRing className="w-3 h-3 text-woodland-400" />
              <span>Push Active</span>
            </span>
          )}

          {/* Install Button */}
          {!isInstalled && (
            <button
              onClick={handleInstallClick}
              className="flex items-center gap-1.5 px-3 py-1 bg-white text-woodland-900 hover:bg-woodland-50 font-bold rounded-lg transition shadow-xs"
            >
              <Download className="w-3.5 h-3.5 text-woodland-700" />
              <span>Install PWA</span>
            </button>
          )}

          <button
            onClick={handleDismiss}
            className="p-1 text-woodland-300 hover:text-white rounded"
            title="Dismiss banner"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {pushMessage && (
        <div className="max-w-7xl mx-auto mt-2 text-[11px] text-amber-100" role="status">
          {pushMessage}
        </div>
      )}

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
              <li>Scroll down the menu and tap <strong>&quot;Add to Home Screen&quot;</strong>.</li>
              <li>Tap <strong>&quot;Add&quot;</strong> in the top-right corner.</li>
              <li>Open Woodchuckers from your Home Screen and tap <strong>Enable Alerts</strong> to get club notifications.</li>
            </ol>
            <button
              onClick={() => setShowIOSGuide(false)}
              className="w-full py-2 bg-woodland-600 text-white rounded-xl font-bold text-xs hover:bg-woodland-700 transition"
            >
              Got It!
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
