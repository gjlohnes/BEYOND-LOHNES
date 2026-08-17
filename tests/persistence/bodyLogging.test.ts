import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import {
  getBodyState,
  logProtein,
  logWater,
} from '../../src/application/services/bodyService';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('BODY event logging', () => {
  it('records water and protein as meaningful command/event history', async () => {
    const day = await startDay('OFF_DUTY');

    expect((await logWater(day.id, 40)).status).toBe('COMPLETED');
    expect((await logWater(day.id, 24.2)).status).toBe('COMPLETED');
    expect((await logProtein(day.id, 35)).status).toBe('COMPLETED');

    const state = await getBodyState();
    expect(state).toEqual({ dayId: day.id, waterOz: 64.2, proteinGrams: 35 });

    const events = await db.events.where('beyondDayId').equals(day.id).toArray();
    expect(events.filter((event) => event.type === 'WATER_LOGGED')).toHaveLength(2);
    expect(events.filter((event) => event.type === 'PROTEIN_ACTION_LOGGED')).toHaveLength(1);
  });

  it('rejects invalid quantities and preserves an explicit aborted command record', async () => {
    const day = await startDay('OFF_DUTY');
    const result = await logWater(day.id, 0);

    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('INVALID_COMMAND_INPUT');
    expect(result.emittedEvents.map((event) => event.type)).toEqual([
      'COMMAND_STARTED',
      'COMMAND_ABORTED',
    ]);
    expect((await getBodyState()).waterOz).toBe(0);
  });

  it('requires an active day', async () => {
    const result = await logProtein(crypto.randomUUID(), 30);
    expect(result.status).toBe('REJECTED');
    expect(result.errorCode).toBe('DAY_NOT_FOUND');
  });
});
