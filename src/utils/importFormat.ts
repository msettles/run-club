/**
 * The attendance import formats: three CSV files that describe a club's history, whether it comes from this app's
 * own exports or from an older system.
 *
 *   1. Profiles     one row per person: who they are, and how many runs they did that have no check-in record.
 *   2. Run history  one row per run: the date, its code word, its title, and so on.
 *   3. Check-ins    one row per person per run: who was at which run, and what they did there.
 *
 * Totals are NEVER imported. Runs, miles, walks, first-run date, streaks, badges and milestones are all recomputed
 * from the check-ins (plus the "No Check-In Runs" count). Anything not in a file is left empty; the few things the
 * app needs get a sensible default. Columns a file doesn't know are ignored, so this app's own exports and the
 * old-app files can be used as they are.
 *
 * People WITH an email become members of the club. People WITHOUT one are "past aliases" a runner can claim later.
 */
import { parseCsv, normalizeName, toIsoDate } from './legacy';

export type ImportFileKind = 'profiles' | 'runs' | 'checkins';

export interface ImportColumn {
  /** The header to use in the file. */
  header: string;
  /** Other headers that mean the same thing. */
  aliases: string[];
  required: 'one-of' | 'always' | 'no';
  meaning: string;
  /** What is used when the cell is blank. */
  whenBlank: string;
}

const PERSON = {
  email: { header: 'Email', aliases: ['User Email', 'E-mail'], required: 'one-of', meaning: 'The runner’s email. With an email they are a member of the club; without one the row is a past alias a runner can claim.', whenBlank: 'The row is a past alias (needs a Name).' },
  name: { header: 'Name', aliases: ['Display Name', 'Runner Name', 'Full Name'], required: 'one-of', meaning: 'The runner’s name as it should appear.', whenBlank: 'Made from the email (the part before the @, tidied). It can be edited later.' },
} satisfies Record<string, ImportColumn>;

export const PROFILE_COLUMNS = {
  ...PERSON,
  shirtSize: { header: 'Shirt Size', aliases: ['Shirt', 'Size'], required: 'no', meaning: 'XS, S, M, L, XL, 2XL or Youth. Words such as Small are understood.', whenBlank: 'Not specified.' },
  birthday: { header: 'Birthday', aliases: ['Birthdate', 'Date of Birth'], required: 'no', meaning: 'Birthday as 1983-09-25 or 9/25/1983.', whenBlank: 'Left empty.' },
  noCheckInRuns: { header: 'No Check-In Runs', aliases: ['OldCounts', 'Old Counts', 'Pre-2021 Runs'], required: 'no', meaning: 'How many runs this person did that have no check-in record. They only add to the run total.', whenBlank: '0.' },
} satisfies Record<string, ImportColumn>;

export const RUN_COLUMNS = {
  date: { header: 'Date', aliases: ['Run Date'], required: 'always', meaning: 'The day of the run, as 2026-10-07 or 10/7/2026.', whenBlank: 'The row is skipped.' },
  time: { header: 'Time', aliases: ['Start Time'], required: 'no', meaning: 'When the run started, such as 18:30.', whenBlank: '18:30.' },
  title: { header: 'Title', aliases: ['Run Title', 'Event', 'Event Title'], required: 'no', meaning: 'The run’s name.', whenBlank: '"Group run".' },
  codeWord: { header: 'Code Word', aliases: ['Code Name', 'CodeWord', 'Code'], required: 'no', meaning: 'The code word used at that run. It identifies the run, and tells two runs on the same day apart.', whenBlank: 'Left empty.' },
  specialEvent: { header: 'Special Event', aliases: ['Special'], required: 'no', meaning: 'The special event this run was, such as Turkey Trot (one of your special events, by name or id). Check-ins at the run count toward it, so the tag lives here and not in the check-ins file.', whenBlank: 'Not a special event.' },
  location: { header: 'Location', aliases: ['Venue'], required: 'no', meaning: 'Where it met.', whenBlank: 'The club’s usual location.' },
  address: { header: 'Address', aliases: [], required: 'no', meaning: 'The street address.', whenBlank: 'Left empty.' },
  route: { header: 'Route', aliases: ['Route Name'], required: 'no', meaning: 'The route (its name).', whenBlank: 'Left empty.' },
  distance: { header: 'Distance', aliases: ['Miles'], required: 'no', meaning: 'The run’s distance in miles.', whenBlank: 'Unknown.' },
  surface: { header: 'Surface', aliases: [], required: 'no', meaning: 'Pavement, Trail or Mixed.', whenBlank: 'Pavement.' },
  notes: { header: 'Notes', aliases: ['Description'], required: 'no', meaning: 'Anything to remember about the run.', whenBlank: 'Left empty.' },
  runId: { header: 'Run ID', aliases: ['ID'], required: 'no', meaning: 'Only when restoring this app’s own export: the run’s id, so check-ins reattach exactly.', whenBlank: 'Made from the date (and code word when two runs share a date).' },
} satisfies Record<string, ImportColumn>;

