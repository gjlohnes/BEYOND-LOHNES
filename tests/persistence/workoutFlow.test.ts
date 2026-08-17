import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { startDay } from '../../src/application/services/dayService';
import {
  completeWorkout,
  getNextWorkoutTemplateId,
  logWorkoutSet,
  skipWorkoutSet,
  startWorkout,
} from '../../src/application/services/workoutService';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('TRAIN performed-set truth', () => {
  it('starts A, records performed/skipped sets, closes partial, and advances to B', async () => {
    const day = await startDay('OFF_DUTY');
    const session = await startWorkout(day.id);
    expect(session.templateId).toBe('A');

    const first = await logWorkoutSet(session.id, 'chest_press', 1, 100, 10);
    expect(first.state).toBe('COMPLETED');
    const skipped = await skipWorkoutSet(session.id, 'chest_press', 2);
    expect(skipped.state).toBe('SKIPPED');

    const closed = await completeWorkout(session.id);
    expect(closed.status).toBe('PARTIAL');
    expect(await getNextWorkoutTemplateId()).toBe('B');
    expect(await db.events.where('type').equals('WORKOUT_SET_RECORDED').count()).toBe(1);
    expect(
      await db.outcomes.filter((outcome) => outcome.commandExecutionId !== undefined).count(),
    ).toBeGreaterThan(0);
  });

  it('serializes concurrent START WORKOUT requests into one active session', async () => {
    const day = await startDay('OFF_DUTY');
    const [first, second] = await Promise.all([startWorkout(day.id), startWorkout(day.id)]);
    expect(second.id).toBe(first.id);
    expect(await db.workoutSessions.where('status').equals('ACTIVE').count()).toBe(1);
  });
});
