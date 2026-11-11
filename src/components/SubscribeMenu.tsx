import React, { useState } from 'react';
import { CalendarPlus, Check } from 'lucide-react';

/** Subscribe-to-calendar menu for the public /calendar.ics feed. */
export const SubscribeMenu: React.FC = () => {
  const [copied, setCopied] = useState(false);
  const feedUrl = `${window.location.origin}/calendar.ics`;
  const webcalUrl = `webcal://${window.location.host}/calendar.ics`;
  const item = 'block w-full rounded-lg px-3 py-2 text-left font-semibold hover:bg-stone-100';

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(feedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard blocked: the link below is selectable instead.
      setCopied(false);
    }
  };

  return (
    <details className="relative">
      <summary className="flex cursor-pointer list-none items-center gap-2 rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm font-semibold text-stone-800 hover:bg-stone-100">
        <CalendarPlus className="w-4 h-4" />
        <span>Subscribe to calendar</span>
      </summary>
      <div className="absolute left-0 z-20 mt-2 w-72 space-y-1 rounded-xl border border-stone-200 bg-white p-2 text-sm shadow-lg">
        <a className={item} href={webcalUrl}>Apple Calendar</a>
        <a className={item} target="_blank" rel="noreferrer" href={`https://calendar.google.com/calendar/r?cid=${encodeURIComponent(webcalUrl)}`}>Google Calendar</a>
        <a className={item} target="_blank" rel="noreferrer" href={`https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(feedUrl)}&name=${encodeURIComponent('Woodland Woodchuckers Runs')}`}>Outlook.com</a>
        <div className="border-t border-stone-100 pt-2 space-y-1.5">
          <button type="button" className={`${item} flex items-center justify-between`} onClick={() => { void copy(); }}>
            <span>{copied ? 'Link copied!' : 'Copy feed link'}</span>
            {copied && <Check className="w-4 h-4 text-emerald-600" />}
          </button>
          <input
            aria-label="Calendar feed link"
            readOnly
            value={feedUrl}
            onFocus={(e) => e.target.select()}
            className="w-full rounded-lg border border-stone-200 bg-stone-50 px-2 py-1.5 text-[11px] text-stone-600"
          />
          <p className="px-1 text-[11px] leading-snug text-stone-500">
            Other apps: add a calendar subscription by URL and paste this link.
          </p>
        </div>
      </div>
    </details>
  );
};
