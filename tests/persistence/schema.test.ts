import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';

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
});
