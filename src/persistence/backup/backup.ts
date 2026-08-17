import { z } from 'zod';
import { APP_VERSION, BACKUP_FORMAT_VERSION, DATA_SCHEMA_VERSION } from '../../app/versions';
import { db } from '../db';
import {
  assertValidBeyondDay,
  assertValidEvent,
  assertValidMeta,
  assertValidOutcome,
  assertValidPerformedSet,
  assertValidRecommendation,
  assertValidWorkoutSession,
  beyondDaySchema,
  domainEventSchema,
  metaRecordSchema,
  outcomeSchema,
  performedSetSchema,
  recommendationSchema,
  workoutSessionSchema,
} from '../validation';

const backupSchema = z.object({
  format: z.literal('BEYOND_BACKUP'),
  formatVersion: z.number().int(),
  exportedAt: z.string().datetime({ offset: true }),
  appVersion: z.string().min(1),
  dataSchemaVersion: z.number().int(),
  payload: z.object({
    meta: z.array(metaRecordSchema),
    beyondDays: z.array(beyondDaySchema),
    events: z.array(domainEventSchema),
    recommendations: z.array(recommendationSchema),
    outcomes: z.array(outcomeSchema),
    workoutSessions: z.array(workoutSessionSchema).optional().default([]),
    performedSets: z.array(performedSetSchema).optional().default([]),
  }),
});

export type BackupDocument = z.infer<typeof backupSchema>;
export interface BackupPreview {
  beyondDays: number;
  events: number;
  recommendations: number;
  outcomes: number;
  workoutSessions: number;
  performedSets: number;
}

function assertUnique(values: string[]) {
  if (new Set(values).size !== values.length) throw new Error('INVALID_BACKUP_RELATIONSHIPS');
}

function assertBackupIntegrity(document: BackupDocument): BackupDocument {
  const { payload } = document;

  assertUnique(payload.meta.map((record) => record.key));
  assertUnique(payload.beyondDays.map((record) => record.id));
  assertUnique(payload.events.map((record) => record.id));
  assertUnique(payload.recommendations.map((record) => record.id));
  assertUnique(payload.outcomes.map((record) => record.id));
  assertUnique(payload.workoutSessions.map((record) => record.id));
  assertUnique(payload.performedSets.map((record) => record.id));

  const dayById = new Map(payload.beyondDays.map((day) => [day.id, day]));
  const recommendationById = new Map(
    payload.recommendations.map((recommendation) => [recommendation.id, recommendation]),
  );
  const sessionById = new Map(payload.workoutSessions.map((session) => [session.id, session]));

  if (payload.beyondDays.filter((day) => day.status === 'ACTIVE').length > 1)
    throw new Error('INVALID_BACKUP_RELATIONSHIPS');
  if (payload.workoutSessions.filter((session) => session.status === 'ACTIVE').length > 1)
    throw new Error('INVALID_BACKUP_RELATIONSHIPS');

  for (const event of payload.events) {
    if (event.beyondDayId && !dayById.has(event.beyondDayId))
      throw new Error('INVALID_BACKUP_RELATIONSHIPS');
  }

  for (const recommendation of payload.recommendations) {
    if (!dayById.has(recommendation.beyondDayId))
      throw new Error('INVALID_BACKUP_RELATIONSHIPS');
  }

  for (const outcome of payload.outcomes) {
    if (!dayById.has(outcome.beyondDayId)) throw new Error('INVALID_BACKUP_RELATIONSHIPS');
    if (outcome.recommendationId) {
      const recommendation = recommendationById.get(outcome.recommendationId);
      if (!recommendation || recommendation.beyondDayId !== outcome.beyondDayId)
        throw new Error('INVALID_BACKUP_RELATIONSHIPS');
    }
  }

  for (const session of payload.workoutSessions) {
    const day = dayById.get(session.beyondDayId);
    if (!day) throw new Error('INVALID_BACKUP_RELATIONSHIPS');
    if (session.status === 'ACTIVE' && day.status !== 'ACTIVE')
      throw new Error('INVALID_BACKUP_RELATIONSHIPS');
  }

  for (const performedSet of payload.performedSets) {
    const session = sessionById.get(performedSet.workoutSessionId);
    if (
      !session ||
      !dayById.has(performedSet.beyondDayId) ||
      session.beyondDayId !== performedSet.beyondDayId ||
      session.sessionType === 'RECOVERY'
    )
      throw new Error('INVALID_BACKUP_RELATIONSHIPS');
  }

  return document;
}

