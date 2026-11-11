/**
 * Converts the OLD app's two exports into the three import files (profiles, run history, check-ins), and writes a report
 * of everything worth a second look. Nothing is written to Firestore; this only reads the two files and writes CSVs.
 *
 *   node scripts/convert-legacy-export.mjs --totals data/woodland_woodchuckers_user_totals.csv \
 *        --checkins data/woodland_woodchuckers_checkins_by_date.csv --out data/converted
 *
 * Output (in --out): profiles.csv, runs.csv, checkins.csv, report.md.
 * The old files have names only (no emails), so every person becomes a past alias a runner can claim.
 * The run history's "Special Event" column is a SUGGESTION from code words and dates: review it (and the report's list of
 * other candidates), edit the CSV, then import it. The extra helper columns at the end of runs.csv are ignored by the importer.
 */
import { build } from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const opt = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const totalsPath = opt('--totals');
const checkinsPath = opt('--checkins');
const outDir = opt('--out') || 'data/converted';
if (!totalsPath || !checkinsPath) {
  console.error('Usage: node scripts/convert-legacy-export.mjs --totals <user_totals.csv> --checkins <checkins_by_date.csv> [--out <dir>]');
  process.exit(1);
}

// The app's own readers and checkers, so the converted files are produced and verified by the same code the importer uses.
const root = new URL('..', import.meta.url).pathname;
const bundled = await build({
  stdin: {
    contents: "export { parseCsv, normalizeName } from './src/utils/legacy.ts'; export { planProfilesImport, planRunsImport, planCheckinsImport, PROFILE_COLUMNS, RUN_COLUMNS, CHECKIN_COLUMNS } from './src/utils/importFormat.ts';",
    resolveDir: root, loader: 'ts',
  },
  bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
});
const app = await import(`data:text/javascript;base64,${Buffer.from(bundled.outputFiles[0].text).toString('base64')}`);
const { parseCsv, normalizeName } = app;

const csvCell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
const toCsv = (headers, rows) => [headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n';
const clean = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const codeKey = (s) => normalizeName(s).replace(/ /g, '');
const day = (iso) => new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });

const totals = parseCsv(readFileSync(totalsPath, 'utf8'));
const checkins = parseCsv(readFileSync(checkinsPath, 'utf8'));

// ---- people ----
const people = new Map(); // key -> { name, spellings: Map, oldCount }
const person = (rawName) => {
  const key = normalizeName(rawName);
  if (!people.has(key)) people.set(key, { key, spellings: new Map(), oldCount: 0 });
  return people.get(key);
};
const spell = (p, raw) => { const n = clean(raw); if (n) p.spellings.set(n, (p.spellings.get(n) || 0) + 1); };
for (const r of totals) {
  if (!normalizeName(r.Name || '')) continue;
  const p = person(r.Name);
  spell(p, r.Name);
  p.oldCount += Math.max(0, Math.round(Number(r.OldCounts || 0)) || 0);
}
const namesInTotals = new Set(people.keys());
for (const r of checkins) {
  if (!normalizeName(r.Name || '') || !r.Date) continue;
  const p = person(r.Name);
  spell(p, r.Name);
}
const namesOnlyInCheckins = [...people.keys()].filter((k) => !namesInTotals.has(k)).length;

// ---- one run per date ----
const byDate = new Map(); // date -> { codes: Map, rows: [] }
for (const r of checkins) {
  const d = clean(r.Date);
  if (!normalizeName(r.Name || '') || !d) continue;
  if (!byDate.has(d)) byDate.set(d, { codes: new Map(), rows: [] });
  const g = byDate.get(d);
  const code = codeKey(r['Code Name'] || '');
  g.codes.set(code, (g.codes.get(code) || 0) + 1);
  g.rows.push({ r, code });
}
const runs = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, g]) => {
  const ranked = [...g.codes.entries()].sort((a, b) => b[1] - a[1]);
  return { date, code: ranked[0][0], attendance: g.rows.length, others: ranked.slice(1), special: '', why: '' };
});
const runByDate = new Map(runs.map((r) => [r.date, r]));
const median = (() => { const a = runs.map((r) => r.attendance).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : 0; })();

