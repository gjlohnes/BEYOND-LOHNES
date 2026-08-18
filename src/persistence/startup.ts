import type Dexie from 'dexie';
import { db } from './db';

export type DatabaseStartupState =
  | { status: 'READY' }
  | { status: 'DATABASE_OPEN_FAILED'; errorName: string };

export async function checkDatabaseStartup(database: Pick<Dexie, 'open'> = db): Promise<DatabaseStartupState> {
  try {
    await database.open();
    return { status: 'READY' };
  } catch (error) {
    return {
      status: 'DATABASE_OPEN_FAILED',
      errorName: error instanceof Error ? error.name : 'UnknownError',
    };
  }
}
