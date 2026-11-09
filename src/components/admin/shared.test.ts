import { expect, it } from 'vitest';
import { csvCell, effectiveRole } from './shared';
import { GUEST_USER } from '../../data/initialData';

it.each(['=SUM(A1:A2)', '+cmd', '-cmd', '@sum', '\t=cmd', '\r=cmd'])('neutralizes CSV formula text %j', (text) => {
  expect(csvCell(text).replace(/^"/, '')).toMatch(/^'/);
});
it('escapes CSV quotes, commas and embedded line breaks without converting numbers into text', () => {
  expect(csvCell('Jane "JJ", Runner\nWoodland')).toBe('"Jane ""JJ"", Runner\nWoodland"');
  expect(csvCell(-3.1)).toBe('-3.1');
  expect(csvCell(null)).toBe('');
});
it('uses the same owner and organizer rules as the rest of the app', () => {
  expect(effectiveRole({ ...GUEST_USER, email: 'WoodlandWoodchuckers@gmail.com', role: 'member' })).toBe('admin');
  expect(effectiveRole({ ...GUEST_USER, email: 'org@example.com', role: 'organizer' })).toBe('organizer');
});
