import type { ISODateTime, Primitive, UUID } from '../common/types';

export type CommandName =
  | 'START_RESET'
  | 'START_SHIFT_DOWN'
  | 'REASSESS'
  | 'ENABLE_MINIMUM_DAY'
  | 'COMPLETE_MINIMUM_ITEM'
  | 'START_WORKOUT'
  | 'START_REDUCED_WORKOUT'
  | 'RECOVERY_SESSION'
  | 'LOG_WATER'
  | 'PROTEIN_ACTION'
  | 'SLEEP_PROTECTION'
  | 'SUGGEST_ACTIVITY'
  | 'START_DAY'
  | 'END_DAY'
  | 'LOG_WORKOUT_SET'
  | 'SKIP_WORKOUT_SET'
  | 'COMPLETE_WORKOUT'
  | 'ABANDON_WORKOUT';

export interface DecisionTrace {
  engineVersion: string;
  evaluatedAt: ISODateTime;
  inputs: Array<{ key: string; value: Primitive }>;
  derived: Array<{ key: string; value: Primitive }>;
  matchedRules: Array<{ ruleId: string; result: boolean; reason: string }>;
  selectedRecommendation: string;
  selectionReason: string;
}

export interface Recommendation {
  id: UUID;
  beyondDayId: UUID;
  issuedAt: ISODateTime;
  kind: string;
  priority: number;
  title: string;
  rationale: string;
  suggestedCommand?: CommandName;
  trace: DecisionTrace;
  statusAtIssue: 'ACTION' | 'NO_ACTION_REQUIRED';
}

export interface Outcome {
  id: UUID;
  recommendationId?: UUID;
  commandExecutionId?: UUID;
  beyondDayId: UUID;
  recordedAt: ISODateTime;
  result: 'COMPLETED' | 'PARTIAL' | 'ABANDONED' | 'SUPERSEDED' | 'NO_ACTION' | 'UNKNOWN';
  note?: string;
}
