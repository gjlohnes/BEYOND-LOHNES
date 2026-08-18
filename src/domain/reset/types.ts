import type { ISODateTime, UUID } from '../common/types';

export type ResetIntensity = 1 | 2 | 3 | 4 | 5;

export interface ResetSession {
  id: UUID;
  beyondDayId: UUID;
  intensity: ResetIntensity;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
}

export interface ShiftDownSession {
  id: UUID;
  beyondDayId: UUID;
  startedAt: ISODateTime;
  completedAt?: ISODateTime;
}
