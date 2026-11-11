import { describe, expect, it } from 'vitest';
import { buildImportCommit, displayTime } from './importCommit';
import { planCheckinsImport, planProfilesImport, planRunsImport } from './importFormat';

const NOW = new Date('2026-11-11T12:00:00Z');
const special = [{ id: 'halloween', name: 'Halloween Costume Run' }];
const profilesCsv = 'Email,Name,Shirt Size,No Check-In Runs\njane@example.com,Jane Runner,M,4\n,PAT EXAMPLE,,12\nsam@example.com,,,\n';
const runsCsv = 'Date,Time,Title,Code Word,Special Event,Distance\n2026-10-07,18:30,Wednesday Run,APPLE,,3.1\n2026-10-28,18:30,Halloween Costume Run,SPOOKY,Halloween,3.1\n';
const checkinsCsv = [
  'Email,Name,Date,Code Word,Activity,Miles',
  'jane@example.com,,2026-10-07,,running,3.1',
  'jane@example.com,,2026-10-28,,walking,3.1',
  'sam@example.com,,2026-10-07,,running,3.1',
  ',PAT EXAMPLE,2026-10-28,,running,',
  'new.person@example.com,,2026-11-04,,running,2',
].join('\n');

function build() {
  const runs = planRunsImport(runsCsv, NOW, special);
  return buildImportCommit(planProfilesImport(profilesCsv, NOW), runs, planCheckinsImport(checkinsCsv, runs.runs, NOW), NOW);
}

describe('buildImportCommit', () => {
  it('formats times the way runs store them', () => {
    expect(displayTime('18:30:00')).toBe('06:30 PM');
    expect(displayTime('06:05:00')).toBe('06:05 AM');
    expect(displayTime('12:00:00')).toBe('12:00 PM');
  });

  it('makes members of everyone with an email, even when only a check-in names them', () => {
    const members = build().members.map((m) => m.profile);
    expect(members.map((m) => m.email).sort()).toEqual(['jane@example.com', 'new.person@example.com', 'sam@example.com']);
    const jane = members.find((m) => m.email === 'jane@example.com')!;
    expect(jane).toMatchObject({ displayName: 'Jane Runner', firstName: 'Jane', lastName: 'Runner', shirtSize: 'M', pre2021Runs: 4, importedRuns: 4, loggedRuns: 0, totalMiles: 0, role: 'member' });
    expect(members.find((m) => m.email === 'sam@example.com')!.displayName).toBe('Sam');
  });

  it('records which fields the files actually gave, so a name made from an email never overwrites a real one', () => {
    const { members } = build();
    expect(members.find((m) => m.profile.email === 'jane@example.com')!.given).toEqual({ name: true, shirtSize: true, birthday: false, noCheckInRuns: true });
    expect(members.find((m) => m.profile.email === 'sam@example.com')!.given).toEqual({ name: false, shirtSize: false, birthday: false, noCheckInRuns: false });
  });

  it('holds people without an email as unclaimed aliases, with their sign-ins, and makes no profile for them', () => {
    const { aliases, members, checkins, stats } = build();
    expect(members.some((m) => /pat/i.test(m.profile.displayName))).toBe(false);
    expect(checkins.some((c) => /pat/i.test(c.userEmail))).toBe(false);
    expect(aliases).toHaveLength(1);
    expect(aliases[0]).toMatchObject({ id: 'pat-example', name: 'PAT EXAMPLE', oldCount: 12 });
    expect(aliases[0].events).toEqual([{ d: '2026-10-28', t: '18:30:00', c: 'SPOOKY', s: 'halloween' }]);
    expect(stats.heldSignIns).toBe(1);
  });

  it('writes member check-ins as legacy_import records that carry the run and its special event', () => {
    const { checkins } = build();
    expect(checkins).toHaveLength(4);
    const spooky = checkins.find((c) => c.userEmail === 'jane@example.com' && c.date === '2026-10-28')!;
    expect(spooky).toMatchObject({ source: 'legacy_import', activity: 'walking', actualMiles: 3.1, distanceChoice: '3.1', loops: 1, eventSpecial: 'halloween', eventTitle: 'Halloween Costume Run', codeWord: 'SPOOKY' });
    expect(spooky.id).toBe(`${spooky.runId}_jane@example.com`);
  });

  it('gives every credited distance a route option so the rules can check the mileage', () => {
    const { runs } = build();
    const halloween = runs.find((r) => r.run.specialEvent === 'halloween')!;
    expect(halloween.meetup.activeDistances).toEqual(['3.1']);
    expect(halloween.meetup.routes['3.1'].actualMiles).toBe(3.1);
    expect(halloween.meetup.specialEvent).toBe('halloween');
    // No check-in window is stored: nobody can check in to it, and a corrected file can still update it.
    expect(halloween.meetup.checkInOpensAt).toBeUndefined();
    expect(halloween.meetup.checkInClosesAt).toBeUndefined();
  });

  it('makes a placeholder run for a check-in date with no run, and never invents a code word', () => {
    const { runs, stats } = build();
    const placeholder = runs.find((r) => r.placeholder)!;
    expect(placeholder.run.date).toBe('2026-11-04');
    expect(placeholder.codeWord).toBe('');
    expect(placeholder.meetup.routes['2'].actualMiles).toBe(2);
    expect(stats).toMatchObject({ runs: 3, placeholderRuns: 1, checkins: 4, members: 3, aliases: 1 });
  });

  it('builds nothing from a missing file', () => {
    expect(buildImportCommit(undefined, undefined, undefined, NOW).stats).toMatchObject({ runs: 0, checkins: 0, members: 0, aliases: 0 });
  });
});
