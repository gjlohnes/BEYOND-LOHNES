import { describe, expect, it } from 'vitest';
import { checkDatabaseStartup } from '../../src/persistence/startup';

describe('database startup safety', () => {
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
});
