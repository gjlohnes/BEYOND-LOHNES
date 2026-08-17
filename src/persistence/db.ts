import Dexie, { type EntityTable } from 'dexie';
import type { BeyondDay } from '../domain/day/types';
import type { DomainEvent } from '../domain/common/events';
import type { Outcome, Recommendation } from '../domain/recommendation/types';
import { APP_VERSION, BACKUP_FORMAT_VERSION, DATA_SCHEMA_VERSION, DATABASE_NAME } from '../app/versions';
import { registerV1 } from './migrations';

export interface MetaRecord { key: string; value: unknown; }

export class BeyondDatabase extends Dexie {
  meta!: EntityTable<MetaRecord, 'key'>;
  beyondDays!: EntityTable<BeyondDay, 'id'>;
  events!: EntityTable<DomainEvent, 'id'>;
  recommendations!: EntityTable<Recommendation, 'id'>;
  outcomes!: EntityTable<Outcome, 'id'>;

  constructor(name = DATABASE_NAME) {
    super(name);
    registerV1(this);
    this.on('populate', async () => {
      const now = new Date().toISOString();
      await this.meta.bulkPut([
        { key: 'schemaVersion', value: DATA_SCHEMA_VERSION },
        { key: 'appDataFormatVersion', value: BACKUP_FORMAT_VERSION },
        { key: 'createdAt', value: now },
        { key: 'createdByAppVersion', value: APP_VERSION },
      ]);
    });
  }
}

export const db = new BeyondDatabase();
