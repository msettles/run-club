import { expect, it, vi } from 'vitest';
import { DEFAULT_PARTNER, directionsUrl, partnerLinks, safeUrl } from './partner';
import { createPartnerOps } from '../services/store/partner';

vi.mock('../services/firebase', () => ({ isFirebaseConfigured: false, db: null }));

it('only https links are ever used', () => {
  expect(safeUrl('https://example.com/a')).toBe('https://example.com/a');
  expect(safeUrl('http://example.com')).toBeUndefined();
  expect(safeUrl('javascript:alert(1)')).toBeUndefined();
  expect(safeUrl('not a url')).toBeUndefined();
  expect(safeUrl('')).toBeUndefined();
  expect(safeUrl(undefined)).toBeUndefined();
});

it('shows only the links that are set, and Directions whenever there is an address', () => {
  expect(partnerLinks({ name: 'X' })).toEqual([]);
  expect(partnerLinks(DEFAULT_PARTNER).map((l) => l.label)).toEqual(['Directions']); // out of the box: no unverified links
  const all = partnerLinks({ name: 'X', website: 'https://x.com', instagram: 'https://instagram.com/x', facebook: 'http://insecure.example', address: '1 Main St' });
  expect(all.map((l) => l.label)).toEqual(['Website', 'Instagram', 'Directions']); // the http link is dropped
  expect(directionsUrl({ name: 'Blue Note', address: '750 Dead Cat Alley' })).toContain('google.com/maps/search');
  expect(directionsUrl({ name: 'No address' })).toBeUndefined();
});

it('saving requires a name and https links, and leaves blanks out', async () => {
  let saved = DEFAULT_PARTNER;
  const { savePartner } = createPartnerOps({ setPartner: (p: typeof saved) => { saved = p; } } as never);
  await expect(savePartner({ name: '  ' })).rejects.toThrow('name');
  await expect(savePartner({ name: 'X', website: 'http://x.com' })).rejects.toThrow('Website must be a full link starting with https://');
  await expect(savePartner({ name: 'X', instagram: 'javascript:alert(1)' })).rejects.toThrow('Instagram');
  const result = await savePartner({ name: ' Blue Note ', website: ' https://x.com ', instagram: '', facebook: '  ', address: '', thanks: 'Thanks!' });
  expect(result).toEqual({ name: 'Blue Note', website: 'https://x.com/', instagram: undefined, facebook: undefined, address: undefined, thanks: 'Thanks!' });
  expect(saved.name).toBe('Blue Note');
});
