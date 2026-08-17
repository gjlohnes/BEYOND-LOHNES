import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { getTodayState, startDay, submitCheckIn } from '../../src/application/services/dayService';
import { getWorkTransitionState, markWorkEnded } from '../../src/application/services/workContextService';

beforeEach(async()=>{db.close();await db.delete();await db.open();});

describe('explicit work transition context',()=>{
  it('stores work-ended once and drives a deterministic SHIFT DOWN recommendation',async()=>{
    const day=await startDay('WORK');
    const before=await submitCheckIn(day.id,{energy:3,stress:3,mood:3,soreness:1,alcoholUrge:0});
    expect(before.recommendation.kind).toBe('NO_ACTION_REQUIRED');

    const ended=await markWorkEnded(day.id);
    expect(ended.status).toBe('COMPLETED');
    expect((await getWorkTransitionState(day.id)).ended).toBe(true);
    expect((await getTodayState()).recommendation).toBeNull();

    const after=await submitCheckIn(day.id,{energy:3,stress:3,mood:3,soreness:1,alcoholUrge:0});
    expect(after.recommendation.kind).toBe('SHIFT_DOWN');
    expect(after.recommendation.suggestedCommand).toBe('START_SHIFT_DOWN');
  });

  it('rejects work-ended on a non-work day without fabricating context',async()=>{
    const day=await startDay('OFF_DUTY');
    const result=await markWorkEnded(day.id);
    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('WORK_CONTEXT_REQUIRED');
    expect((await getWorkTransitionState(day.id)).ended).toBe(false);
  });

  it('rejects a duplicate work-ended fact',async()=>{
    const day=await startDay('WORK');
    expect((await markWorkEnded(day.id)).status).toBe('COMPLETED');
    const duplicate=await markWorkEnded(day.id);
    expect(duplicate.status).toBe('REJECTED');
    expect(duplicate.errorCode).toBe('WORK_ALREADY_ENDED');
    expect(await db.events.where('type').equals('WORK_PERIOD_ENDED').count()).toBe(1);
  });
});
