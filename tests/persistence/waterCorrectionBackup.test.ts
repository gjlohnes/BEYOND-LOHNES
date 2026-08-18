import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { startDay } from '../../src/application/services/dayService';
import {
  correctWaterLog,
  getBodyState,
  logWater,
} from '../../src/application/services/bodyService';
import {
  createBackupDocument,
  parseBackup,
  replaceRestore,
  serializeCurrentBackup,
} from '../../src/persistence/backup/backup';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('V0.2 water correction backup compatibility', () => {
  it('exports and replace-restores correction history with the same effective truth', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 160);
    await logWater(day.id, 24);
    const entry = (await getBodyState()).waterEntries[0];
    expect((await correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 16)).status).toBe(
      'COMPLETED',
    );

    const raw = await serializeCurrentBackup();
    const exported = parseBackup(raw);
    expect(exported.dataSchemaVersion).toBe(3);
    expect(exported.payload.events.some((event) => event.type === 'WATER_LOG_CORRECTED')).toBe(true);

    await db.transaction('rw', db.beyondDays, db.events, async () => {
      await db.beyondDays.clear();
      await db.events.clear();
    });
    await replaceRestore(raw, { confirmed: true, safetyExportSucceeded: true });

    const restored = await getBodyState();
    expect(restored.waterOz).toBe(40);
    expect(restored.waterEntries[0]).toMatchObject({ amountOz: 16, correctionCount: 1 });
  });

  it('migrates a V0.1 data-schema-v2 backup to schema v3 without inventing corrections', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 20);
    const current = await createBackupDocument();
    const legacy = {
      ...current,
      appVersion: '0.1.0',
      dataSchemaVersion: 2,
      payload: {
        ...current.payload,
        meta: current.payload.meta.map((record) =>
          record.key === 'schemaVersion' ? { ...record, value: 2 } : record,
        ),
      },
    };

    const migrated = parseBackup(JSON.stringify(legacy));
    expect(migrated.dataSchemaVersion).toBe(3);
    expect(migrated.payload.meta.find((record) => record.key === 'schemaVersion')?.value).toBe(3);
    expect(migrated.payload.events.some((event) => event.type === 'WATER_LOG_CORRECTED')).toBe(false);
  });

  it('rejects a correction chain that does not supersede the current effective fact', async () => {
    const day = await startDay('OFF_DUTY');
    await logWater(day.id, 80);
    const entry = (await getBodyState()).waterEntries[0];
    await correctWaterLog(day.id, entry.originalEventId, entry.currentEventId, 16);
    const document = await createBackupDocument();
    const corrupt = {
      ...document,
      payload: {
        ...document.payload,
        events: document.payload.events.map((event) =>
          event.type === 'WATER_LOG_CORRECTED'
            ? {
                ...event,
                payload: {
                  ...(event.payload as Record<string, unknown>),
                  supersedesEventId: crypto.randomUUID(),
                },
              }
            : event,
        ),
      },
    };

    expect(() => parseBackup(JSON.stringify(corrupt))).toThrow('INVALID_BACKUP_RELATIONSHIPS');
  });
});