export const CHECKIN_COLUMNS = {
  ...PERSON,
  date: { header: 'Date', aliases: ['Check-In Date', 'Run Date'], required: 'always', meaning: 'The day of the run they were at. It finds the run (a run is made for a date that has none).', whenBlank: 'The row is skipped.' },
  runId: { header: 'Run ID', aliases: [], required: 'no', meaning: 'The run, when it is known (this app’s own export). Beats the Date.', whenBlank: 'The run on that Date.' },
  codeWord: { header: 'Code Word', aliases: ['Code Name', 'CodeWord', 'Code'], required: 'no', meaning: 'Only needed to pick the right run when two runs share a date.', whenBlank: 'Not used.' },
  time: { header: 'Time', aliases: ['Check-In Time'], required: 'no', meaning: 'When they signed in, such as 18:35:00.', whenBlank: '18:30:00.' },
  activity: { header: 'Activity', aliases: [], required: 'no', meaning: 'running or walking.', whenBlank: 'running.' },
  withPet: { header: 'With Pet', aliases: ['Pet'], required: 'no', meaning: 'Yes or No.', whenBlank: 'No.' },
  loops: { header: 'Loops', aliases: [], required: 'no', meaning: 'Laps of a loop route.', whenBlank: '1.' },
  route: { header: 'Route', aliases: ['Route Name'], required: 'no', meaning: 'The route they ran or walked.', whenBlank: 'Left empty.' },
  miles: { header: 'Miles', aliases: ['Actual GPS Miles', 'Distance'], required: 'no', meaning: 'Miles they covered at that run. Mileage totals are added up from these.', whenBlank: 'Unknown (adds nothing to mileage).' },
} satisfies Record<string, ImportColumn>;

export const IMPORT_FILES: Record<ImportFileKind, { title: string; summary: string; columns: Record<string, ImportColumn> }> = {
  profiles: { title: 'Profiles', summary: 'One row per person.', columns: PROFILE_COLUMNS },
  runs: { title: 'Run history', summary: 'One row per run.', columns: RUN_COLUMNS },
  checkins: { title: 'Check-ins', summary: 'One row per person per run.', columns: CHECKIN_COLUMNS },
};

export const SHIRT_SIZES = ['Youth', 'XS', 'S', 'M', 'L', 'XL', '2XL'];

export interface ImportIssue { row: number; level: 'error' | 'warning'; message: string }

// ---- shared helpers ----

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '');
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const titleCase = (s: string) => s.replace(/\b[a-z]/g, (m) => m.toUpperCase());

/** A readable default name from an email: "jane.doe+runs@x.com" becomes "Jane Doe Runs". The domain is never used (names are public). */
export function defaultNameFromEmail(email: string): string {
  const local = email.split('@')[0].replace(/[._+-]+/g, ' ').trim();
  return titleCase(local.toLowerCase()) || 'Runner';
}

