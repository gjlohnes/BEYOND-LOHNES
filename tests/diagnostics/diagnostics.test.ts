import 'fake-indexeddb/auto';
import { beforeEach, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { getDiagnosticsSummary } from '../../src/diagnostics/diagnostics';
import { startDay } from '../../src/application/services/dayService';

beforeEach(async()=>{db.close();await db.delete();await db.open();});
it('reports safe local version and count state',async()=>{await startDay('UNKNOWN');const summary=await getDiagnosticsSummary();expect(summary.dataSchemaVersion).toBe(1);expect(summary.dexieDatabaseVersion).toBe(1);expect(summary.activeBeyondDay).toBe(true);expect(summary.counts.beyondDays).toBe(1);});