function migrateDocument(document: BackupDocument): BackupDocument {
  if (document.formatVersion !== BACKUP_FORMAT_VERSION)
    throw new Error('UNSUPPORTED_BACKUP_FORMAT_VERSION');
  if (document.dataSchemaVersion > DATA_SCHEMA_VERSION)
    throw new Error('UNSUPPORTED_FUTURE_DATA_SCHEMA_VERSION');
  if (document.dataSchemaVersion < 1) throw new Error('BACKUP_MIGRATION_NOT_AVAILABLE');
  if (document.dataSchemaVersion === DATA_SCHEMA_VERSION) return assertBackupIntegrity(document);
  if (document.dataSchemaVersion === 1) {
    const meta = document.payload.meta.filter((record) => record.key !== 'schemaVersion');
    return assertBackupIntegrity(
      backupSchema.parse({
        ...document,
        dataSchemaVersion: 2,
        payload: {
          ...document.payload,
          meta: [...meta, { key: 'schemaVersion', value: 2 }],
          workoutSessions: [],
          performedSets: [],
        },
      }),
    );
  }
  throw new Error('BACKUP_MIGRATION_NOT_AVAILABLE');
}

export async function createBackupDocument(): Promise<BackupDocument> {
  const [meta, beyondDays, events, recommendations, outcomes, workoutSessions, performedSets] =
    await Promise.all([
      db.meta.toArray(),
      db.beyondDays.toArray(),
      db.events.toArray(),
      db.recommendations.toArray(),
      db.outcomes.toArray(),
      db.workoutSessions.toArray(),
      db.performedSets.toArray(),
    ]);

  return assertBackupIntegrity(
    backupSchema.parse({
      format: 'BEYOND_BACKUP',
      formatVersion: BACKUP_FORMAT_VERSION,
      exportedAt: new Date().toISOString(),
      appVersion: APP_VERSION,
      dataSchemaVersion: DATA_SCHEMA_VERSION,
      payload: {
        meta: meta.map(assertValidMeta),
        beyondDays: beyondDays.map(assertValidBeyondDay),
        events: events.map(assertValidEvent),
        recommendations: recommendations.map(assertValidRecommendation),
        outcomes: outcomes.map(assertValidOutcome),
        workoutSessions: workoutSessions.map(assertValidWorkoutSession),
        performedSets: performedSets.map(assertValidPerformedSet),
      },
    }),
  );
}

export async function serializeCurrentBackup() {
  return JSON.stringify(await createBackupDocument(), null, 2);
}

export function parseBackup(raw: string): BackupDocument {
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw new Error('INVALID_BACKUP_JSON');
  }
  const result = backupSchema.safeParse(candidate);
  if (!result.success) throw new Error('INVALID_BACKUP_DOCUMENT');
  return migrateDocument(result.data);
}

export function previewBackup(raw: string): BackupPreview {
  const document = parseBackup(raw);
  return {
    beyondDays: document.payload.beyondDays.length,
    events: document.payload.events.length,
    recommendations: document.payload.recommendations.length,
    outcomes: document.payload.outcomes.length,
    workoutSessions: document.payload.workoutSessions.length,
    performedSets: document.payload.performedSets.length,
  };
}

export function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function downloadBackup(): Promise<BackupDocument> {
  const backup = await createBackupDocument();
  downloadText(
    `beyond-backup-${backup.exportedAt.replace(/[:.]/g, '-')}.json`,
    JSON.stringify(backup, null, 2),
  );
  await db.meta.put({ key: 'lastBackupAt', value: backup.exportedAt });
  return backup;
}

export async function downloadCurrentSafetyBackup(): Promise<string> {
  const raw = await serializeCurrentBackup();
  downloadText(
    `beyond-pre-restore-safety-${new Date().toISOString().replace(/[:.]/g, '-')}.json`,
    raw,
  );
  return raw;
}

export async function replaceRestore(
  raw: string,
  options: { confirmed: boolean; safetyExportSucceeded: boolean },
) {
  if (!options.confirmed) throw new Error('RESTORE_CONFIRMATION_REQUIRED');
  if (!options.safetyExportSucceeded) throw new Error('SAFETY_EXPORT_REQUIRED');

  const candidate = parseBackup(raw);
  const safetyBackupJson = await serializeCurrentBackup();
  const tables = [
    db.meta,
    db.beyondDays,
    db.events,
    db.recommendations,
    db.outcomes,
    db.workoutSessions,
    db.performedSets,
  ];

  await db.transaction('rw', tables, async () => {
    await Promise.all(tables.map((table) => table.clear()));
    await db.meta.bulkAdd(candidate.payload.meta.map(assertValidMeta));
    await db.beyondDays.bulkAdd(candidate.payload.beyondDays.map(assertValidBeyondDay));
    await db.events.bulkAdd(candidate.payload.events.map(assertValidEvent));
    await db.recommendations.bulkAdd(
      candidate.payload.recommendations.map(assertValidRecommendation),
    );
    await db.outcomes.bulkAdd(candidate.payload.outcomes.map(assertValidOutcome));
    await db.workoutSessions.bulkAdd(
      candidate.payload.workoutSessions.map(assertValidWorkoutSession),
    );
    await db.performedSets.bulkAdd(candidate.payload.performedSets.map(assertValidPerformedSet));
  });

  return { preview: previewBackup(raw), safetyBackupJson };
}