/** Words and spreadsheet quirks to the app's shirt sizes (Small -> S, Xl -> XL). Anything unrecognised is kept as typed. */
export function normalizeShirtSize(value: string): string | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const k = v.toLowerCase().replace(/[^a-z0-9]/g, '');
  const map: Record<string, string> = {
    youth: 'Youth', ys: 'Youth', ym: 'Youth', yl: 'Youth', kids: 'Youth', child: 'Youth',
    xs: 'XS', extrasmall: 'XS', xsmall: 'XS', xxs: 'XS', xxsmall: 'XS', '2xs': 'XS', s: 'S', small: 'S', sm: 'S', m: 'M', medium: 'M', med: 'M', l: 'L', large: 'L', lg: 'L',
    xl: 'XL', xlarge: 'XL', extralarge: 'XL', '2xl': '2XL', xxl: '2XL', '2x': '2XL', xx: '2XL', xxlarge: '2XL',
  };
  return map[k] || v;
}

function validDay(iso: string): boolean {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

/** M/D/YYYY, M/D/YY (a year that would be in the future means 19xx) or YYYY-MM-DD, as YYYY-MM-DD. */
export function parseBirthday(value: string, now = new Date()): string | undefined {
  const s = value.trim();
  if (!s) return undefined;
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (slash && slash[3].length === 2) {
    const yy = Number(slash[3]);
    const century = yy > now.getUTCFullYear() % 100 ? 1900 : 2000;
    const iso = toIsoDate(`${slash[1]}/${slash[2]}/${century + yy}`);
    return iso && validDay(iso) ? iso : undefined;
  }
  const iso = toIsoDate(s);
  return iso && validDay(iso) ? iso : undefined;
}

/** 18:35, 6:35:09 or 18:35:09 as HH:MM:SS; undefined if it isn't a time. */
export function normalizeTime(value: string): string | undefined {
  const m = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!m || Number(m[1]) > 23 || Number(m[2]) > 59 || Number(m[3] ?? 0) > 59) return undefined;
  return `${m[1].padStart(2, '0')}:${m[2]}:${m[3] ?? '00'}`;
}

const yes = (v: string) => /^(y|yes|true|1|x)$/i.test(v.trim());
const codeKey = (v: string) => normalizeName(v).replace(/ /g, '');

interface Table {
  rows: { row: number; cell: (key: string) => string }[];
  ignoredColumns: string[];
  mapped: Set<string>;
  error?: string;
}

/** Read a CSV and map its headers (by name or alias) to a file kind's columns. Unknown headers are ignored. */
function readTable(csvText: string, columns: Record<string, ImportColumn>): Table {
  const records = parseCsv(csvText);
  if (!records.length) return { rows: [], ignoredColumns: [], mapped: new Set(), error: 'The file has no rows.' };
  const byHeader = new Map<string, string>();
  for (const [key, c] of Object.entries(columns)) for (const h of [c.header, ...c.aliases]) byHeader.set(headerKey(h), key);
  const mapping = new Map<string, string>();
  const ignoredColumns: string[] = [];
  for (const h of Object.keys(records[0])) {
    const key = byHeader.get(headerKey(h));
    if (key && ![...mapping.values()].includes(key)) mapping.set(h, key);
    else ignoredColumns.push(h);
  }
  const rows = records.map((record, index) => ({
    row: index + 2, // the header is row 1
    cell: (key: string) => {
      for (const [h, k] of mapping) if (k === key) return (record[h] ?? '').trim();
      return '';
    },
  }));
  return { rows, ignoredColumns, mapped: new Set(mapping.values()) };
}

// ---- 1. Profiles ----

export interface ImportedProfile {
  /** email (lowercase) when there is one, otherwise "name:" + the tidied name. */
  key: string;
  email?: string;
  name: string;
  nameFromEmail: boolean;
  shirtSize?: string;
  birthday?: string;
  noCheckInRuns: number;
}

