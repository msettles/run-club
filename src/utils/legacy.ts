import { formatMiles } from './miles';
/**
 * Legacy (old app) data: import, fuzzy name matching, streaks and badge recompute.
 *
 * Old app exports:
 *   - totals CSV:   Name, ..., OldCounts   -> pre-2021 run count per sign-in name
 *   - check-ins CSV: Name, Date, Time, ..., Code Name  -> one row per sign-in since 2021
 *
 * One event = one run. An event is identified by date + code word, so a double
 * sign-in to the same event counts once, while two events on one day count twice.
 */
import type { Badge, CheckInRecord, LegacyMember, MeetupEvent, UserProfile } from '../types';
import { clubYmd } from './dateUtils';

export interface LegacyEvent {
  legacyId?: string;
  d: string; // YYYY-MM-DD
  t: string; // HH:MM:SS
  c: string; // event code word (old events only; identifies the event)
  /** The special event this sign-in counts for (an id such as 'halloween'), set when it was imported from a tagged run. */
  s?: string;
}

export interface LegacyImport {
  profiles: Omit<LegacyMember, 'claimedBy' | 'claimedByEmail' | 'claimedAt'>[];
  histories: Record<string, LegacyEvent[]>;
  stats: {
    names: number;
    events: number;
    duplicatesDropped: number;
    oldRuns: number;
    namesOnlyInCheckins: number;
    namesWithoutEvents: number;
  };
}

/** A legacy name is taken once it has a server-side claim or a profile links it. */
export const isLegacyClaimed = (m: Pick<LegacyMember, 'claimedBy' | 'claimedByEmail'>): boolean =>
  Boolean(m.claimedBy || m.claimedByEmail);

// ---------- names ----------

export const normalizeName = (name: string): string =>
  name.toUpperCase().replace(/[^A-Z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();

export const legacyIdFor = (name: string): string =>
  normalizeName(name).toLowerCase().replace(/ /g, '-') || 'unnamed';

// ---------- CSV ----------

/** Minimal RFC 4180 CSV parser (quoted fields, escaped quotes, CRLF). */
export function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''));
  if (!header) return [];
  const keys = header.map((h) => h.trim());
  return body.map((r) => Object.fromEntries(keys.map((k, i) => [k, (r[i] ?? '').trim()])));
}

const toInt = (v: string | undefined): number => {
  const n = Math.round(Number(v || 0));
  return Number.isFinite(n) && n > 0 ? n : 0;
};

export const toIsoDate = (v: string): string | null => {
  const s = v.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/); // M/D/YYYY from spreadsheets
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${y}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  }
  return null;
};

