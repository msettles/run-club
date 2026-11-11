import React from 'react';
import { ClubPartner, partnerLinks } from '../data/partner';

const linkClass = 'inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-stone-900 shadow-sm transition hover:bg-amber-100';

/** The thank-you to the club's home-base partner, with links out to their site and socials. */
export const PartnerThanks: React.FC<{ partner: ClubPartner; compact?: boolean }> = ({ partner, compact = false }) => {
  const links = partnerLinks(partner);
  return (
    <section
      aria-label={`Thank you to ${partner.name}`}
      className={`rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 via-white to-amber-50 ${compact ? 'p-3.5' : 'p-5'}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className={`${compact ? 'text-2xl' : 'text-3xl'} leading-none`} aria-hidden="true">🍺</span>
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-wider text-amber-800">Proudly hosted &amp; supported by</p>
            <h3 className={`${compact ? 'text-base' : 'text-lg'} font-black font-display text-stone-900 leading-tight`}>{partner.name}</h3>
            {partner.thanks && <p className="mt-1 text-xs leading-relaxed text-stone-600">{partner.thanks}</p>}
          </div>
        </div>
        {links.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            {links.map((l) => (
              <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                <span aria-hidden="true">{l.icon}</span>
                {l.label}
                <span className="sr-only"> (opens in a new tab)</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};
