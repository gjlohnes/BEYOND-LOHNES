import type Dexie from 'dexie';
import { DATA_SCHEMA_VERSION } from '../app/versions';
import { db } from './db';

export type DatabaseStartupState =
  | { status: 'READY' }
  | { status: 'DATABASE_OPEN_FAILED'; errorName: string };

export async function checkDatabaseStartup(database: Pick<Dexie, 'open'> = db): Promise<DatabaseStartupState> {
  try {
    await database.open();
    if (database === db) {
      await db.meta.put({ key: 'schemaVersion', value: DATA_SCHEMA_VERSION });
    }
    return { status: 'READY' };
  } catch (error) {
    return {
      status: 'DATABASE_OPEN_FAILED',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}
