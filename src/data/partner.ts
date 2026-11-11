/**
 * The club's home-base partner (Blue Note Brewing Company): they buy the milestone gear and take $1 off draft beer.
 * The defaults below are shown until an admin saves their own in Admin > Partner (settings/partner).
 * Links are only shown when set, and only https links are ever used.
 */
export interface ClubPartner {
  name: string;
  website?: string;
  instagram?: string;
  facebook?: string;
  address?: string;
  /** The thank-you line shown with the partner. */
  thanks?: string;
}

export const DEFAULT_PARTNER: ClubPartner = {
  name: 'Blue Note Brewing Company',
  address: '750 Dead Cat Alley, Woodland, CA 95695',
  thanks: 'Blue Note buys every shirt, hat, mug and bottle our runners earn and takes $1 off your draft beer. Thank them with a visit!',
};

/** An https URL, or undefined (blank, malformed, or any other scheme such as javascript:). */
export function safeUrl(value?: string): string | undefined {
  if (!value || !value.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/** A Google Maps link to the partner's address, if one is set. */
export function directionsUrl(partner: ClubPartner): string | undefined {
  const query = [partner.name, partner.address].filter(Boolean).join(', ');
  return partner.address?.trim() ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : undefined;
}

export interface PartnerLink { label: string; url: string; icon: string }

/** The links to show, in order, leaving out any that aren't set. */
export function partnerLinks(partner: ClubPartner): PartnerLink[] {
  return [
    { label: 'Website', url: safeUrl(partner.website), icon: '🌐' },
    { label: 'Instagram', url: safeUrl(partner.instagram), icon: '📸' },
    { label: 'Facebook', url: safeUrl(partner.facebook), icon: '👍' },
    { label: 'Directions', url: directionsUrl(partner), icon: '📍' },
  ].filter((l): l is PartnerLink => Boolean(l.url));
}
