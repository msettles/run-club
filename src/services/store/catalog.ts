/**
 * Club store operations: the starter pack of milestones, badges and special events.
 *
 * A new club starts with a preset (data/catalog.ts). It is written into Firestore ONCE, and a marker
 * (settings/catalog) records that. From then on those are ordinary documents the club can edit, delete or
 * add to; nothing about them is built in. "Add back defaults" restores any starter items that were deleted
 * without touching anything that was edited.
 */
import { doc, writeBatch } from 'firebase/firestore';
import { isFirebaseConfigured, db } from '../firebase';
import { CLUB_MILESTONES, INITIAL_BADGES, INITIAL_SPECIAL_EVENTS } from '../../data/catalog';
import { cleanFirestoreData } from './helpers';
import type { StoreState } from './state';

/** A starter item as saved: just its content (no "built in" flag, so it can be edited or deleted like anything else). */
const asSaved = <T extends object>(item: T): T => {
  const { isDefault: _isDefault, ...rest } = item as T & { isDefault?: boolean };
  return rest as T;
};

export function createCatalogOps(ctx: StoreState) {
  const { badgeDocs, milestoneDocs, specialEventDocs, setBadges, setMilestones, setSpecialEvents, catalogSeeded, setCatalogSeeded } = ctx;

  /**
   * Write the starter items that aren't saved yet (never overwriting an existing document), and mark the catalog
   * as installed. Returns how many items were added. Admin only (the rules enforce it).
   */
  const installStarterCatalog = async (): Promise<number> => {
    const badges = INITIAL_BADGES.filter((b) => !badgeDocs.some((x) => x.id === b.id)).map(asSaved);
    const milestones = CLUB_MILESTONES.filter((m) => !milestoneDocs.some((x) => x.id === m.id)).map(asSaved);
    const events = INITIAL_SPECIAL_EVENTS.filter((e) => !specialEventDocs.some((x) => x.id === e.id)).map(asSaved);
    if (isFirebaseConfigured && db) {
      const batch = writeBatch(db);
      for (const b of badges) batch.set(doc(db, 'badges', b.id), cleanFirestoreData(b));
      for (const m of milestones) batch.set(doc(db, 'milestones', m.id), cleanFirestoreData(m));
      for (const e of events) batch.set(doc(db, 'special_events', e.id), cleanFirestoreData(e));
      batch.set(doc(db, 'settings', 'catalog'), { seeded: true, seededAt: new Date().toISOString() });
      await batch.commit();
    }
    setBadges((prev) => [...prev, ...badges]);
    setMilestones((prev) => [...prev, ...milestones]);
    setSpecialEvents((prev) => [...prev, ...events]);
    setCatalogSeeded(true);
    return badges.length + milestones.length + events.length;
  };

  /** Make sure the starter pack has been written before an edit or delete, so those act on real documents. */
  const ensureCatalogSeeded = async (): Promise<void> => {
    if (!catalogSeeded) await installStarterCatalog();
  };

  return { installStarterCatalog, ensureCatalogSeeded };
}
