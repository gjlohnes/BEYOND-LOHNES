import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';
import { BeyondDatabase } from '../../src/persistence/db';
import { registerV1 } from '../../src/persistence/migrations';
import { V1_DATABASE_FIXTURE } from '../fixtures/v1DatabaseFixture';

describe('V1 to V2 TRAIN migration',()=>{
  it('preserves V1 history and adds empty workout stores',async()=>{
    const name=`beyond-v1-fixture-${crypto.randomUUID()}`;const legacy=new Dexie(name);registerV1(legacy);await legacy.open();
    await legacy.table('meta').bulkAdd(V1_DATABASE_FIXTURE.meta);await legacy.table('beyondDays').add(V1_DATABASE_FIXTURE.beyondDay);await legacy.table('events').add(V1_DATABASE_FIXTURE.event);legacy.close();
    const upgraded=new BeyondDatabase(name);await upgraded.open();
    expect((await upgraded.beyondDays.get(V1_DATABASE_FIXTURE.beyondDay.id))?.id).toBe(V1_DATABASE_FIXTURE.beyondDay.id);expect((await upgraded.events.get(V1_DATABASE_FIXTURE.event.id))?.type).toBe('DAY_STARTED');expect((await upgraded.meta.get('schemaVersion'))?.value).toBe(2);expect(await upgraded.workoutSessions.count()).toBe(0);expect(await upgraded.performedSets.count()).toBe(0);
    upgraded.close();await upgraded.delete();
  });
});