export interface ProfilesPlan {
  members: ImportedProfile[];
  aliases: ImportedProfile[];
  issues: ImportIssue[];
  ignoredColumns: string[];
  stats: { rows: number; skippedRows: number; namesFromEmail: number; noCheckInRuns: number };
}

export function planProfilesImport(csvText: string, now = new Date()): ProfilesPlan {
  const plan: ProfilesPlan = { members: [], aliases: [], issues: [], ignoredColumns: [], stats: { rows: 0, skippedRows: 0, namesFromEmail: 0, noCheckInRuns: 0 } };
  const table = readTable(csvText, PROFILE_COLUMNS);
  if (table.error) { plan.issues.push({ row: 0, level: 'error', message: table.error }); return plan; }
  plan.ignoredColumns = table.ignoredColumns;
  if (!table.mapped.has('email') && !table.mapped.has('name')) {
    plan.issues.push({ row: 0, level: 'error', message: 'A profiles file needs an Email column or a Name column.' });
    return plan;
  }
  const people = new Map<string, ImportedProfile>();
  for (const { row, cell } of table.rows) {
    plan.stats.rows++;
    const email = cell('email').toLowerCase();
    const rawName = cell('name');
    if (email && !EMAIL.test(email)) { plan.issues.push({ row, level: 'error', message: `"${cell('email')}" is not a valid email.` }); plan.stats.skippedRows++; continue; }
    if (!email && !normalizeName(rawName)) { plan.issues.push({ row, level: 'error', message: 'The row needs an Email or a Name.' }); plan.stats.skippedRows++; continue; }
    const key = email || `name:${normalizeName(rawName)}`;
    let person = people.get(key);
    if (!person) {
      person = { key, email: email || undefined, name: rawName || defaultNameFromEmail(email), nameFromEmail: !rawName && Boolean(email), noCheckInRuns: 0 };
      people.set(key, person);
    } else {
      plan.issues.push({ row, level: 'warning', message: `${email || rawName} appears more than once. Their rows were combined.` });
      if (rawName && person.nameFromEmail) { person.name = rawName; person.nameFromEmail = false; }
    }
    const size = normalizeShirtSize(cell('shirtSize'));
    if (size && !person.shirtSize) person.shirtSize = size;
    const birthdayText = cell('birthday');
    if (birthdayText && !person.birthday) {
      const b = parseBirthday(birthdayText, now);
      if (b) person.birthday = b; else plan.issues.push({ row, level: 'warning', message: `Birthday "${birthdayText}" was not understood and was left empty.` });
    }
    const countText = cell('noCheckInRuns');
    if (countText !== '') {
      const n = Math.round(Number(countText));
      if (Number.isFinite(n) && n >= 0) { person.noCheckInRuns += n; plan.stats.noCheckInRuns += n; }
      else plan.issues.push({ row, level: 'warning', message: `"${countText}" is not a number of runs and was ignored.` });
    }
  }
  for (const p of people.values()) {
    if (p.nameFromEmail) plan.stats.namesFromEmail++;
    (p.email ? plan.members : plan.aliases).push(p);
  }
  const byName = (a: ImportedProfile, b: ImportedProfile) => a.name.localeCompare(b.name);
  plan.members.sort(byName);
  plan.aliases.sort(byName);
  return plan;
}

// ---- 2. Run history ----

export interface ImportedRun {
  runId: string;
  date: string;
  time: string;
  timeDefaulted: boolean;
  title: string;
  codeWord: string;
  /** What the file said, e.g. "Halloween". */
  specialEvent: string;
  /** The club's special event it matched (by id or name), when the club's events were supplied and one matched. */
  specialEventId?: string;
  location: string;
  address: string;
  route: string;
  distance?: number;
  surface: string;
  notes: string;
}

export interface RunsPlan {
  runs: ImportedRun[];
  issues: ImportIssue[];
  ignoredColumns: string[];
  /** How many runs are tagged with each special event (by the club's event name, or the file's own wording when unmatched). */
  specialEvents: Record<string, number>;
  stats: { rows: number; skippedRows: number; duplicateRuns: number; timesDefaulted: number; earliest?: string; latest?: string };
}