/** Build legacy profiles + per-name event history from the two old-app CSV exports. */
export function buildLegacyImport(totalsCsv: string, checkinsCsv: string): LegacyImport {
  const totals = parseCsv(totalsCsv);
  const checkins = parseCsv(checkinsCsv);
  if (!totals.length || !('Name' in totals[0]) || !('OldCounts' in totals[0])) {
    throw new Error('Totals file must have Name and OldCounts columns.');
  }
  if (!checkins.length || !('Name' in checkins[0]) || !('Date' in checkins[0])) {
    throw new Error('Check-ins file must have Name and Date columns.');
  }

  const names = new Map<string, string>(); // id -> display name
  const oldCounts = new Map<string, number>();
  for (const r of totals) {
    const name = normalizeName(r.Name || '');
    if (!name) continue;
    const id = legacyIdFor(name);
    names.set(id, name);
    oldCounts.set(id, (oldCounts.get(id) || 0) + toInt(r.OldCounts));
  }

  const histories: Record<string, LegacyEvent[]> = {};
  const seen = new Set<string>();
  let events = 0;
  let duplicatesDropped = 0;
  let namesOnlyInCheckins = 0;
  for (const r of checkins) {
    const name = normalizeName(r.Name || '');
    const d = toIsoDate(r.Date || '');
    if (!name || !d) continue;
    const id = legacyIdFor(name);
    if (!names.has(id)) {
      names.set(id, name);
      namesOnlyInCheckins++;
    }
    const c = normalizeName(r['Code Name'] || '').replace(/ /g, '');
    const key = `${id}|${d}|${c}`;
    if (seen.has(key)) {
      duplicatesDropped++;
      continue;
    }
    seen.add(key);
    (histories[id] ||= []).push({ d, t: (r.Time || '').trim(), c });
    events++;
  }
  for (const list of Object.values(histories)) list.sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));

  const profiles = [...names.entries()]
    .map(([id, name]) => {
      const oldCount = oldCounts.get(id) || 0;
      const newCount = histories[id]?.length || 0;
      return { id, name, oldCount, newCount, totalRuns: oldCount + newCount };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  return {
    profiles,
    histories,
    stats: {
      names: profiles.length,
      events,
      duplicatesDropped,
      oldRuns: profiles.reduce((s, p) => s + p.oldCount, 0),
      namesOnlyInCheckins,
      namesWithoutEvents: profiles.filter((p) => p.newCount === 0).length,
    },
  };
}

// ---------- fuzzy matching ----------

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

const similarity = (a: string, b: string): number =>
  1 - levenshtein(a, b) / Math.max(a.length, b.length, 1);

/** Best match of one query word against the words of a legacy name (prefix and typo tolerant). */
function tokenScore(q: string, words: string[]): number {
  let best = 0;
  for (const w of words) {
    if (w === q) return 1;
    if (q.length >= 2 && w.startsWith(q)) best = Math.max(best, 0.9); // MATT -> MATTHEW
    if (w.length >= 2 && q.startsWith(w)) best = Math.max(best, w.length === 1 ? 0.5 : 0.85); // MATTHEW -> MATT
    best = Math.max(best, similarity(q, w)); // SETTLED -> SETTLES
  }
  return best;
}

/**
 * Score how well a legacy name matches what the runner typed (0..1).
 * Every query word must find a reasonable partner; the full-string similarity
 * also counts so "MATTSETTLES" still finds "MATT SETTLES".
 */
export function fuzzyNameScore(query: string, legacyName: string): number {
  const q = normalizeName(query);
  const n = normalizeName(legacyName);
  if (!q || !n) return 0;
  if (n.includes(q)) return 1;
  const qWords = q.split(' ');
  const nWords = n.split(' ');
  const perWord = qWords.map((w) => tokenScore(w, nWords));
  const wordAvg = perWord.reduce((s, x) => s + x, 0) / perWord.length;
  const weakest = Math.min(...perWord);
  const whole = similarity(q.replace(/ /g, ''), n.replace(/ /g, ''));
  return Math.max(weakest < 0.6 ? wordAvg * 0.6 : wordAvg, whole);
}

export function matchLegacyNames<T extends { name: string }>(query: string, pool: T[], minScore = 0.72): (T & { score: number })[] {
  if (normalizeName(query).length < 2) return [];
  return pool
    .map((p) => ({ ...p, score: fuzzyNameScore(query, p.name) }))
    .filter((p) => p.score >= minScore)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

// ---------- streaks ----------

/** Monday of the ISO week containing the date, as YYYY-MM-DD. */
export function weekStart(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const day = (dt.getUTCDay() + 6) % 7; // Mon=0
  dt.setUTCDate(dt.getUTCDate() - day);
  return dt.toISOString().slice(0, 10);
}

const addWeeks = (week: string, n: number): string => {
  const [y, m, d] = week.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + 7 * n)).toISOString().slice(0, 10);
};

/**
 * Weekly streaks: consecutive calendar weeks with at least one event.
 * `current` is still alive if the last attended week is this week or last week.
 */
