import Dexie, { type EntityTable } from 'dexie';
import type { BeyondDay } from '../domain/day/types';
import type { DomainEvent } from '../domain/common/events';
import type { Outcome, Recommendation } from '../domain/recommendation/types';

export interface MetaRecord { key: string; value: unknown; }
export class BeyondDatabase extends Dexie {
  meta!: EntityTable<MetaRecord,'key'>;
  beyondDays!: EntityTable<BeyondDay,'id'>;
  events!: EntityTable<DomainEvent,'id'>;
  recommendations!: EntityTable<Recommendation,'id'>;
  outcomes!: EntityTable<Outcome,'id'>;

  constructor() {
    super('beyond-v01');
    this.version(1).stores({
      meta:'&key',
      beyondDays:'&id,status,startedAt,endedAt',
      events:'&id,beyondDayId,occurredAt,type,[beyondDayId+occurredAt]',
      recommendations:'&id,beyondDayId,issuedAt,statusAtIssue,[beyondDayId+issuedAt]',
      outcomes:'&id,beyondDayId,recommendationId,recordedAt'
    });
  }
}
export const db = new BeyondDatabase();