/** Match a Special Event cell to one of the club's special events: by id, by name, or by one name containing the other. */
export function matchSpecialEvent(value: string, known: { id: string; name: string }[]): { id: string; name: string } | undefined {
  const v = headerKey(value);
  if (!v) return undefined;
  const exact = known.find((e) => headerKey(e.id) === v || headerKey(e.name) === v);
  if (exact) return exact;
  const loose = known.filter((e) => headerKey(e.name).includes(v) || v.includes(headerKey(e.name)));
  return loose.length === 1 ? loose[0] : undefined;
}

export function planRunsImport(csvText: string, now = new Date(), knownSpecialEvents?: { id: string; name: string }[]): RunsPlan {
  const plan: RunsPlan = { runs: [], issues: [], ignoredColumns: [], specialEvents: {}, stats: { rows: 0, skippedRows: 0, duplicateRuns: 0, timesDefaulted: 0 } };
  const table = readTable(csvText, RUN_COLUMNS);
  if (table.error) { plan.issues.push({ row: 0, level: 'error', message: table.error }); return plan; }
  plan.ignoredColumns = table.ignoredColumns;
  if (!table.mapped.has('date')) { plan.issues.push({ row: 0, level: 'error', message: 'A run history file needs a Date column.' }); return plan; }
  const today = now.toISOString().slice(0, 10);
  const seen = new Set<string>();
  const ids = new Set<string>();
  for (const { row, cell } of table.rows) {
    plan.stats.rows++;
    const dateText = cell('date');
    const date = dateText ? toIsoDate(dateText) : null;
    if (!date || !validDay(date)) {
      plan.issues.push({ row, level: 'error', message: dateText ? `"${dateText}" is not a date I understand (use 2026-10-07 or 10/7/2026).` : 'The row needs a Date.' });
      plan.stats.skippedRows++;
      continue;
    }
    if (date < '2018-05-01') plan.issues.push({ row, level: 'warning', message: `${date} is before the club was established (May 2018).` });
    if (date > today) plan.issues.push({ row, level: 'warning', message: `${date} is in the future.` });
    const codeWord = codeKey(cell('codeWord'));
    const dup = `${date}|${codeWord}`;
    if (seen.has(dup)) { plan.stats.duplicateRuns++; plan.issues.push({ row, level: 'warning', message: `A run on ${date}${codeWord ? ` with code word ${codeWord}` : ''} is already listed. This row was dropped.` }); continue; }
    seen.add(dup);
    // An id: the one given, otherwise made from the date (and the code word when two runs share a day).
    // The first run on a date is run-<date>, so correcting its code word or title in a later file updates the same run.
    // A second run on the same date adds its code word (or a number).
    let runId = cell('runId') || (ids.has(`run-${date}`) && codeWord ? `run-${date}-${codeWord.toLowerCase()}` : `run-${date}`);
    for (let n = 2; ids.has(runId); n++) runId = `${cell('runId') || `run-${date}`}-${n}`;
    ids.add(runId);
    const timeText = cell('time');
    const time = normalizeTime(timeText);
    if (!time) plan.stats.timesDefaulted++;
    const distanceText = cell('distance');
    const distance = distanceText === '' ? undefined : Number(distanceText);
    if (distance !== undefined && (!Number.isFinite(distance) || distance < 0)) plan.issues.push({ row, level: 'warning', message: `Distance "${distanceText}" was not understood and was left empty.` });
    const surface = /^(trail)/i.test(cell('surface')) ? 'Trail' : /^(mixed)/i.test(cell('surface')) ? 'Mixed' : 'Pavement';
    const specialText = cell('specialEvent');
    const matched = specialText && knownSpecialEvents ? matchSpecialEvent(specialText, knownSpecialEvents) : undefined;
    if (specialText && knownSpecialEvents && !matched) {
      plan.issues.push({ row, level: 'warning', message: 'Special Event "' + specialText + '" is not one of your special events (' + (knownSpecialEvents.map((e) => e.name).join(', ') || 'none yet') + '). That run would have no special event. Add it under Admin > Badges first, or fix the name.' });
    }
    if (specialText) { const label = matched?.name || specialText; plan.specialEvents[label] = (plan.specialEvents[label] || 0) + 1; }
    plan.runs.push({
      runId, date, time: time ?? '18:30:00', timeDefaulted: !time, title: cell('title') || 'Group run', codeWord,
      specialEvent: specialText, specialEventId: matched?.id, location: cell('location'), address: cell('address'), route: cell('route'),
      distance: distance !== undefined && Number.isFinite(distance) && distance >= 0 ? distance : undefined, surface, notes: cell('notes'),
    });
    if (!plan.stats.earliest || date < plan.stats.earliest) plan.stats.earliest = date;
    if (!plan.stats.latest || date > plan.stats.latest) plan.stats.latest = date;
  }
  plan.runs.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return plan;
}

