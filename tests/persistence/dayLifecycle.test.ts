import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { endDay, getTodayState, startDay } from '../../src/application/services/dayService';
import { completeReset, startReset } from '../../src/application/services/ritualService';
import { completeWorkout, startWorkout } from '../../src/application/services/workoutService';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('BeyondDay wake-to-sleep lifecycle', () => {
  it('ends once and allows a later new day', async () => {
    const first = await startDay('WORK');
    const ended = await endDay(first.id);
    expect(ended.status).toBe('COMPLETED');
    expect(ended.endedAt).toBeTruthy();
    expect((await getTodayState()).day).toBeNull();
    const count = await db.events.where('type').equals('DAY_ENDED').count();
    await endDay(first.id);
    expect(await db.events.where('type').equals('DAY_ENDED').count()).toBe(count);
    const second = await startDay('OFF_DUTY');
    expect(second.id).not.toBe(first.id);
  });

  it('refuses to strand an active RESET when ending the day', async () => {
    const day = await startDay('OFF_DUTY');
    const reset = await startReset(day.id, 3);

    await expect(endDay(day.id)).rejects.toThrow('ACTIVE_FLOW_EXISTS');
    expect((await getTodayState()).day?.id).toBe(day.id);

    await completeReset(day.id, reset.commandId);
    expect((await endDay(day.id)).status).toBe('COMPLETED');
  });

  it('refuses to strand an active TRAIN session when ending the day', async () => {
    const day = await startDay('OFF_DUTY');
    const workout = await startWorkout(day.id);

    await expect(endDay(day.id)).rejects.toThrow('ACTIVE_FLOW_EXISTS');
    expect((await db.workoutSessions.get(workout.id))?.status).toBe('ACTIVE');

    await completeWorkout(workout.id);
    expect((await endDay(day.id)).status).toBe('COMPLETED');
  });
});