// ---- special event suggestions (only the obvious ones; the rest go to the report for a human to decide) ----
const inWindow = (date, m1, d1, m2, d2) => { const [, m, d] = date.split('-').map(Number); return (m * 100 + d) >= (m1 * 100 + d1) && (m * 100 + d) <= (m2 * 100 + d2); };
// Calendar rules (set by the club): Anniversary = last Wednesday of May; Turkey Trot = Thanksgiving Thursday
// (4th Thursday of November); Halloween = the Wednesday before October 31.
const ymd = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
const dow = (y, m, d) => new Date(Date.UTC(y, m - 1, d)).getUTCDay();
const lastWeekday = (y, m, wd) => { let d = new Date(Date.UTC(y, m, 0)).getUTCDate(); while (dow(y, m, d) !== wd) d--; return d; };
const nthWeekday = (y, m, wd, n) => { let d = 1; while (dow(y, m, d) !== wd) d++; return d + 7 * (n - 1); };
const beforeWeekday = (y, m, d, wd) => { const t = new Date(Date.UTC(y, m - 1, d)); do t.setUTCDate(t.getUTCDate() - 1); while (t.getUTCDay() !== wd); return ymd(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate()); };
const specialDates = new Map();
for (let y = 2018; y <= new Date().getFullYear() + 1; y++) {
  specialDates.set(ymd(y, 5, lastWeekday(y, 5, 3)), ['Anniversary Run', 'last Wednesday of May']);
  specialDates.set(ymd(y, 11, nthWeekday(y, 11, 4, 4)), ['Turkey Trot', 'Thanksgiving Thursday']);
  specialDates.set(beforeWeekday(y, 10, 31, 3), ['Halloween Costume Run', 'Wednesday before Halloween']);
}
for (const run of runs) {
  const hit = specialDates.get(run.date);
  if (hit) { run.special = hit[0]; run.why = hit[1]; }
}
const HOLIDAY = /EASTER|SHAMROCK|LIGHTS|JINGLE|SANTA|CANDYCANE|FIREWORK|NEWYEAR|CANDYCORN|CORNMAZE|PUMPKIN|BOO|CHRISTMAS|VALENTINE|HEART|PRIDE|BIRTHDAY|OCTOBERFEST|UNICORN|HOTPOTATO|SUNRISE/;
const review = runs.filter((r) => !r.special && (HOLIDAY.test(r.code) || r.attendance >= Math.max(30, median * 2) || inWindow(r.date, 11, 20, 11, 29)))
  .map((r) => ({ ...r, reason: [HOLIDAY.test(r.code) ? 'holiday-style code word' : '', r.attendance >= Math.max(30, median * 2) ? `big turnout (${r.attendance}, median ${median})` : '', inWindow(r.date, 11, 20, 11, 29) ? 'Thanksgiving week (not on the Thursday)' : ''].filter(Boolean).join('; ') }));

// ---- check-ins: one per person per date ----
let exactRepeats = 0;
let sameDayOtherCode = 0;
const chosen = new Map(); // key|date -> row
for (const [date, g] of byDate) {
  const primary = runByDate.get(date).code;
  const seenRows = new Map();
  for (const { r, code } of g.rows) {
    const key = normalizeName(r.Name);
    const prev = seenRows.get(key);
    if (!prev) { seenRows.set(key, { r, code }); continue; }
    if (prev.code === code) exactRepeats++; else sameDayOtherCode++;
    // Keep the sign-in that used the day's main code word; otherwise the earlier one.
    if (prev.code !== primary && code === primary) seenRows.set(key, { r, code });
  }
  for (const [key, row] of seenRows) chosen.set(`${key}|${date}`, { key, date, ...row });
}
const checkinRows = [...chosen.values()].sort((a, b) => a.date.localeCompare(b.date) || a.key.localeCompare(b.key));

