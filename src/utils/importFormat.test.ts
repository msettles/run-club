import { describe, expect, it } from 'vitest';
import {
  matchSpecialEvent, IMPORT_EXAMPLES, defaultNameFromEmail, detectImportFile, normalizeShirtSize, parseBirthday, planCheckinsImport, planProfilesImport, planRunsImport,
} from './importFormat';

const NOW = new Date('2026-11-12T12:00:00Z');

describe('profiles file', () => {
  it('splits people with an email (members) from people without one (past aliases)', () => {
    const plan = planProfilesImport('Email,Name,No Check-In Runs\nann@x.com,Ann A,24\n,BOB B,12\n', NOW);
    expect(plan.members).toMatchObject([{ email: 'ann@x.com', name: 'Ann A', noCheckInRuns: 24 }]);
    expect(plan.aliases).toMatchObject([{ name: 'BOB B', noCheckInRuns: 12 }]);
    expect(plan.stats.noCheckInRuns).toBe(36);
  });

  it('names a member from their email when there is no name (never the domain)', () => {
    expect(defaultNameFromEmail('jane.doe+runs@gmail.com')).toBe('Jane Doe Runs');
    expect(defaultNameFromEmail('brittneyechols925@gmail.com')).toBe('Brittneyechols925');
    const plan = planProfilesImport('Email,Name\nkim@x.com,\n', NOW);
    expect(plan.members[0]).toMatchObject({ name: 'Kim', nameFromEmail: true });
    expect(plan.stats.namesFromEmail).toBe(1);
  });

  it('reads profile fields the way spreadsheets write them, and ignores totals columns (they are recomputed)', () => {
    const plan = planProfilesImport('Email,Display Name,Shirt Size,Birthday,Total Runs,Total Miles,Pre-2021 Runs\nann@x.com,Ann,Large,9/25/83,166,1.22,2\n', NOW);
    expect(plan.members[0]).toMatchObject({ name: 'Ann', shirtSize: 'L', birthday: '1983-09-25', noCheckInRuns: 2 });
    expect(plan.ignoredColumns).toEqual(['Total Runs', 'Total Miles']);
  });

  it('combines repeated people with a warning, and rejects rows it cannot place', () => {
    const plan = planProfilesImport('Email,Name,No Check-In Runs\na@x.com,,5\na@x.com,Ann,2\nnot-an-email,B,1\n,,3\n', NOW);
    expect(plan.members[0]).toMatchObject({ email: 'a@x.com', name: 'Ann', noCheckInRuns: 7 });
    expect(plan.issues.filter((i) => i.level === 'error').map((i) => i.row)).toEqual([4, 5]);
    expect(plan.issues.some((i) => i.level === 'warning' && i.message.includes('more than once'))).toBe(true);
  });

  it('needs an Email or a Name column', () => {
    expect(planProfilesImport('Shirt Size\nM\n', NOW).issues[0].message).toContain('Email column or a Name column');
    expect(planProfilesImport('', NOW).issues[0].message).toContain('no rows');
  });

  it('understands shirt sizes and birthdays', () => {
    expect(['Small', 'Xl', 'medium', 'LARGE', 'xxl', 'Youth', 'weird', 'Xxsmall', 'Med', 'Xsmall'].map(normalizeShirtSize)).toEqual(['S', 'XL', 'M', 'L', '2XL', 'Youth', 'weird', 'XS', 'M', 'XS']);
    expect(normalizeShirtSize('')).toBeUndefined();
    expect(parseBirthday('9/25/83', NOW)).toBe('1983-09-25');
    expect(parseBirthday('2/25/05', NOW)).toBe('2005-02-25');
    expect(parseBirthday('2/30/1990', NOW)).toBeUndefined();
  });
});

describe('run history file', () => {
  it('needs only a Date; code words and ids are made when absent', () => {
    const plan = planRunsImport('Date,Code Word,Title\n2026-10-07,Apple,Wednesday Run\n10/14/26,,\n', NOW);
    expect(plan.runs).toMatchObject([
      { runId: 'run-2026-10-07-apple', date: '2026-10-07', codeWord: 'APPLE', title: 'Wednesday Run', time: '18:30:00' },
      { runId: 'run-2026-10-14', date: '2026-10-14', title: 'Group run', surface: 'Pavement' },
    ]);
    expect(plan.stats.timesDefaulted).toBe(2);
  });

  it('keeps two runs on one day apart by code word, and drops a true repeat', () => {
    const plan = planRunsImport('Date,Code Word\n2026-10-07,APPLE\n2026-10-07,PEAR\n2026-10-07,apple\n', NOW);
    expect(plan.runs.map((r) => r.runId)).toEqual(['run-2026-10-07-apple', 'run-2026-10-07-pear']);
    expect(plan.stats.duplicateRuns).toBe(1);
  });

  it('flags bad and odd dates', () => {
    const plan = planRunsImport('Date\nOct 7th\n2017-01-04\n2027-01-01\n', NOW);
    expect(plan.issues.filter((i) => i.level === 'error')).toHaveLength(1);
    expect(plan.issues.map((i) => i.message).join('|')).toContain('before the club was established');
    expect(plan.issues.map((i) => i.message).join('|')).toContain('in the future');
    expect(planRunsImport('Title\nx\n', NOW).issues[0].message).toContain('needs a Date column');
  });
});

