import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import {
  completeBodyRecovery,
  getBodyState,
  logProtein,
  logSleep,
  logWater,
  startBodyRecovery,
} from '../../src/application/services/bodyService';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('BODY event logging', () => {
  it('records water, protein, and sleep as meaningful command/event history', async () => {
    const day = await startDay('OFF_DUTY');

    expect((await logWater(day.id, 40)).status).toBe('COMPLETED');
    expect((await logWater(day.id, 24.2)).status).toBe('COMPLETED');
    expect((await logProtein(day.id, 35)).status).toBe('COMPLETED');
    expect((await logSleep(day.id, 450)).status).toBe('COMPLETED');

    const state = await getBodyState();
    expect(state).toEqual({
      dayId: day.id,
      waterOz: 64.2,
      proteinGrams: 35,
      sleepMinutes: 450,
      recoveryMinutes: 0,
      activeRecoverySessionId: null,
    });

    const events = await db.events.where('beyondDayId').equals(day.id).toArray();
    expect(events.filter((event) => event.type === 'WATER_LOGGED')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'PROTEIN_ACTION_LOGGED')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'SLEEP_LOGGED')).toHaveLength(1);
  });

  it('preserves repeated sleep facts without erasing history', async () => {
    const day = await startDay('OFF_DUTY');

    expect((await logSleep(day.id, 420)).status).toBe('COMPLETED');
    expect((await logSleep(day.id, 465)).status).toBe('COMPLETED');

    const sleepDurations = (await db.events.where('beyondDayId').equals(day.id).toArray())
      .filter((event) => event.type === 'SLEEP_LOGGED')
      .map((event) => (event.payload as { durationMinutes: number }).durationMinutes)
      .sort((a, b) => a - b);

    expect(sleepDurations).toEqual([420, 465]);
  });

  it('records recovery through the existing recovery-session domain contract', async () => {
    const day = await startDay('OFF_DUTY');
    const session = await startBodyRecovery(day.id);

    expect((await getBodyState()).activeRecoverySessionId).toBe(session.id);

    const closed = await completeBodyRecovery(session.id, 12);
    expect(closed.status).toBe('COMPLETED');

    const state = await getBodyState();
    expect(state.recoveryMinutes).toBe(12);
    expect(state.activeRecoverySessionId).toBeNull();

    const persisted = await db.workoutSessions.get(session.id);
    expect(persisted?.sessionType).toBe('RECOVERY');
    expect(persisted?.durationMinutes).toBe(12);
  });

  it('rejects invalid quantities and preserves an explicit aborted command record', async () => {
    const day = await startDay('OFF_DUTY');
    const result = await logSleep(day.id, 0);

    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('INVALID_COMMAND_INPUT');
    expect(result.emittedEvents.map((event) => event.type)).toEqual([
      'COMMAND_STARTED',
      'COMMAND_ABORTED',
    ]);
    expect((await getBodyState()).sleepMinutes).toBeNull();
  });

  it('requires an active day', async () => {
    const result = await logProtein(crypto.randomUUID(), 30);
    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('DAY_NOT_FOUND');
  });
});
