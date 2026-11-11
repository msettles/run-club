import { describe, expect, it } from 'vitest';
import { firstRunLabel, runningSince } from './firstRun';

describe('firstRunLabel', () => {
  it('is the oldest check-in date when every run has a record', () => {
    expect(firstRunLabel(0, ['2023-05-10', '2021-03-10', '2022-01-02'])).toBe('2021-03-10');
  });
  it('is "Before mm/yyyy" of the oldest recorded date when some runs have no check-in', () => {
    expect(firstRunLabel(12, ['2023-05-10', '2021-03-10'])).toBe('Before 03/2021');
  });
  it('says so when there are such runs but no dated record to measure from', () => {
    expect(firstRunLabel(3, [])).toBe('Before check-ins began');
  });
  it('is empty with no runs at all, and ignores anything that is not a date', () => {
    expect(firstRunLabel(0, [])).toBeUndefined();
    expect(firstRunLabel(0, ['', 'soon', '2022-02-02'])).toBe('2022-02-02');
  });
});

describe('runningSince', () => {
  it('reads both forms', () => {
    expect(runningSince('2021-03-10')).toBe('2021');
    expect(runningSince('Before 03/2021')).toBe('before 03/2021');
    expect(runningSince('Before check-ins began')).toBe('');
    expect(runningSince('')).toBe('');
  });
});
