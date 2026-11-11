/**
 * Turns the three planned import files into the records the club stores.
 *
 * Pure and deterministic: nothing here talks to Firestore. The store writes what this builds
 * (see services/store/clubImport.ts), and every total, badge, milestone and streak is then
 * recomputed from the check-ins, never read from a file.
 *
 *  - A person WITH an email becomes a member (a profile), and their check-ins are written.
 *  - A person WITHOUT an email is a past alias: held as an unclaimed legacy name with their
 *    dated sign-ins until a real profile claims it. No profile is created for them.
 */
import type { CheckInRecord, MeetupEvent, RunEvent, UserProfile } from '../types';
import type { CheckinsPlan, ImportedCheckIn, ImportedRun, ProfilesPlan, RunsPlan } from './importFormat';
import { legacyIdFor, type LegacyEvent } from './legacy';

/** The club's usual place, when a run row does not say. */
export const DEFAULT_RUN_LOCATION = 'Blue Note Brewing Company';
const DEFAULT_RUN_MILES = 3.1;

export interface ImportedRunRecord {
  run: RunEvent;
  /** The public check-in event (no code word). */
  meetup: MeetupEvent;
  /** Saved as the run's secret + lookup key, only when it is unique for that day. */
  codeWord: string;
  /** True for a run made for a check-in date that the run history does not list. */
  placeholder: boolean;
}

export interface ImportedAlias {
  id: string;
  name: string;
  /** Runs with no check-in record. */
  oldCount: number;
  /** Dated sign-ins held until the alias is claimed. */
  events: LegacyEvent[];
}

/** A member from the files: the profile to create, and which of its fields the files actually gave. */
export interface ImportedMember {
  /** Used as-is when the member does not exist yet. Totals start at zero: they are recomputed afterwards. */
  profile: UserProfile;
  /** Only fields the files filled in are applied to a member who already exists. A name made from the email never overwrites a real one. */
  given: { name: boolean; shirtSize: boolean; birthday: boolean; noCheckInRuns: boolean };
}

export interface ImportCommit {
  runs: ImportedRunRecord[];
  checkins: CheckInRecord[];
  members: ImportedMember[];
  aliases: ImportedAlias[];
  stats: { runs: number; placeholderRuns: number; checkins: number; members: number; aliases: number; heldSignIns: number };
}

/** "18:30:00" -> "06:30 PM", the format the club's runs use. */
export function displayTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const hour = Number.isFinite(h) ? h : 18;
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(Number.isFinite(m) ? m : 30).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;
}

const miles2 = (n: number) => Math.round(n * 100) / 100;
const splitName = (name: string): { firstName: string; lastName: string } => {
  const [first, ...rest] = name.trim().split(/\s+/);
  return { firstName: first || name, lastName: rest.join(' ') };
};

function recordFor(run: ImportedRun, placeholder: boolean, creditedMiles: number[]): ImportedRunRecord {
  const time = displayTime(run.time);
  const miles = run.distance && run.distance > 0 ? run.distance : DEFAULT_RUN_MILES;
  const specialEvent = run.specialEventId || undefined;
  // A check-in's mileage is credited from the run's route options, so each distance that was
  // credited here gets an option (keyed by its miles). The rules check the credit against it.
  const keys = [...new Set(creditedMiles.map((m) => String(miles2(m))))];
  const routes: MeetupEvent['routes'] = Object.fromEntries(keys.map((key) => [key, { name: run.route || `${key} mi`, actualMiles: Number(key) }]));
  const runRecord: RunEvent = {
    id: run.runId, title: run.title, date: run.date, time,
    locationName: run.location || DEFAULT_RUN_LOCATION, address: run.address,
    distanceMiles: miles, surface: run.surface as RunEvent['surface'], elevationGainFt: 0,
    description: run.notes, paceGroups: [], attendees: [], organizerName: 'Imported history',
    completed: true, ...(specialEvent ? { specialEvent } : {}),
  };
  // No check-in window is stored. A run without one can never be checked into (the rules need the window),
  // yet an admin can still correct it by importing the file again. The app shows it as a past run by its date.
  const meetup: MeetupEvent = {
    id: run.runId, runId: run.runId, date: run.date, time, title: run.title, codeWord: '',
    ...(specialEvent ? { specialEvent } : {}),
    activeDistances: keys, routes, codeWordSet: true,
  };
  return { run: runRecord, meetup, codeWord: run.codeWord, placeholder };
}

