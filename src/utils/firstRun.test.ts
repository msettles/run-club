import { describe, expect, it } from 'vitest';
import { firstRunLabel, runningSince } from './firstRun';

describe('firstRunLabel', () => {
  it('is month/year of the oldest check-in when every run has a record', () => {
    expect(firstRunLabel(0, ['2023-05-10', '2021-03-10', '2022-01-02'])).toBe('03/2021');
  });
  it('is "Before mm/yyyy" of when the club\'s records begin when some runs have no check-in', () => {
    expect(firstRunLabel(12, ['2023-05-10', '2021-03-10'], '2021-01-06')).toBe('Before 01/2021');
  });
  it('never claims a start later than the member\'s own oldest record', () => {
    expect(firstRunLabel(2, ['2020-11-04'], '2021-01-06')).toBe('Before 11/2020');
  });
  it('falls back to the member\'s oldest record when the club start is unknown, and says so when there is none', () => {
    expect(firstRunLabel(3, ['2021-03-10'])).toBe('Before 03/2021');
    expect(firstRunLabel(3, [])).toBe('Before check-ins began');
  });
  it('is empty with no runs at all, and ignores anything that is not a date', () => {
    expect(firstRunLabel(0, [])).toBeUndefined();
    expect(firstRunLabel(0, ['', 'soon', '2022-02-02'])).toBe('02/2022');
  });
});

describe('runningSince', () => {
  it('reads every form', () => {
    expect(runningSince('03/2021')).toBe('03/2021');
    expect(runningSince('Before 01/2021')).toBe('before 01/2021');
    expect(runningSince('2021-03-10')).toBe('2021');
    expect(runningSince('Before check-ins began')).toBe('');
    expect(runningSince('')).toBe('');
  });
});
