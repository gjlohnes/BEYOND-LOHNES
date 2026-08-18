import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BeyondDatabase, db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('Dexie V2 schema', () => {
  it('opens the additive V2 tables while retaining the released V1 stores', () => {
    expect(db.verno).toBe(2);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      [
        'beyondDays',
        'events',
        'meta',
        'outcomes',
        'performedSets',
        'recommendations',
        'workoutSessions',
      ].sort(),
    );
  });

  it('reopens the current schema without wiping existing records', async () => {
    const name = `beyond-v2-reopen-${crypto.randomUUID()}`;
    const first = new BeyondDatabase(name);
    await first.open();
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    await first.beyondDays.add({
      id,
      schemaVersion: 1,
      startedAt: now,
      timezoneId: 'UTC',
      workContext: 'UNKNOWN',
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    first.close();

    const reopened = new BeyondDatabase(name);
    await reopened.open();
    expect((await reopened.beyondDays.get(id))?.id).toBe(id);
    reopened.close();
    await reopened.delete();
  });
});
