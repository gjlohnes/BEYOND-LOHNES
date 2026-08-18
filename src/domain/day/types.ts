import type { ISODateTime, UUID, WorkContext } from '../common/types';
export interface BeyondDay { id: UUID; schemaVersion: number; startedAt: ISODateTime; endedAt?: ISODateTime; timezoneId: string; workContext: WorkContext; status: 'ACTIVE'|'COMPLETED'; createdAt: ISODateTime; updatedAt: ISODateTime; }
