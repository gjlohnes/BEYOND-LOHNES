import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { checkDatabaseStartup } from '../../src/persistence/startup';

describe('database startup safety', () => {
  beforeEach(async () => {
    db.close();
    await db.delete();
  });

  it('reports open/migration failure without invoking destructive recovery', async () => {
    let openCalls = 0;
    const database = {
      open: async () => {
        openCalls += 1;
        throw new Error('migration failed');
      },
    };
    const state = await checkDatabaseStartup(database as never);
    expect(state.status).toBe('DATABASE_OPEN_FAILED');
    expect(openCalls).toBe(1);
  });

  it('upgrades V0.1 application schema metadata without changing the Dexie storage version', async () => {
    await db.open();
    await db.meta.put({ key: 'schemaVersion', value: 2 });
    db.close();

    expect((await checkDatabaseStartup()).status).toBe('READY');
    expect((await db.meta.get('schemaVersion'))?.value).toBe(3);
    expect(db.verno).toBe(2);
  });
});
