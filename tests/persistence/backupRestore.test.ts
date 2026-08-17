import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import {
  createBackupDocument,
  parseBackup,
  previewBackup,
  replaceRestore,
  serializeCurrentBackup,
} from '../../src/persistence/backup/backup';
import { startDay, submitCheckIn } from '../../src/application/services/dayService';
import { logSleep } from '../../src/application/services/bodyService';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('application-owned backup and restore', () => {
  it('exports validated records and previews without mutation', async () => {
    const day = await startDay('OFF_DUTY');
    await submitCheckIn(day.id, { energy: 4, stress: 1, mood: 4, soreness: 0, alcoholUrge: 0 });
    const before = await db.events.count();
    const raw = await serializeCurrentBackup();
    expect(previewBackup(raw).beyondDays).toBe(1);
    expect(await db.events.count()).toBe(before);
    expect(parseBackup(raw).format).toBe('BEYOND_BACKUP');
  });

  it('preserves sleep history through application-owned backup and replace restore', async () => {
    const day = await startDay('OFF_DUTY');
    expect((await logSleep(day.id, 450)).status).toBe('COMPLETED');
    const raw = await serializeCurrentBackup();

    await db.transaction('rw', db.beyondDays, db.events, async () => {
      await db.beyondDays.clear();
      await db.events.clear();
    });
    await replaceRestore(raw, { confirmed: true, safetyExportSucceeded: true });

    const sleep = (await db.events.where('beyondDayId').equals(day.id).toArray()).find(
      (event) => event.type === 'SLEEP_LOGGED',
    );
    expect(sleep?.payload).toMatchObject({ durationMinutes: 450 });
  });

  it('rejects malformed and unsupported backups', async () => {
    expect(() => parseBackup('{bad')).toThrow('INVALID_BACKUP_JSON');
    const document = await createBackupDocument();
    expect(() => parseBackup(JSON.stringify({ ...document, format: 'WRONG' }))).toThrow(
      'INVALID_BACKUP_DOCUMENT',
    );
    expect(() => parseBackup(JSON.stringify({ ...document, formatVersion: 99 }))).toThrow(
      'UNSUPPORTED_BACKUP_FORMAT_VERSION',
    );
    expect(() => parseBackup(JSON.stringify({ ...document, dataSchemaVersion: 99 }))).toThrow(
      'UNSUPPORTED_FUTURE_DATA_SCHEMA_VERSION',
    );
  });

  it('replace-restores transactionally and preserves relationships', async () => {
    const day = await startDay('WORK');
    const result = await submitCheckIn(day.id, {
      energy: 5,
      stress: 1,
      mood: 5,
      soreness: 0,
      alcoholUrge: 0,
    });
    const raw = await serializeCurrentBackup();
    await db.transaction('rw', db.beyondDays, db.events, db.recommendations, async () => {
      await db.beyondDays.clear();
      await db.events.clear();
      await db.recommendations.clear();
    });
    await replaceRestore(raw, { confirmed: true, safetyExportSucceeded: true });
    expect((await db.beyondDays.get(day.id))?.id).toBe(day.id);
    expect((await db.recommendations.get(result.recommendation.id))?.beyondDayId).toBe(day.id);
  });

  it('rolls back the destructive transaction if restoration fails', async () => {
    const day = await startDay('WORK');
    const document = await createBackupDocument();
    const duplicate = {
      ...document,
      payload: {
        ...document.payload,
        beyondDays: [document.payload.beyondDays[0], document.payload.beyondDays[0]],
      },
    };
    await expect(
      replaceRestore(JSON.stringify(duplicate), { confirmed: true, safetyExportSucceeded: true }),
    ).rejects.toBeTruthy();
    expect((await db.beyondDays.get(day.id))?.id).toBe(day.id);
    expect(await db.beyondDays.count()).toBe(1);
  });

  it('requires confirmation and successful safety export', async () => {
    const raw = await serializeCurrentBackup();
    await expect(
      replaceRestore(raw, { confirmed: false, safetyExportSucceeded: true }),
    ).rejects.toThrow('RESTORE_CONFIRMATION_REQUIRED');
    await expect(
      replaceRestore(raw, { confirmed: true, safetyExportSucceeded: false }),
    ).rejects.toThrow('SAFETY_EXPORT_REQUIRED');
  });
});