const displayName = (p) => [...p.spellings.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || p.key;
const profileRows = [...people.values()].sort((a, b) => displayName(a).localeCompare(displayName(b)))
  .map((p) => ['', displayName(p), '', p.oldCount > 0 ? p.oldCount : '']);

mkdirSync(outDir, { recursive: true });
const H = (cols) => Object.values(cols).map((c) => c.header);
writeFileSync(join(outDir, 'profiles.csv'), toCsv(H(app.PROFILE_COLUMNS), profileRows));
writeFileSync(join(outDir, 'runs.csv'), toCsv([...H(app.RUN_COLUMNS), 'Check-Ins', 'Other Code Words', 'Why Tagged'],
  runs.map((r) => [r.date, '', '', r.code, r.special, '', '', '', '', '', '', '', r.attendance, r.others.map(([c, n]) => `${c} (${n})`).join('; '), r.why])));
writeFileSync(join(outDir, 'checkins.csv'), toCsv(H(app.CHECKIN_COLUMNS),
  checkinRows.map((c) => ['', displayName(people.get(c.key)), c.date, '', c.code, clean(c.r.Time), '', '', '', '', ''])));

// ---- verify the output with the app's own checkers ----
const profilesPlan = app.planProfilesImport(readFileSync(join(outDir, 'profiles.csv'), 'utf8'));
const runsPlan = app.planRunsImport(readFileSync(join(outDir, 'runs.csv'), 'utf8'), new Date(), [
  { id: 'turkey_trot', name: 'Turkey Trot' }, { id: 'halloween', name: 'Halloween Costume Run' }, { id: 'anniversary', name: 'Anniversary Run' },
]);
const checkinsPlan = app.planCheckinsImport(readFileSync(join(outDir, 'checkins.csv'), 'utf8'), runsPlan.runs);
const errs = (p) => p.issues.filter((i) => i.level === 'error').length;
const warns = (p) => p.issues.filter((i) => i.level === 'warning').length;

const sum = (a) => a.reduce((n, x) => n + x, 0);
const multi = runs.filter((r) => r.others.length);
const weekdays = {};
for (const r of runs) weekdays[day(r.date)] = (weekdays[day(r.date)] || 0) + 1;
const specialCounts = {};
for (const r of runs) if (r.special) specialCounts[r.special] = (specialCounts[r.special] || 0) + 1;
const spellingVariants = [...people.values()].filter((p) => p.spellings.size > 1).length;

const report = `# Legacy export conversion report

Source: ${totalsPath} (${totals.length} rows) and ${checkinsPath} (${checkins.length} rows). Nothing was written to Firestore.

## What was produced
| File | Rows | Notes |
|---|---|---|
| profiles.csv | ${profileRows.length} | one per person, all with NO email (past aliases to claim); No Check-In Runs total ${sum([...people.values()].map((p) => p.oldCount))} (the old files' OldCounts); shirt size = most recent non-blank |
| runs.csv | ${runs.length} | one per date; Code Word = the day's most-used code word; Special Event = suggestions only |
| checkins.csv | ${checkinRows.length} | one per person per date (was ${checkins.length} sign-ins) |

Checked with the app's own checkers: profiles ${errs(profilesPlan)} errors / ${warns(profilesPlan)} warnings; runs ${errs(runsPlan)} / ${warns(runsPlan)}; check-ins ${errs(checkinsPlan)} / ${warns(checkinsPlan)} (${checkinsPlan.datesWithoutRun.length} dates without a run).

## Things that changed or need a decision
- **Sign-ins collapsed to one per person per date:** ${exactRepeats} exact repeats (same code word) and ${sameDayOtherCode} same-person-same-day sign-ins with a different code word were reduced to one each. The old importer counted the second kind twice; the new format counts a person once per run. Total check-ins: ${checkins.length} -> ${checkinRows.length}.
- **Dates with more than one code word (${multi.length}):** treated as ONE run using the most-used code word (the club has never held two runs at once); the others are listed in runs.csv ("Other Code Words"). If any were really two separate runs, split that row. ${multi.map((r) => `${r.date} ${r.code} ${r.attendance} (${r.others.map(([c, n]) => `${c} ${n}`).join(', ')})`).join('; ')}
- **Days of the week:** ${Object.entries(weekdays).sort((a, b) => b[1] - a[1]).map(([d, n]) => `${d} ${n}`).join(', ')}. Runs on days other than Wednesday are kept as they are.
- **Names:** ${people.size} distinct names (matched ignoring case/spacing); ${spellingVariants} had more than one spelling (the most common is used); ${namesOnlyInCheckins} appear only in the check-ins file; ${[...people.values()].filter((p) => p.oldCount > 0 && ![...checkinRows].some((c) => c.key === p.key)).length} have only a no-check-in count.
- **Shirt size, city, zip, emergency contact:** not imported; runners enter them after signing in.
- **No times of day for runs, no miles, no routes, no activity:** the old data has none. Check-ins keep their sign-in time; runs get the default 18:30 start. Mileage totals will start at zero.

## Special events
Tags applied by calendar rule (Anniversary = last Wednesday of May, Turkey Trot = Thanksgiving Thursday, Halloween = Wednesday before Oct 31):
${Object.entries(specialCounts).map(([n, c]) => `- ${n}: ${c} run(s)`).join('\n') || '- none'}

Other runs that MIGHT be special events (${review.length}); decide which to tag, then edit the Special Event column in runs.csv. The tag must be one of your club's special events (add new ones under Admin > Badges first):

| Date | Day | Code word | Check-ins | Why it's listed |
|---|---|---|---|---|
${review.map((r) => `| ${r.date} | ${day(r.date)} | ${r.code} | ${r.attendance} | ${r.reason} |`).join('\n')}
`;
writeFileSync(join(outDir, 'report.md'), report);

console.log(`Wrote ${profileRows.length} profiles, ${runs.length} runs, ${checkinRows.length} check-ins to ${outDir}/ (from ${checkins.length} sign-ins).`);
console.log(`Checkers: profiles ${errs(profilesPlan)}e/${warns(profilesPlan)}w, runs ${errs(runsPlan)}e/${warns(runsPlan)}w, check-ins ${errs(checkinsPlan)}e/${warns(checkinsPlan)}w.`);
console.log(`Special events suggested: ${JSON.stringify(specialCounts)}; other candidates to review: ${review.length}. See ${outDir}/report.md`);
