/** Club store operations: the home-base partner (Admin). */
import { doc, setDoc } from 'firebase/firestore';
import { isFirebaseConfigured, db } from '../firebase';
import { safeUrl, type ClubPartner } from '../../data/partner';
import { cleanFirestoreData } from './helpers';
import type { StoreState } from './state';

export function createPartnerOps(ctx: StoreState) {
  const { setPartner } = ctx;

  /** Save the partner's name, links and thank-you line. Links must be https; blanks are left out. */
  const savePartner = async (input: ClubPartner): Promise<ClubPartner> => {
    const name = input.name.trim();
    if (!name) throw new Error('Give the partner a name.');
    const link = (value: string | undefined, label: string): string | undefined => {
      if (!value || !value.trim()) return undefined;
      const url = safeUrl(value);
      if (!url) throw new Error(`${label} must be a full link starting with https://`);
      return url;
    };
    const partner: ClubPartner = {
      name,
      website: link(input.website, 'Website'),
      instagram: link(input.instagram, 'Instagram'),
      facebook: link(input.facebook, 'Facebook'),
      address: input.address?.trim() || undefined,
      thanks: input.thanks?.trim() || undefined,
    };
    if (isFirebaseConfigured && db) await setDoc(doc(db, 'settings', 'partner'), cleanFirestoreData(partner));
    setPartner(partner);
    return partner;
  };

  return { savePartner };
}
