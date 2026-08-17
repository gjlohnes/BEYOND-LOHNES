import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import {
  completeRecoverySession,
  completeWorkout,
  getNextWorkoutTemplateId,
  logWorkoutSet,
  startRecoverySession,
  startReducedWorkout,
} from '../../src/application/services/workoutService';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('TRAIN reduced and recovery paths', () => {
  it('uses only the first two exercises with two sets each and advances rotation', async () => {
    const day = await startDay('OFF_DUTY');
    const session = await startReducedWorkout(day.id);
    expect(session.sessionType).toBe('REDUCED');
    expect(session.templateId).toBe('A');

    for (const exerciseId of ['chest_press', 'pec_deck']) {
      await logWorkoutSet(session.id, exerciseId, 1, 50, 10);
      await logWorkoutSet(session.id, exerciseId, 2, 50, 10);
    }
    await expect(logWorkoutSet(session.id, 'leg_press', 1, 50, 10)).rejects.toThrow(
      'EXERCISE_NOT_IN_WORKOUT',
    );

    const closed = await completeWorkout(session.id);
    expect(closed.status).toBe('COMPLETED');
    expect(await getNextWorkoutTemplateId()).toBe('B');
  });

  it('records recovery duration without advancing the strength rotation', async () => {
    const day = await startDay('OFF_DUTY');
    const first = await startRecoverySession(day.id);
    expect(first.sessionType).toBe('RECOVERY');
    const partial = await completeRecoverySession(first.id, 7);
    expect(partial.status).toBe('PARTIAL');
    expect(partial.durationMinutes).toBe(7);
    expect(await getNextWorkoutTemplateId()).toBe('A');

    const second = await startRecoverySession(day.id);
    const completed = await completeRecoverySession(second.id, 10);
    expect(completed.status).toBe('COMPLETED');
    expect(completed.durationMinutes).toBe(10);
    expect(await getNextWorkoutTemplateId()).toBe('A');
  });
});
