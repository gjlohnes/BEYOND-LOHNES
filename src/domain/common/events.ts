import type { ISODateTime, UUID } from './types';

export type EventType =
  | 'DAY_STARTED'
  | 'DAY_ENDED'
  | 'WORK_PERIOD_ENDED'
  | 'STATE_CHECKED_IN'
  | 'RECOMMENDATION_ISSUED'
  | 'RECOMMENDATION_ACCEPTED'
  | 'RECOMMENDATION_DISMISSED'
  | 'RECOMMENDATION_OVERRIDDEN'
  | 'COMMAND_STARTED'
  | 'COMMAND_COMPLETED'
  | 'COMMAND_ABORTED'
  | 'RESET_STARTED'
  | 'RESET_COMPLETED'
  | 'SHIFT_DOWN_STARTED'
  | 'SHIFT_DOWN_COMPLETED'
  | 'MINIMUM_DAY_ENABLED'
  | 'MINIMUM_ITEM_COMPLETED'
  | 'WATER_LOGGED'
  | 'WATER_LOG_CORRECTED'
  | 'PROTEIN_ACTION_LOGGED'
  | 'SLEEP_LOGGED'
  | 'WORKOUT_STARTED'
  | 'WORKOUT_SET_RECORDED'
  | 'WORKOUT_SET_SKIPPED'
  | 'WORKOUT_COMPLETED'
  | 'WORKOUT_ABANDONED'
  | 'NO_ACTION_RECORDED';

export interface DomainEvent<T = unknown> {
  id: UUID;
  schemaVersion: number;
  type: EventType;
  beyondDayId?: UUID;
  occurredAt: ISODateTime;
  recordedAt: ISODateTime;
  payload: T;
  source: 'USER' | 'ENGINE' | 'SYSTEM';
  correlationId?: UUID;
  causationId?: UUID;
}
