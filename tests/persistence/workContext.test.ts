import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { getTodayState, startDay, submitCheckIn } from '../../src/application/services/dayService';
import { completeShiftDown, startShiftDown } from '../../src/application/services/ritualService';
import { getWorkTransitionState, markWorkEnded } from '../../src/application/services/workContextService';
import { assertValidEvent } from '../../src/persistence/validation';

beforeEach(async()=>{db.close();await db.delete();await db.open();});

describe('explicit work transition context',()=>{
  it('stores work-ended once and drives a deterministic SHIFT DOWN recommendation',async()=>{
    const day=await startDay('WORK');
    const before=await submitCheckIn(day.id,{energy:3,stress:3,mood:3,soreness:1,alcoholUrge:0});
    expect(before.recommendation.kind).toBe('NO_ACTION_REQUIRED');

    const ended=await markWorkEnded(day.id);
    expect(ended.status).toBe('COMPLETED');
    const transition=await getWorkTransitionState(day.id);
    expect(transition.ended).toBe(true);
    expect(transition.postShift).toBe(true);
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

  it('requires a SHIFT DOWN completed after work actually ends',async()=>{
    const day=await startDay('WORK');
    const earlyShiftDown=await startShiftDown(day.id);
    expect(earlyShiftDown.status).toBe('COMPLETED');
    await completeShiftDown(day.id,earlyShiftDown.commandId);
    expect((await getWorkTransitionState(day.id)).postShift).toBe(false);

    await new Promise((resolve)=>setTimeout(resolve,2));
    await markWorkEnded(day.id);
    expect((await getWorkTransitionState(day.id)).postShift).toBe(true);

    await new Promise((resolve)=>setTimeout(resolve,2));
    const postShift=await startShiftDown(day.id);
    expect(postShift.status).toBe('COMPLETED');
    await completeShiftDown(day.id,postShift.commandId);
    const resolved=await getWorkTransitionState(day.id);
    expect(resolved.postShift).toBe(false);
    expect(resolved.shiftDownCompletedAt).toBeTruthy();
  });

  it('treats same-millisecond SHIFT DOWN and shift-end facts conservatively as unresolved',async()=>{
    const day=await startDay('WORK');
    const occurredAt='2026-08-17T12:00:00.000Z';
    const shiftCommandId=crypto.randomUUID();
    const workCommandId=crypto.randomUUID();
    await db.events.bulkAdd([
      assertValidEvent({
        id:crypto.randomUUID(),schemaVersion:1,type:'SHIFT_DOWN_COMPLETED',beyondDayId:day.id,
        occurredAt,recordedAt:occurredAt,payload:{commandId:shiftCommandId},source:'USER',correlationId:shiftCommandId,
      }),
      assertValidEvent({
        id:crypto.randomUUID(),schemaVersion:1,type:'WORK_PERIOD_ENDED',beyondDayId:day.id,
        occurredAt,recordedAt:occurredAt,payload:{commandId:workCommandId},source:'USER',correlationId:workCommandId,
      }),
    ]);

    const transition=await getWorkTransitionState(day.id);
    expect(transition.endedAt).toBe(occurredAt);
    expect(transition.shiftDownCompletedAt).toBe(occurredAt);
    expect(transition.postShift).toBe(true);
  });
});
