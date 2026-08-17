import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { endDay, getTodayState, startDay } from '../../src/application/services/dayService';

beforeEach(async()=>{db.close();await db.delete();await db.open();});

describe('BeyondDay wake-to-sleep lifecycle',()=>{
  it('ends once and allows a later new day',async()=>{const first=await startDay('WORK');const ended=await endDay(first.id);expect(ended.status).toBe('COMPLETED');expect(ended.endedAt).toBeTruthy();expect((await getTodayState()).day).toBeNull();const count=await db.events.where('type').equals('DAY_ENDED').count();await endDay(first.id);expect(await db.events.where('type').equals('DAY_ENDED').count()).toBe(count);const second=await startDay('OFF_DUTY');expect(second.id).not.toBe(first.id);});
});