export function computeStreaks(dates: string[], today = clubYmd()): { current: number; longest: number } {
  const weeks = [...new Set(dates.filter(Boolean).map(weekStart))].sort();
  if (!weeks.length) return { current: 0, longest: 0 };
  let longest = 1;
  let run = 1;
  for (let i = 1; i < weeks.length; i++) {
    run = weeks[i] === addWeeks(weeks[i - 1], 1) ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const last = weeks[weeks.length - 1];
  const thisWeek = weekStart(today);
  const alive = last === thisWeek || last === addWeeks(thisWeek, -1);
  return { current: alive ? run : 0, longest };
}

/** Lengths of every unbroken run of consecutive weeks with an event (each separate streak), oldest first. */
export function streakRunLengths(dates: string[]): number[] {
  const weeks = [...new Set(dates.filter(Boolean).map(weekStart))].sort();
  const runs: number[] = [];
  let run = 0;
  for (let i = 0; i < weeks.length; i++) {
    run = i > 0 && weeks[i] === addWeeks(weeks[i - 1], 1) ? run + 1 : 1;
    if (i === weeks.length - 1 || weeks[i + 1] !== addWeeks(weeks[i], 1)) runs.push(run);
  }
  return runs;
}

/** How many times a streak badge has been earned: every full block of `step` weeks in every streak (20 in a row is 2). */
export const streakBlocks = (runs: number[], step: number): number => runs.reduce((sum, length) => sum + Math.floor(length / Math.max(1, step)), 0);

/**
 * A stored weekly streak as of today. Streaks are saved at check-in time, so a
 * runner who stopped coming would otherwise keep showing it: once the last
 * check-in is older than last week, the streak is over.
 */
export function liveStreak(streak: number, lastCheckInDate: string | undefined, today = clubYmd(), attendanceWeek?: number): number {
  if (attendanceWeek !== undefined && attendanceWeek > 0) {
    const currentWeek = Math.floor((Date.parse(`${today}T00:00:00Z`) + 259200000) / 604800000);
    return attendanceWeek >= currentWeek - 1 && attendanceWeek <= currentWeek ? streak : 0;
  }
  if (!lastCheckInDate || !streak) return streak || 0;
  return weekStart(lastCheckInDate) >= addWeeks(weekStart(today), -1) ? streak : 0;
}

// ---------- special events ----------

/**
 * The special event an app check-in counts toward: only the one picked on the run ("Is Special Event?").
 * No guessing from the run title or code word.
 */
export function specialEventIdsFor(specialEvent?: string): string[] {
  return specialEvent && specialEvent !== 'none' ? [specialEvent] : [];
}

/**
 * Old-app sign-ins carry only a code word (no run to tag), so they are still matched by keyword.
 * Same keywords as before; revisit when deciding how old sign-ins should count.
 */
export function legacySpecialEventIds(codeWord: string, tag?: string): string[] {
  const cw = (codeWord || '').toUpperCase();
  // A tag from an imported run counts directly; the code-word keywords still count for untagged old sign-ins.
  const ids: string[] = tag && tag !== 'none' ? [tag] : [];
  if (cw.includes('TURKEY')) ids.push('turkey_trot');
  if (cw.includes('HALLOWEEN') || cw.includes('SPOOKY')) ids.push('halloween');
  if (cw.includes('ANNIVERSARY')) ids.push('anniversary');
  return [...new Set(ids)];
}

// ---------- badge recompute ----------

export interface DatedEvent {
  date: string;
  specialEventIds: string[];
}

export function datedEventsFrom(
  legacyEvents: LegacyEvent[],
  appCheckins: CheckInRecord[],
  meetupEvents: Pick<MeetupEvent, 'id' | 'date' | 'title' | 'specialEvent'>[]
): DatedEvent[] {
  // A check-in belongs to its run (several runs can share a date); very old
  // check-ins without a runId fall back to that day's event.
  const byId = new Map(meetupEvents.map((e) => [e.id, e]));
  const byDate = new Map(meetupEvents.map((e) => [e.date, e]));
  return [
    ...legacyEvents.map((e) => ({ date: e.d, specialEventIds: legacySpecialEventIds(e.c, e.s) })),
    ...appCheckins.map((c) => {
      const ev = c.runId ? byId.get(c.runId) : byDate.get(c.date);
      return { date: c.date, specialEventIds: specialEventIdsFor(c.eventSpecial ?? ev?.specialEvent) };
    }),
  ];
}

/** Last actual check-in after a deletion, so a removed run cannot keep a streak alive. */
export function lastCheckInFields(checkins: CheckInRecord[]): Pick<UserProfile, 'lastCheckInDate' | 'lastCheckInRunId'> {
  const latest = [...checkins].sort((a, b) => b.date.localeCompare(a.date) || b.time.localeCompare(a.time))[0];
  return { lastCheckInDate: latest?.date, lastCheckInRunId: latest?.runId };
}

/**
 * The distanceCounts keys one check-in of `miles` counts toward: the old 1/3/5
 * bucket plus the rounded distance, in both "3.1" and "3.1 mi" forms (badges may
 * be configured with either).
 */
export function distanceCountKeys(miles: number): string[] {
  const rounded = formatMiles(miles);
  return [miles <= 2.0 ? '1' : miles <= 4.0 ? '3' : '5', rounded, `${rounded} mi`];
}

/** distanceCounts with one check-in of `miles` added (+1) or removed (-1, never below 0). */
export function adjustDistanceCounts(counts: Record<string, number> | undefined, miles: number, delta: 1 | -1): Record<string, number> {
  const next = { ...(counts || {}) };
  for (const key of distanceCountKeys(miles)) {
    if (delta > 0) next[key] = (next[key] || 0) + 1;
    else if (next[key]) next[key] = Math.max(0, next[key] - 1);
  }
  return next;
}

/**
 * Recompute badges and streaks from a profile's totals plus every dated event
 * (claimed legacy sign-ins and new-app check-ins). Pre-2021 runs count toward
 * totals and milestones but have no dates, so they don't feed streaks.
 */
export function recomputeBadges(
  user: UserProfile,
  badges: Badge[],
  events: DatedEvent[],
  today?: string
): Pick<UserProfile, 'unlockedBadgeIds' | 'badgeCounts' | 'currentStreakWeeks' | 'longestStreakWeeks'> {
  const total = user.totalRuns;
  const walks = user.walkCount || 0;
  const runs = user.runCount || 0;
  const pets = user.petRunCount || 0;
  const dist = user.distanceCounts || {};
  const { current, longest } = computeStreaks(events.map((e) => e.date), today);
  const runsOfWeeks = streakRunLengths(events.map((e) => e.date));
  const specialCounts: Record<string, number> = {};
  for (const e of events) for (const id of e.specialEventIds) specialCounts[id] = (specialCounts[id] || 0) + 1;

  // Badges this recompute doesn't own (no trigger rule, or no longer defined) are kept as-is.
  const computable = new Set(badges.filter((b) => b.triggerConfig).map((b) => b.id));
  const counts: Record<string, number> = {};
  for (const id of user.unlockedBadgeIds || []) {
    if (!computable.has(id)) counts[id] = user.badgeCounts?.[id] || 1;
  }
  const award = (id: string, n: number) => {
    if (n >= 1) counts[id] = n;
  };
  const steps = (count: number, threshold: number, incremental?: boolean, step?: number) =>
    count >= threshold ? (incremental ? Math.max(1, Math.floor(count / (step || threshold))) : 1) : 0;

  for (const b of badges) {
    const cfg = b.triggerConfig;
    if (!cfg) continue;
    switch (cfg.type) {
      case 'attendance':
        award(b.id, total >= 1 ? 1 : 0);
        break;
      case 'milestone':
        award(b.id, steps(total, cfg.minTotalRuns || 1, cfg.isIncremental, cfg.step));
        break;
      case 'activity': {
        const c = cfg.activityType === 'walking' ? walks : runs;
        award(b.id, steps(c, cfg.activityCount || 10, cfg.isIncremental, cfg.step));
        break;
      }
      case 'distance': {
        const key = (cfg.distanceChoice || cfg.distanceTier || '3.1').toString();
        award(b.id, steps(dist[key] || 0, cfg.distanceCount || 1, cfg.isIncremental, cfg.step));
        break;
      }
      case 'pet':
        award(b.id, pets);
        break;
      case 'incremental': {
        // First earned at `step`, then a level every `step` more.
        const count = cfg.counter === 'pet' ? pets : cfg.counter === 'runs' ? runs : cfg.counter === 'miles' ? user.totalMiles || 0 : walks;
        const step = Math.max(1, cfg.step || 1);
        award(b.id, steps(count, step, true, step));
        break;
      }
      case 'streak': {
        const weeks = cfg.streakWeeks || 4;
        // Incremental streak badges earn a level for every full block of `weeks` in any streak (20 in a row = 2;
        // a later 10-week streak adds another). Others are earned once, by reaching `weeks` at all.
        award(b.id, cfg.isIncremental ? streakBlocks(runsOfWeeks, weeks) : (longest >= weeks ? 1 : 0));
        break;
      }
      case 'special_event': {
        const seId = cfg.specialEventId || b.id.replace(/^special-/, '');
        award(b.id, specialCounts[seId] || 0);
        break;
      }
    }
  }

  // Keep the badge order stable: existing ones first, new ones appended.
  const ids = Object.keys(counts);
  const ordered = [...(user.unlockedBadgeIds || []).filter((id) => ids.includes(id)), ...ids.filter((id) => !(user.unlockedBadgeIds || []).includes(id))];
  return { unlockedBadgeIds: ordered, badgeCounts: counts, currentStreakWeeks: current, longestStreakWeeks: longest };
}
