import React, { useEffect, useState } from 'react';
import type { AdminDashboardProps } from '../AdminDashboard';
import { DEFAULT_PARTNER, partnerLinks } from '../../data/partner';
import { PartnerThanks } from '../PartnerThanks';

/** Admin: the club's home-base partner (Blue Note): name, links and the thank-you line shown across the app. */
export const PartnerTab: React.FC<AdminDashboardProps> = ({ partner = DEFAULT_PARTNER, onSavePartner }) => {
  const [name, setName] = useState(partner.name);
  const [website, setWebsite] = useState(partner.website || '');
  const [instagram, setInstagram] = useState(partner.instagram || '');
  const [facebook, setFacebook] = useState(partner.facebook || '');
  const [address, setAddress] = useState(partner.address || '');
  const [thanks, setThanks] = useState(partner.thanks || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  // Pick up the saved values once they load.
  useEffect(() => {
    setName(partner.name); setWebsite(partner.website || ''); setInstagram(partner.instagram || '');
    setFacebook(partner.facebook || ''); setAddress(partner.address || ''); setThanks(partner.thanks || '');
  }, [partner]);

  const field = 'mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm';
  const preview = { name: name || 'Partner name', website, instagram, facebook, address, thanks };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm space-y-1">
        <h3 className="font-extrabold text-lg text-stone-900 font-display">Club Partner</h3>
        <p className="text-xs text-stone-500">
          The business that hosts and supports the club. Their name and links appear in the Runs hero, the footer on every page and on the Milestones page.
          Leave a link blank to hide its button.
        </p>
      </div>

      <form
        className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm"
        onSubmit={async (e) => {
          e.preventDefault();
          if (!onSavePartner) return;
          setSaving(true); setMessage(null);
          try {
            await onSavePartner({ name, website, instagram, facebook, address, thanks });
            setMessage({ ok: true, text: 'Saved. Everyone sees the update right away.' });
          } catch (err) {
            setMessage({ ok: false, text: err instanceof Error ? err.message : 'Could not save.' });
          } finally {
            setSaving(false);
          }
        }}
      >
        <label className="block text-xs font-bold text-stone-700">Name *
          <input required value={name} onChange={(e) => setName(e.target.value)} className={field} />
        </label>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="block text-xs font-bold text-stone-700">Website
            <input type="url" value={website} onChange={(e) => setWebsite(e.target.value)} placeholder="https://…" className={field} />
          </label>
          <label className="block text-xs font-bold text-stone-700">Instagram
            <input type="url" value={instagram} onChange={(e) => setInstagram(e.target.value)} placeholder="https://instagram.com/…" className={field} />
          </label>
          <label className="block text-xs font-bold text-stone-700">Facebook
            <input type="url" value={facebook} onChange={(e) => setFacebook(e.target.value)} placeholder="https://facebook.com/…" className={field} />
          </label>
        </div>
        <label className="block text-xs font-bold text-stone-700">Address <span className="font-medium text-stone-400">(adds a Directions link)</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={field} />
        </label>
        <label className="block text-xs font-bold text-stone-700">Thank-you line
          <textarea value={thanks} onChange={(e) => setThanks(e.target.value)} rows={2} maxLength={400} className={field} />
        </label>
        {message && <p role={message.ok ? 'status' : 'alert'} className={`text-sm font-semibold ${message.ok ? 'text-emerald-800' : 'text-amber-900'}`}>{message.text}</p>}
        <button type="submit" disabled={saving} className="rounded-xl bg-stone-950 px-5 py-2.5 text-xs font-bold uppercase tracking-wider text-amber-300 hover:bg-stone-800 disabled:opacity-50 cursor-pointer">
          {saving ? 'Saving…' : 'Save partner'}
        </button>
      </form>

      <div className="space-y-2">
        <h4 className="text-xs font-black uppercase tracking-wider text-stone-500">Preview</h4>
        <PartnerThanks partner={preview} />
        <p className="text-[11px] text-stone-500">Buttons shown: {partnerLinks(preview).map((l) => l.label).join(', ') || 'none yet (add a website, social link or address)'}.</p>
      </div>
    </div>
  );
};
