import type Dexie from 'dexie';

export const V1_STORES = {
  meta: '&key',
  beyondDays: '&id,status,startedAt,endedAt',
  events: '&id,beyondDayId,occurredAt,type,[beyondDayId+occurredAt]',
  recommendations: '&id,beyondDayId,issuedAt,statusAtIssue,[beyondDayId+issuedAt]',
  outcomes: '&id,beyondDayId,recommendationId,recordedAt',
} as const;

export const V2_STORES = {
  ...V1_STORES,
  workoutSessions: '&id,beyondDayId,startedAt,status,templateId,sessionType,[beyondDayId+startedAt]',
  performedSets: '&id,workoutSessionId,beyondDayId,exerciseId,recordedAt,[workoutSessionId+exerciseId],[exerciseId+recordedAt]',
} as const;

export function registerV1(database: Dexie) {
  return database.version(1).stores(V1_STORES);
}

export function registerV2(database: Dexie) {
  return database
    .version(2)
    .stores(V2_STORES)
    .upgrade(async (transaction) => {
      await transaction.table('meta').put({ key: 'schemaVersion', value: 2 });
    });
}

// Released versions are append-only. Never edit an existing upgrader in place.
