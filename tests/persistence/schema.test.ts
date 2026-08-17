import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { BeyondDatabase, db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('Dexie V1 schema', () => {
  it('opens the locked V1 tables without destructive migration behavior', () => {
    expect(db.verno).toBe(1);
    expect(db.tables.map((table) => table.name).sort()).toEqual(
      ['beyondDays', 'events', 'meta', 'outcomes', 'recommendations'].sort(),
    );
  });

  it('reopens the released V1 schema without wiping existing records', async () => {
    const name = `beyond-v1-reopen-${crypto.randomUUID()}`;
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
