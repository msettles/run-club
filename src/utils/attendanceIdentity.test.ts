import { describe, expect, it } from 'vitest';
import { appAttendanceKeys, historicalRunKeys, legacyAttendanceCredit, uniqueHistoricalAttendance } from './attendanceIdentity';
import { datedEventsFrom, type LegacyEvent } from './legacy';
import { claimGearMilestones } from './claimGear';
import type { CheckInRecord, MilestoneReward } from '../types';

const event = (c: string, r?: string): LegacyEvent => ({ d: '2026-11-11', t: '18:00:00', c, ...(r ? { r } : {}) });
describe('shared claimed attendance', () => {
  it('combines aliases regardless of sign-in time but preserves distinct runs and weeks', () => {
    const rows = [event('VETERAN'), { ...event('veteran'), t: '19:00:00' }, event('OTHER'), { ...event('VETERAN'), d: '2026-11-18' }];
    expect(historicalRunKeys(rows)).toHaveLength(2);
    expect(uniqueHistoricalAttendance(rows)).toHaveLength(2);
    expect(historicalRunKeys([event('SAME','first'),event('SAME','second')])).toHaveLength(2);
  });
  it('matches an older date-only record to one canonical run and refuses ambiguous dates', () => {
    expect(historicalRunKeys([event('VETERAN'),event('VETERAN','run-id')])).toEqual(['run:run-id']);
    expect(()=>historicalRunKeys([event('VETERAN'),event('VETERAN','first'),event('VETERAN','second')])).toThrow('explicit Run ID');
    expect(historicalRunKeys([event('DIFFERENT','first'),event('SAME','second')])).toHaveLength(2);
  });
  it('does not count claimed attendance again when the app already records that run', () => {
    const app = { id:'one',runId:'run-id',date:'2026-11-11',codeWord:'VETERAN' } as CheckInRecord;
    expect(uniqueHistoricalAttendance([event('DIFFERENT','run-id'),event('OTHER','other')],[app])).toEqual([event('OTHER','other')]);
    expect(uniqueHistoricalAttendance([event('ANY WORD')],[app])).toEqual([]);
    expect(legacyAttendanceCredit(['run:run-id','run:other'],appAttendanceKeys([app]))).toBe(1);
  });
  it('never changes identity or special credit based on a code word',()=>{
    const words=['TURKEY','SPOOKY','HALLOWEEN','ANNIVERSARY','PLAIN',''];
    for(const c of words){
      expect(historicalRunKeys([event(c,'one')])).toEqual(['run:one']);
      expect(datedEventsFrom([event(c,'one')],[],[])[0].specialEventIds).toEqual([]);
      expect(datedEventsFrom([{...event(c,'one'),s:'halloween'}],[],[])[0].specialEventIds).toEqual(['halloween']);
    }
  });
  it('special-event badges count a shared run once', () => {
    const e = { ...event('TURKEY','turkey'), s:'turkey_trot' };
    expect(datedEventsFrom([e,{...e,t:'19:00:00'}],[],[])).toHaveLength(1);
  });
  it('gear preserves distinct runs on the same day and all undated credits', () => {
    const milestone = { id:'five',runsRequired:5,measure:'runs' } as MilestoneReward;
    const result = claimGearMilestones([{ id:'main',oldCount:3,events:[event('ONE','one')] },{id:'other',oldCount:0,events:[event('TWO','two')]}],[milestone]);
    expect(result.milestones).toEqual([milestone]);
    expect(claimGearMilestones([{id:'main',oldCount:3,events:[event('ONE','one')]},{id:'other',oldCount:1,events:[event('ONE','one')]}],[milestone]).milestones).toEqual([milestone]);
  });
});
