import type Dexie from 'dexie';
import { DEXIE_DB_VERSION } from '../app/versions';

export const V1_STORES = {
  meta: '&key',
  beyondDays: '&id,status,startedAt,endedAt',
  events: '&id,beyondDayId,occurredAt,type,[beyondDayId+occurredAt]',
  recommendations: '&id,beyondDayId,issuedAt,statusAtIssue,[beyondDayId+issuedAt]',
  outcomes: '&id,beyondDayId,recommendationId,recordedAt',
} as const;

export function registerV1(database: Dexie) {
  return database.version(DEXIE_DB_VERSION).stores(V1_STORES);
}

// Future released versions are appended here. Never edit a released upgrader in place.
// The first real V2 must add a named V1 fixture and a tested upgrade function.
