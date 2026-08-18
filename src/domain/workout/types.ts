import type { ISODateTime, UUID } from '../common/types';

export type WorkoutTemplateId = 'A' | 'B' | 'C';
export type WorkoutSessionType = 'STANDARD' | 'REDUCED' | 'RECOVERY';
export type WorkoutSessionStatus = 'ACTIVE' | 'COMPLETED' | 'PARTIAL' | 'ABANDONED';
export type PerformedSetState = 'COMPLETED' | 'SKIPPED';
export type ProgressionAction =
  | 'NO_HISTORY'
  | 'INCREASE_NEXT_AVAILABLE'
  | 'HOLD'
  | 'REDUCE_NEXT_AVAILABLE';

export interface WorkoutExerciseTemplate {
  id: string;
  name: string;
  setCount: number;
  repMin: number;
  repMax: number;
  required: boolean;
}

export interface WorkoutTemplate {
  id: WorkoutTemplateId;
  emphasis: string;
  exercises: readonly WorkoutExerciseTemplate[];
}

export interface WorkoutSession {
  id: UUID;
  schemaVersion: number;
  beyondDayId: UUID;
  templateId?: WorkoutTemplateId;
  sessionType: WorkoutSessionType;
  status: WorkoutSessionStatus;
  startedAt: ISODateTime;
  endedAt?: ISODateTime;
  durationMinutes?: number;
}

export interface PerformedSet {
  id: UUID;
  schemaVersion: number;
  beyondDayId: UUID;
  workoutSessionId: UUID;
  exerciseId: string;
  setOrdinal: number;
  state: PerformedSetState;
  weight?: number;
  reps?: number;
  recordedAt: ISODateTime;
}

export interface ProgressionSuggestion {
  action: ProgressionAction;
  reason: string;
  evidence: PerformedSet[];
}