export function buildImportCommit(profiles: ProfilesPlan | undefined, runs: RunsPlan | undefined, checkins: CheckinsPlan | undefined, now = new Date()): ImportCommit {
  const nowIso = now.toISOString();
  const planned = new Map<string, ImportedRun>((runs?.runs || []).map((r) => [r.runId, r]));
  const rows = checkins?.checkins || [];

  // Placeholder runs for check-ins whose date has no run in the history.
  for (const c of rows) {
    if (planned.has(c.runId)) continue;
    planned.set(c.runId, { runId: c.runId, date: c.date, time: '18:30:00', timeDefaulted: true, title: 'Group run', codeWord: '', specialEvent: '', location: '', address: '', route: '', surface: 'Pavement', notes: '' });
  }
  const credited = new Map<string, number[]>();
  for (const c of rows) if (c.person.email) credited.set(c.runId, [...(credited.get(c.runId) || []), c.miles ?? 0]);
  const known = new Set((runs?.runs || []).map((r) => r.runId));
  const records = [...planned.values()].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
    .map((r) => recordFor(r, !known.has(r.runId), credited.get(r.runId) || []));
  const byId = new Map(records.map((r) => [r.run.id, r]));

  // Members: every profile row with an email, plus anyone who appears with an email only in check-ins.
  const members = new Map<string, ImportedMember>();
  const addMember = (email: string, name: string, explicitName: boolean, extra: { shirtSize?: string; birthday?: string; noCheckInRuns?: number } = {}) => {
    const { firstName, lastName } = splitName(name);
    members.set(email, {
      profile: {
        email, firstName, lastName, displayName: name, shirtSize: extra.shirtSize || 'Not specified',
        ...(extra.birthday ? { birthday: extra.birthday } : {}),
        pre2021Runs: extra.noCheckInRuns || 0, importedRuns: extra.noCheckInRuns || 0, loggedRuns: 0, totalRuns: extra.noCheckInRuns || 0, totalMiles: 0,
        runCount: 0, walkCount: 0, linkedLegacyNames: [], unlockedBadgeIds: [], role: 'member', createdAt: nowIso,
      },
      given: { name: explicitName, shirtSize: Boolean(extra.shirtSize), birthday: Boolean(extra.birthday), noCheckInRuns: extra.noCheckInRuns !== undefined && extra.noCheckInRuns > 0 },
    });
  };
  for (const p of profiles?.members || []) addMember(p.email!, p.name, !p.nameFromEmail, p);
  for (const c of rows) if (c.person.email && !members.has(c.person.email)) addMember(c.person.email, c.person.name, !c.person.nameFromEmail);

  // Check-ins for members are real records; check-ins for aliases are held as legacy events.
  const checkinRecords: CheckInRecord[] = [];
  const heldEvents = new Map<string, LegacyEvent[]>();
  const held = (c: ImportedCheckIn) => {
    const record = byId.get(c.runId)!;
    heldEvents.set(c.personKey, [...(heldEvents.get(c.personKey) || []), { d: c.date, t: c.time, c: record.codeWord || record.run.title.toUpperCase(), ...(record.run.specialEvent ? { s: record.run.specialEvent } : {}) }]);
  };
  for (const c of rows) {
    if (!c.person.email) { held(c); continue; }
    const record = byId.get(c.runId)!;
    const created = new Date(`${c.date}T${c.time}Z`);
    const stamp = Number.isNaN(created.getTime()) ? nowIso : created.toISOString();
    const miles = miles2(c.miles ?? 0);
    checkinRecords.push({
      id: `${c.runId}_${c.person.email}`, runId: c.runId, date: c.date, time: c.time, userEmail: c.person.email,
      runnerName: members.get(c.person.email)?.profile.displayName || c.person.name, activity: c.activity,
      distanceChoice: String(miles), actualMiles: miles, routeName: c.route || record.run.title, loops: 1, withPet: c.withPet,
      source: 'legacy_import', createdAt: stamp, updatedAt: stamp,
      ...(record.codeWord ? { codeWord: record.codeWord } : {}),
      eventTitle: record.run.title, eventSpecial: record.run.specialEvent || 'none',
    });
  }

  // Aliases: every profile row without an email, plus anyone only seen in check-ins.
  const aliases = new Map<string, ImportedAlias>();
  for (const p of profiles?.aliases || []) aliases.set(p.key, { id: legacyIdFor(p.name), name: p.name, oldCount: p.noCheckInRuns, events: [] });
  for (const c of rows) if (!c.person.email && !aliases.has(c.personKey)) aliases.set(c.personKey, { id: legacyIdFor(c.person.name), name: c.person.name, oldCount: 0, events: [] });
  for (const [key, events] of heldEvents) aliases.get(key)!.events = events.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));

  const memberList = [...members.values()].sort((a, b) => a.profile.displayName.localeCompare(b.profile.displayName));
  const aliasList = [...aliases.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    runs: records, checkins: checkinRecords, members: memberList, aliases: aliasList,
    stats: {
      runs: records.length, placeholderRuns: records.filter((r) => r.placeholder).length, checkins: checkinRecords.length,
      members: memberList.length, aliases: aliasList.length, heldSignIns: [...heldEvents.values()].reduce((n, e) => n + e.length, 0),
    },
  };
}