describe('special event tags on the run history', () => {
  const club = [{ id: 'turkey_trot', name: 'Turkey Trot' }, { id: 'halloween', name: 'Halloween Costume Run' }, { id: 'anniversary', name: 'Anniversary Run' }];

  it('matches a tag to the club\'s special events by id, name, or a unique part of the name', () => {
    expect(matchSpecialEvent('turkey_trot', club)?.id).toBe('turkey_trot');
    expect(matchSpecialEvent('Turkey Trot', club)?.id).toBe('turkey_trot');
    expect(matchSpecialEvent('Halloween', club)?.id).toBe('halloween');
    expect(matchSpecialEvent('anniversary run', club)?.id).toBe('anniversary');
    expect(matchSpecialEvent('Run', club)).toBeUndefined(); // matches two of them, so no guess
    expect(matchSpecialEvent('St. Patrick', club)).toBeUndefined();
    expect(matchSpecialEvent('', club)).toBeUndefined();
  });

  it('tags runs, counts them per event, and warns about a tag the club does not have', () => {
    const plan = planRunsImport('Date,Code Word,Special Event\n2024-11-27,TURKEY,Turkey Trot\n2025-11-26,TURKEY,turkey_trot\n2025-10-29,SPOOKY,Halloween\n2025-03-17,SHAMROCK,St. Patricks\n2025-03-12,PLAIN,\n', NOW, club);
    expect(plan.runs.filter((r) => r.specialEventId === 'turkey_trot')).toHaveLength(2);
    expect(plan.runs.find((r) => r.codeWord === 'SPOOKY')?.specialEventId).toBe('halloween');
    expect(plan.runs.find((r) => r.codeWord === 'SHAMROCK')?.specialEventId).toBeUndefined();
    expect(plan.runs.find((r) => r.codeWord === 'PLAIN')?.specialEventId).toBeUndefined();
    expect(plan.specialEvents).toEqual({ 'Turkey Trot': 2, 'Halloween Costume Run': 1, 'St. Patricks': 1 });
    expect(plan.issues.filter((i) => i.level === 'warning').map((i) => i.message).join('|')).toContain('St. Patricks" is not one of your special events');
  });

  it('without the club\'s events to check against, the tag is just carried along', () => {
    const plan = planRunsImport('Date,Special Event\n2025-03-17,St. Patricks\n', NOW);
    expect(plan.runs[0]).toMatchObject({ specialEvent: 'St. Patricks', specialEventId: undefined });
    expect(plan.issues).toEqual([]);
  });
});

