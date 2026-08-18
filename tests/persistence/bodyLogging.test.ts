import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import {
  completeBodyRecovery,
  correctWaterLog,
  getBodyState,
  logProtein,
  logSleep,
  logWater,
  startBodyRecovery,
} from '../../src/application/services/bodyService';
import { getMinimumDayState } from '../../src/application/services/minimumDayService';
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
    expect(state.dayId).toBe(day.id);
    expect(state.waterOz).toBe(64.2);
    expect(state.waterEntries.map((entry) => entry.amountOz)).toEqual([40, 24.2]);
    expect(state.proteinGrams).toBe(35);
    expect(state.sleepMinutes).toBe(450);
    expect(state.recoveryMinutes).toBe(0);
    expect(state.activeRecoverySessionId).toBeNull();

    const events = await db.events.where('beyondDayId').equals(day.id).toArray();
    expect(events.filter((event) => event.type === 'WATER_LOGGED')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'PROTEIN_ACTION_LOGGED')).toHaveLength(1);
    expect(events.filter((event) => event.type === 'SLEEP_LOGGED')).toHaveLength(1);
  });

  it('corrects a water entry without erasing original history', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 160);
    await logWater(day.id, 24);
    const before = await getBodyState();
    const mistaken = before.waterEntries[0];

    const result = await correctWaterLog(
      day.id,
      mistaken.originalEventId,
      mistaken.currentEventId,
      16,
    );
    expect(result.status).toBe('COMPLETED');

    const state = await getBodyState();
    expect(state.waterOz).toBe(40);
    expect(state.waterEntries[0]).toMatchObject({
      originalEventId: mistaken.originalEventId,
      amountOz: 16,
      correctionCount: 1,
    });

    const events = await db.events.where('beyondDayId').equals(day.id).toArray();
    const original = events.find((event) => event.id === mistaken.originalEventId);
    const correction = events.find((event) => event.type === 'WATER_LOG_CORRECTED');
    expect(original?.type).toBe('WATER_LOGGED');
    expect(original?.payload).toMatchObject({ amountOz: 160 });
    expect(correction?.payload).toMatchObject({
      originalEventId: mistaken.originalEventId,
      supersedesEventId: mistaken.currentEventId,
      amountOz: 16,
    });
  });

  it('supports deterministic repeated corrections and keeps MINIMUM DAY on effective truth', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 50);
    let entry = (await getBodyState()).waterEntries[0];
    expect((await correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 30)).status).toBe(
      'COMPLETED',
    );
    entry = (await getBodyState()).waterEntries[0];
    expect((await correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 45)).status).toBe(
      'COMPLETED',
    );

    const state = await getBodyState();
    expect(state.waterOz).toBe(45);
    expect(state.waterEntries[0].correctionCount).toBe(2);
    expect((await getMinimumDayState(day.id)).items.find((item) => item.key === 'HYDRATE')).toMatchObject({
      complete: true,
      source: 'AUTO',
    });
  });

  it('prevents two corrections from superseding the same current fact', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 80);
    const entry = (await getBodyState()).waterEntries[0];

    const results = await Promise.all([
      correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 16),
      correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 20),
    ]);

    expect(results.filter((result) => result.status === 'COMPLETED')).toHaveLength(1);
    expect(results.filter((result) => result.errorCode === 'STALE_CORRECTION_TARGET')).toHaveLength(1);
    expect((await getBodyState()).waterEntries[0].correctionCount).toBe(1);
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

  it('rejects an invalid correction amount without changing effective truth', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 20);
    const entry = (await getBodyState()).waterEntries[0];
    const result = await correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 0);
    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('INVALID_COMMAND_INPUT');
    expect((await getBodyState()).waterOz).toBe(20);
  });

  it('requires an active day', async () => {
    const result = await logProtein(crypto.randomUUID(), 30);
    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('DAY_NOT_FOUND');
  });
});