// ---- 3. Check-ins ----

export interface ImportedCheckIn {
  /** Who: an email (a member) or a tidied name (a past alias); the same person always has the same key. */
  personKey: string;
  person: { email?: string; name: string; nameFromEmail: boolean };
  date: string;
  runId: string;
  codeWord: string;
  time: string;
  timeDefaulted: boolean;
  activity: 'running' | 'walking';
  withPet: boolean;
  loops: number;
  route: string;
  miles?: number;
}

export interface CheckinsPlan {
  checkins: ImportedCheckIn[];
  /** Distinct people with an email (members) and without (past aliases). */
  members: number;
  aliases: number;
  /** Dates with no run in the run history (given the runs the caller knows about): a placeholder run would be made. */
  datesWithoutRun: string[];
  issues: ImportIssue[];
  ignoredColumns: string[];
  stats: { rows: number; skippedRows: number; duplicateCheckIns: number; namesFromEmail: number; timesDefaulted: number; miles: number; earliest?: string; latest?: string };
}

/**
 * Plan a check-ins file. `knownRuns` is the run history (from the run history file, or what the club already has):
 * a check-in is matched to its run by Run ID, else by Date (the code word picks between two runs on one date).
 */
export function planCheckinsImport(csvText: string, knownRuns: Pick<ImportedRun, 'runId' | 'date' | 'codeWord'>[] = [], now = new Date()): CheckinsPlan {
  const plan: CheckinsPlan = { checkins: [], members: 0, aliases: 0, datesWithoutRun: [], issues: [], ignoredColumns: [], stats: { rows: 0, skippedRows: 0, duplicateCheckIns: 0, namesFromEmail: 0, timesDefaulted: 0, miles: 0 } };
  const table = readTable(csvText, CHECKIN_COLUMNS);
  if (table.error) { plan.issues.push({ row: 0, level: 'error', message: table.error }); return plan; }
  plan.ignoredColumns = table.ignoredColumns;
  if (!table.mapped.has('email') && !table.mapped.has('name')) { plan.issues.push({ row: 0, level: 'error', message: 'A check-ins file needs an Email column or a Name column.' }); return plan; }
  if (!table.mapped.has('date') && !table.mapped.has('runId')) { plan.issues.push({ row: 0, level: 'error', message: 'A check-ins file needs a Date column (or Run ID).' }); return plan; }

  const today = now.toISOString().slice(0, 10);
  const runsById = new Map(knownRuns.map((r) => [r.runId, r]));
  const runsByDate = new Map<string, typeof knownRuns>();
  for (const r of knownRuns) runsByDate.set(r.date, [...(runsByDate.get(r.date) || []), r]);
  const seen = new Set<string>();
  const people = new Map<string, boolean>(); // key -> has email
  const noRun = new Set<string>();
  const names = new Map<string, { name: string; fromEmail: boolean }>();

  for (const { row, cell } of table.rows) {
    plan.stats.rows++;
    const email = cell('email').toLowerCase();
    const rawName = cell('name');
    if (email && !EMAIL.test(email)) { plan.issues.push({ row, level: 'error', message: `"${cell('email')}" is not a valid email.` }); plan.stats.skippedRows++; continue; }
    if (!email && !normalizeName(rawName)) { plan.issues.push({ row, level: 'error', message: 'The row needs an Email or a Name.' }); plan.stats.skippedRows++; continue; }
    const givenRunId = cell('runId');
    const dateText = cell('date');
    let date = dateText ? toIsoDate(dateText) : null;
    if (dateText && (!date || !validDay(date))) { plan.issues.push({ row, level: 'error', message: `"${dateText}" is not a date I understand (use 2026-10-07 or 10/7/2026).` }); plan.stats.skippedRows++; continue; }
    const byId = givenRunId ? runsById.get(givenRunId) : undefined;
    if (givenRunId && !byId && knownRuns.length) plan.issues.push({ row, level: 'warning', message: `Run ID "${givenRunId}" isn't in the run history; matching by date instead.` });
    if (!date && byId) date = byId.date;
    if (!date) { plan.issues.push({ row, level: 'error', message: 'The row needs a Date (or a Run ID that is in the run history).' }); plan.stats.skippedRows++; continue; }
    if (date < '2018-05-01') plan.issues.push({ row, level: 'warning', message: `${date} is before the club was established (May 2018).` });
    if (date > today) plan.issues.push({ row, level: 'warning', message: `${date} is in the future.` });

    const codeWord = codeKey(cell('codeWord'));
    let run = byId;
    if (!run) {
      const sameDay = runsByDate.get(date) || [];
      run = sameDay.length > 1 ? sameDay.find((r) => codeWord && r.codeWord === codeWord) : sameDay[0];
      if (sameDay.length > 1 && !run) plan.issues.push({ row, level: 'warning', message: `Several runs are listed on ${date}; add a Code Word or Run ID to say which. The first was used.` });
      if (!run && sameDay.length > 1) run = sameDay[0];
    }
    if (!run && knownRuns.length && !runsByDate.has(date)) noRun.add(date);
    const runId = run?.runId || `run-${date}`;

    const key = email || `name:${normalizeName(rawName)}`;
    const dup = `${key}|${runId}`;
    if (seen.has(dup)) { plan.stats.duplicateCheckIns++; continue; }
    seen.add(dup);
    if (!people.has(key)) {
      people.set(key, Boolean(email));
      const fromEmail = !rawName && Boolean(email);
      names.set(key, { name: rawName || (email ? defaultNameFromEmail(email) : ''), fromEmail });
      if (fromEmail) plan.stats.namesFromEmail++;
    } else if (rawName && names.get(key)?.fromEmail) {
      names.set(key, { name: rawName, fromEmail: false });
      plan.stats.namesFromEmail--;
    }

    const time = normalizeTime(cell('time'));
    if (!time) plan.stats.timesDefaulted++;
    const milesText = cell('miles');
    const miles = milesText === '' ? undefined : Number(milesText);
    if (miles !== undefined && (!Number.isFinite(miles) || miles < 0)) plan.issues.push({ row, level: 'warning', message: `Miles "${milesText}" was not understood and was left empty.` });
    const loops = Math.floor(Number(cell('loops')));
    const validMiles = miles !== undefined && Number.isFinite(miles) && miles >= 0 ? miles : undefined;
    if (validMiles) plan.stats.miles += validMiles;
    plan.checkins.push({
      personKey: key, person: { email: email || undefined, name: '', nameFromEmail: false }, date, runId, codeWord,
      time: time ?? '18:30:00', timeDefaulted: !time,
      activity: cell('activity').toLowerCase().startsWith('walk') ? 'walking' : 'running', withPet: yes(cell('withPet')),
      loops: Number.isInteger(loops) && loops >= 1 ? loops : 1, route: cell('route'), miles: validMiles,
    });
    if (!plan.stats.earliest || date < plan.stats.earliest) plan.stats.earliest = date;
    if (!plan.stats.latest || date > plan.stats.latest) plan.stats.latest = date;
  }
  for (const c of plan.checkins) {
    // A person's name is settled once every row has been read (a later row may supply the name the first one lacked).
    const n = names.get(c.personKey)!;
    c.person.name = n.name;
    c.person.nameFromEmail = n.fromEmail;
  }
  plan.members = [...people.values()].filter(Boolean).length;
  plan.aliases = [...people.values()].filter((v) => !v).length;
  plan.datesWithoutRun = [...noRun].sort();
  plan.checkins.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
  return plan;
}

