import React, { useEffect, useState } from 'react';
import { Bell, BellOff, BellRing } from 'lucide-react';
import { disablePushOnThisDevice, enablePushOnThisDevice, getPushStatus, type PushStatus } from '../services/push';

const HINTS: Partial<Record<PushStatus, string>> = {
  'needs-install': 'On iPhone: add Woodchuckers to your Home Screen, open it from there, then turn this on.',
  blocked: 'Blocked in your browser or phone settings. Allow notifications for this site, then try again.',
  unsupported: "This browser can't receive notifications.",
};

/** Turn club notifications on or off for THIS device (profile menu). */
export const NotificationsToggle: React.FC<{ email?: string }> = ({ email }) => {
  const [status, setStatus] = useState<PushStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getPushStatus().then(setStatus).catch(() => setStatus('unsupported'));
  }, []);

  if (status === null || status === 'not-configured') return null;

  const on = status === 'on';
  const canToggle = status === 'on' || status === 'off' || status === 'blocked';

  const toggle = async () => {
    setBusy(true);
    setError(null);
    try {
      if (on) {
        await disablePushOnThisDevice();
        setStatus('off');
      } else {
        setStatus(await enablePushOnThisDevice(email ? { email } : undefined));
      }
    } catch (err) {
      console.error('Changing notifications failed:', err);
      setError("Couldn't change notifications. Please check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-2.5 py-1.5 space-y-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy || !canToggle}
        role="switch"
        aria-checked={on}
        className="w-full flex items-center justify-between gap-2 text-xs font-semibold text-stone-700 hover:bg-stone-100 rounded-lg px-0 py-0.5 disabled:opacity-60 cursor-pointer"
      >
        <span className="flex items-center gap-2">
          {on ? <BellRing className="w-3.5 h-3.5 text-emerald-600" /> : status === 'blocked' ? <BellOff className="w-3.5 h-3.5 text-stone-400" /> : <Bell className="w-3.5 h-3.5 text-amber-600" />}
          <span>Notifications on this device</span>
        </span>
        <span
          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
            on ? 'bg-emerald-100 text-emerald-800' : 'bg-stone-200 text-stone-600'
          }`}
        >
          {busy ? '…' : on ? 'On' : 'Off'}
        </span>
      </button>
      {(error || HINTS[status]) && <p className="text-[10px] text-stone-500 leading-snug">{error || HINTS[status]}</p>}
    </div>
  );
};
