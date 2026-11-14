import { describe, expect, it } from 'vitest';
import { runPostCaption, socialRunDate } from './socialPost';
const run = { id: 'run-123', title: 'Wednesday Run', date: '2026-11-18', time: '06:30 PM', locationName: 'Test patio', address: 'Woodland, CA', description: 'All paces welcome.', codeWord: 'DO_NOT_SHARE', attendees: [{ email: 'private@example.test' }] };
describe('social post public copy', () => {
  it('includes the intended run link and club-local calendar date without private fields', () => {
    const caption = runPostCaption(run);
    expect(caption).toContain('Wednesday, November 18, 2026');
    expect(caption).toContain('06:30 PM');
    expect(caption).toContain('https://woodland-woodchuckers.web.app/?run=run-123');
    expect(caption).not.toMatch(/DO_NOT_SHARE|private@example/);
  });
  it('retains the run link within Instagram limits for oversized public fields', () => {
    const caption = runPostCaption({ ...run, title: 'x'.repeat(3000), description: 'x'.repeat(5000) });
    expect(caption.length).toBeLessThanOrEqual(2200);
    expect(caption).toContain('?run=run-123');
  });
  it('keeps winter, summer and DST boundary dates in the club calendar day', () => {
    for (const [date, expected] of [['2026-03-08', 'Sunday, March 8, 2026'], ['2026-07-01', 'Wednesday, July 1, 2026'], ['2026-11-01', 'Sunday, November 1, 2026']]) expect(socialRunDate(date)).toBe(expected);
  });
});