describe('check-ins file', () => {
  const runs = planRunsImport('Date,Code Word\n2026-10-07,APPLE\n2026-10-14,GOLDEN\n2026-10-14,PEAR\n', NOW).runs;

  it('matches a check-in to its run by date, using the code word when two runs share a day', () => {
    const plan = planCheckinsImport('Email,Date,Code Word\na@x.com,2026-10-07,\na@x.com,2026-10-14,pear\nb@x.com,10/14/26,GOLDEN\n', runs, NOW);
    expect(plan.checkins.map((c) => [c.person.email, c.runId])).toEqual([
      ['a@x.com', 'run-2026-10-07-apple'], ['a@x.com', 'run-2026-10-14-pear'], ['b@x.com', 'run-2026-10-14-golden'],
    ]);
  });

  it('only a person and a date are needed; blanks get defaults and miles stay unknown', () => {
    const plan = planCheckinsImport('Email,Date\nann@x.com,2026-10-07\n', [], NOW);
    expect(plan.checkins[0]).toMatchObject({ date: '2026-10-07', runId: 'run-2026-10-07', time: '18:30:00', timeDefaulted: true, activity: 'running', withPet: false, loops: 1, route: '' });
    expect(plan.checkins[0].miles).toBeUndefined();
    expect(plan.checkins[0].person).toMatchObject({ name: 'Ann', nameFromEmail: true });
  });

  it('reads this app\'s own check-in export (Excel dates, totals ignored) and the old-app columns', () => {
    const exported = 'Date,Time,Code Word,User Email,Runner Name,Activity,With Pet,Loops,Route Choice,Actual GPS Miles,Route Name,Source\n10/7/26,18:35:00,APPLE,t2@example.test,Test Runner 2,running,No,1,route-test,3.1,Test 3.1 mi,admin\n';
    const plan = planCheckinsImport(exported, runs, NOW);
    expect(plan.checkins[0]).toMatchObject({ date: '2026-10-07', time: '18:35:00', miles: 3.1, route: 'Test 3.1 mi', runId: 'run-2026-10-07-apple' });
    expect(plan.checkins[0].person).toMatchObject({ email: 't2@example.test', name: 'Test Runner 2' });
    expect(plan.ignoredColumns).toEqual(expect.arrayContaining(['Route Choice', 'Source']));
    const old = planCheckinsImport('Name,Date,Time,Checkin,Code Name,Shirt Size\nABBY MIKSITS,2023-10-04,18:29:01,1,PUMPKIN PATCH,Small\n', [], NOW);
    expect(old.aliases).toBe(1);
    expect(old.checkins[0].person).toMatchObject({ name: 'ABBY MIKSITS' });
  });

  it('adds up miles from the check-ins only, drops repeats of the same person and run, and counts members and aliases', () => {
    const plan = planCheckinsImport('Email,Name,Date,Miles\na@x.com,A,2026-10-07,3.1\na@x.com,A,2026-10-07,3.1\nA ALIAS,,2026-10-07,\n', [], NOW);
    expect(plan.stats).toMatchObject({ duplicateCheckIns: 1, miles: 3.1 });
    expect([plan.members, plan.aliases]).toEqual([1, 0]);
    // The third row has a name only in the Email column (not an email), so it is an error, not an alias.
    expect(plan.stats.skippedRows).toBe(1);
  });

  it('warns about dates with no run in the run history, and about a Run ID it does not know', () => {
    const plan = planCheckinsImport('Email,Date,Run ID\na@x.com,2026-09-30,\na@x.com,2026-10-07,nope\n', runs, NOW);
    expect(plan.datesWithoutRun).toEqual(['2026-09-30']);
    expect(plan.issues.some((i) => i.message.includes('Run ID "nope"'))).toBe(true);
  });

  it('needs a person column and a Date (or Run ID) column', () => {
    expect(planCheckinsImport('Date\n2026-10-07\n', [], NOW).issues[0].message).toContain('Email column or a Name column');
    expect(planCheckinsImport('Email\na@x.com\n', [], NOW).issues[0].message).toContain('needs a Date column');
  });
});

describe('telling the files apart, and the examples', () => {
  it('detects the kind from the headers', () => {
    expect(detectImportFile('Email,Name,Shirt Size\na@x.com,A,M\n')).toBe('profiles');
    expect(detectImportFile('Date,Code Word,Title\n2026-10-07,APPLE,Run\n')).toBe('runs');
    expect(detectImportFile('Email,Date,Miles\na@x.com,2026-10-07,3\n')).toBe('checkins');
    expect(detectImportFile('Name,Date,Time,Checkin,Code Name\nA,2023-10-04,18:00,1,X\n')).toBe('checkins');
    expect(detectImportFile('Foo,Bar\n1,2\n')).toBeUndefined();
  });

  it('each example is valid and shows every kind of row', () => {
    const profiles = planProfilesImport(IMPORT_EXAMPLES.profiles.csv, NOW);
    expect(profiles.issues).toEqual([]);
    expect([profiles.members.length, profiles.aliases.length]).toEqual([3, 1]);
    const runs = planRunsImport(IMPORT_EXAMPLES.runs.csv, NOW);
    expect(runs.issues).toEqual([]);
    expect(runs.runs).toHaveLength(4);
    const checkins = planCheckinsImport(IMPORT_EXAMPLES.checkins.csv, runs.runs, NOW);
    expect(checkins.issues).toEqual([]);
    expect(checkins.checkins).toHaveLength(4);
    expect([checkins.members, checkins.aliases]).toEqual([2, 1]);
    expect(checkins.datesWithoutRun).toEqual([]);
    expect(Object.values(IMPORT_EXAMPLES).map((e) => detectImportFile(e.csv))).toEqual(['profiles', 'runs', 'checkins']);
  });

  it('the example files in docs/examples stay in step with the formats', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('docs/examples/import-profiles-example.csv', 'utf8')).toBe(IMPORT_EXAMPLES.profiles.csv);
    expect(readFileSync('docs/examples/import-runs-example.csv', 'utf8')).toBe(IMPORT_EXAMPLES.runs.csv);
    expect(readFileSync('docs/examples/import-checkins-example.csv', 'utf8')).toBe(IMPORT_EXAMPLES.checkins.csv);
  });
});
