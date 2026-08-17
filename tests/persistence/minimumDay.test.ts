import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import { logProtein, logWater } from '../../src/application/services/bodyService';
import {
  completeMinimumItem,
  enableMinimumDay,
  getMinimumDayState,
} from '../../src/application/services/minimumDayService';
import {
  completeRecoverySession,
  startRecoverySession,
} from '../../src/application/services/workoutService';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('MINIMUM DAY', () => {
  it('derives hydration/protein from existing events and stores only generic manual facts', async () => {
    const day = await startDay('OFF_DUTY');
    await enableMinimumDay(day.id);
    await logWater(day.id, 40);
    await logProtein(day.id, 25);
    await completeMinimumItem(day.id, 'MEDS');
    await completeMinimumItem(day.id, 'HYGIENE');

    const state = await getMinimumDayState(day.id);
    expect(state.enabled).toBe(true);
    expect(state.items.find((item) => item.key === 'HYDRATE')).toMatchObject({
      complete: true,
      source: 'AUTO',
    });
    expect(state.items.find((item) => item.key === 'PROTEIN')).toMatchObject({
      complete: true,
      source: 'AUTO',
    });
    expect(state.items.find((item) => item.key === 'MEDS')).toMatchObject({
      complete: true,
      source: 'MANUAL',
    });
    const medsEvent = await db.events.where('type').equals('MINIMUM_ITEM_COMPLETED').first();
    expect(medsEvent?.payload).toMatchObject({ key: 'MEDS' });
    expect(JSON.stringify(medsEvent?.payload)).not.toMatch(/medication|dose/i);
  });

  it('uses recovery duration as evidence without manufacturing extra checklist events', async () => {
    const day = await startDay('OFF_DUTY');
    await enableMinimumDay(day.id);
    const recovery = await startRecoverySession(day.id);
    await completeRecoverySession(recovery.id, 10);

    const state = await getMinimumDayState(day.id);
    expect(state.items.find((item) => item.key === 'MOVE')).toMatchObject({
      complete: true,
      source: 'AUTO',
    });
    expect(state.items.find((item) => item.key === 'RECOVER_CONNECT')).toMatchObject({
      complete: true,
      source: 'AUTO',
    });
    expect(await db.events.where('type').equals('MINIMUM_ITEM_COMPLETED').count()).toBe(0);
  });
});
