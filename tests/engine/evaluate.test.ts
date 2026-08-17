import { describe, expect, it } from 'vitest';
import { evaluate } from '../../src/engine/evaluate';

const day={id:'d',schemaVersion:1,startedAt:'2026-01-01T00:00:00Z',timezoneId:'America/Chicago',workContext:'OFF_DUTY' as const,status:'ACTIVE' as const,createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'};
const workDay={...day,workContext:'WORK' as const};
const checkIn={id:'c',beyondDayId:'d',recordedAt:'2026-01-01T00:01:00Z',energy:3 as const,stress:3 as const,mood:3 as const,soreness:1 as const,alcoholUrge:0 as const};

describe('evaluate',()=>{
  it('produces a real NO ACTION REQUIRED recommendation',()=>{
    const result=evaluate({beyondDay:day,latestCheckIn:checkIn,recentEvents:[],context:{},now:'2026-01-01T00:02:00Z'});
    expect(result.primary.statusAtIssue).toBe('NO_ACTION_REQUIRED');
    expect(result.primary.kind).toBe('NO_ACTION_REQUIRED');
  });

  it('prioritizes stabilize over lower rules',()=>{
    const result=evaluate({beyondDay:day,latestCheckIn:{...checkIn,stress:5},recentEvents:[],context:{hasPlannedWork:true},now:'2026-01-01T00:02:00Z'});
    expect(result.primary.kind).toBe('STABILIZE');
    expect(result.primary.suggestedCommand).toBe('START_RESET');
  });

  it('recommends SHIFT DOWN from explicit derived post-shift context',()=>{
    const result=evaluate({
      beyondDay:workDay,
      latestCheckIn:checkIn,
      recentEvents:[],
      context:{postShift:true},
      now:'2026-01-01T00:02:00Z',
    });
    expect(result.primary.kind).toBe('SHIFT_DOWN');
    expect(result.primary.suggestedCommand).toBe('START_SHIFT_DOWN');
    expect(result.derived.postShift).toBe(true);
    expect(result.trace.matchedRules.find((rule)=>rule.ruleId==='SHIFT_DOWN')?.result).toBe(true);
  });

  it('does not manufacture post-shift context from WORK alone',()=>{
    const result=evaluate({beyondDay:workDay,latestCheckIn:checkIn,recentEvents:[],context:{},now:'2026-01-01T00:02:00Z'});
    expect(result.primary.kind).toBe('NO_ACTION_REQUIRED');
    expect(result.derived.postShift).toBe(false);
  });

  it('still prioritizes RESET when post-shift capacity is RED',()=>{
    const result=evaluate({
      beyondDay:workDay,
      latestCheckIn:{...checkIn,energy:1},
      recentEvents:[],
      context:{postShift:true},
      now:'2026-01-01T00:02:00Z',
    });
    expect(result.primary.kind).toBe('STABILIZE');
    expect(result.primary.suggestedCommand).toBe('START_RESET');
  });

  it('does not recommend SHIFT DOWN after derived post-shift context is satisfied',()=>{
    const result=evaluate({beyondDay:workDay,latestCheckIn:checkIn,recentEvents:[],context:{postShift:false},now:'2026-01-01T00:02:00Z'});
    expect(result.primary.kind).toBe('NO_ACTION_REQUIRED');
    expect(result.derived.postShift).toBe(false);
  });
});
