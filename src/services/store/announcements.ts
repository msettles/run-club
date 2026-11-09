/** Club store operations: announcements. */
import { isFirebaseConfigured, db } from '../firebase';
import {
  setDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { 
  ClubNotification, 
  storeNotification, 
} from '../notifications';
import type { StoreState } from './state';

export function createAnnouncementOps(ctx: StoreState) {
  const {
    setNotifications,
    currentMember,
  } = ctx;

  /** Post a club announcement to everyone's bell feed (admins). Phones get it only via the Firebase console. */
  const sendPushAnnouncement = async (title: string, body: string) => {
    const notif: ClubNotification = {
      id: `notif-${Date.now()}`,
      title: title.trim(),
      body: body.trim(),
      timestamp: new Date().toISOString(),
      sender: currentMember.name || 'Woodchuckers',
      kind: 'announcement',
    };
    if (isFirebaseConfigured && db) {
      // The live announcements listener adds it to the feed (including this browser).
      const { kind: _k, ...stored } = notif;
      await setDoc(doc(db, 'announcements', notif.id), stored);
      return;
    }
    storeNotification(notif);
    setNotifications((prev) => [notif, ...prev.filter((n) => n.id !== notif.id)]);
  };

  /** Remove an announcement from everyone's bell feed (admins). */
  const deleteAnnouncement = async (id: string) => {
    if (isFirebaseConfigured && db) {
      await deleteDoc(doc(db, 'announcements', id));
    }
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };


  return { sendPushAnnouncement, deleteAnnouncement };
}