// ---- Which kind of file is this? ----

/** Guess a file's kind from its headers: person + Date is check-ins, Date alone is run history, person alone is profiles. */
export function detectImportFile(csvText: string): ImportFileKind | undefined {
  const first = parseCsv(csvText)[0];
  if (!first) return undefined;
  const keys = new Set(Object.keys(first).map(headerKey));
  const has = (c: ImportColumn) => [c.header, ...c.aliases].some((h) => keys.has(headerKey(h)));
  const person = has(PERSON.email) || has(PERSON.name);
  const date = has(CHECKIN_COLUMNS.date) || has(RUN_COLUMNS.date);
  if (person && date) return 'checkins';
  if (date) return 'runs';
  if (person) return 'profiles';
  return undefined;
}

// ---- Example files ----

const csvCell = (v: string) => (/[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
const toCsv = (columns: Record<string, ImportColumn>, rows: Record<string, string>[]) =>
  [Object.values(columns).map((c) => c.header), ...rows.map((r) => Object.keys(columns).map((k) => r[k] ?? ''))].map((l) => l.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** The downloadable example for each file, always in step with its columns. */
export const IMPORT_EXAMPLES: Record<ImportFileKind, { filename: string; csv: string }> = {
  profiles: {
    filename: 'woodchuckers-import-profiles-example.csv',
    csv: toCsv(PROFILE_COLUMNS, [
      { email: 'jane.runner@example.com', name: 'Jane Runner', shirtSize: 'M', birthday: '1988-04-12', noCheckInRuns: '24' }, // everything filled in
      { email: 'sam@example.com' },                                                                                       // the least a member needs: an email
      { email: 'alex@example.com', name: 'Alex Example', shirtSize: 'Large', birthday: '9/25/83' },                      // spreadsheet-style values
      { name: 'PAT EXAMPLE', noCheckInRuns: '12' },                                                                      // no email: a past alias to claim
    ]),
  },
  runs: {
    filename: 'woodchuckers-import-runs-example.csv',
    csv: toCsv(RUN_COLUMNS, [
      { date: '2026-10-07', time: '18:30', title: 'Wednesday Run', codeWord: 'APPLE', location: 'Blue Note Brewing Company', route: 'The 123', distance: '3.1', surface: 'Pavement' },
      { date: '2026-10-14', codeWord: 'GOLDEN' },                                                         // the least a run needs: a date
      { date: '2026-10-28', title: 'Halloween Costume Run', codeWord: 'SPOOKY', specialEvent: 'Halloween' }, // a special-event run
      { date: '2022-04-06', codeWord: 'BASEBALL' },                                                      // old runs work the same way
    ]),
  },
  checkins: {
    filename: 'woodchuckers-import-checkins-example.csv',
    csv: toCsv(CHECKIN_COLUMNS, [
      { email: 'jane.runner@example.com', name: 'Jane Runner', date: '2026-10-07', time: '18:35:00', activity: 'running', withPet: 'No', loops: '1', route: 'The 123', miles: '3.1' },
      { email: 'jane.runner@example.com', date: '2026-10-14', activity: 'walking', withPet: 'Yes', miles: '1.2' },
      { email: 'sam@example.com', date: '2026-10-07' },                                                    // the least a check-in needs: who and when
      { name: 'PAT EXAMPLE', date: '2022-04-06', codeWord: 'BASEBALL' },                                  // no email: a past alias
    ]),
  },
};
