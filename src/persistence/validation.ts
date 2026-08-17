import { z } from 'zod';
import type { BeyondDay } from '../domain/day/types';
import type { DomainEvent, EventType } from '../domain/common/events';
import type { Outcome, Recommendation } from '../domain/recommendation/types';
import type { StateCheckIn } from '../domain/checkin/types';
import type { PerformedSet, WorkoutSession } from '../domain/workout/types';
import type { MetaRecord } from './db';

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });
const primitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
const minimumItemKey = z.enum([
  'HYDRATE',
  'PROTEIN',
  'MEDS',
  'HYGIENE',
  'MOVE',
  'RECOVER_CONNECT',
]);

export const beyondDaySchema = z
  .object({
    id: uuid,
    schemaVersion: z.number().int().positive(),
    startedAt: isoDateTime,
    endedAt: isoDateTime.optional(),
    timezoneId: z.string().min(1),
    workContext: z.enum(['WORK', 'OFF_DUTY', 'UNKNOWN']),
    status: z.enum(['ACTIVE', 'COMPLETED']),
    createdAt: isoDateTime,
    updatedAt: isoDateTime,
  })
  .superRefine((day, ctx) => {
    if (day.status === 'COMPLETED' && !day.endedAt)
      ctx.addIssue({ code: 'custom', message: 'Completed day requires endedAt' });
    if (day.status === 'ACTIVE' && day.endedAt)
      ctx.addIssue({ code: 'custom', message: 'Active day cannot have endedAt' });
  });

export const stateCheckInPayloadSchema = z.object({
  id: uuid,
  beyondDayId: uuid,
  recordedAt: isoDateTime,
  energy: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  soreness: z.number().int().min(0).max(5),
  alcoholUrge: z.number().int().min(0).max(5),
});
export const stateCheckInInputSchema = stateCheckInPayloadSchema.omit({
  id: true,
  beyondDayId: true,
  recordedAt: true,
});
export const decisionTraceSchema = z.object({
  engineVersion: z.string().min(1),
  evaluatedAt: isoDateTime,
  inputs: z.array(z.object({ key: z.string().min(1), value: primitive })),
  derived: z.array(z.object({ key: z.string().min(1), value: primitive })),
  matchedRules: z.array(
    z.object({ ruleId: z.string().min(1), result: z.boolean(), reason: z.string() }),
  ),
  selectedRecommendation: z.string().min(1),
  selectionReason: z.string().min(1),
});

const commandNames = [
  'START_RESET',
  'START_SHIFT_DOWN',
  'REASSESS',
  'ENABLE_MINIMUM_DAY',
  'COMPLETE_MINIMUM_ITEM',
  'START_WORKOUT',
  'START_REDUCED_WORKOUT',
  'RECOVERY_SESSION',
  'LOG_WATER',
  'PROTEIN_ACTION',
  'LOG_SLEEP',
  'SLEEP_PROTECTION',
  'SUGGEST_ACTIVITY',
  'START_DAY',
  'END_DAY',
  'LOG_WORKOUT_SET',
  'SKIP_WORKOUT_SET',
  'COMPLETE_WORKOUT',
  'ABANDON_WORKOUT',
] as const;
const commandName = z.enum(commandNames);
export const recommendationSchema = z.object({
  id: uuid,
  beyondDayId: uuid,
  issuedAt: isoDateTime,
  kind: z.string().min(1),
  priority: z.number().int().nonnegative(),
  title: z.string().min(1),
  rationale: z.string().min(1),
  suggestedCommand: commandName.optional(),
  trace: decisionTraceSchema,
  statusAtIssue: z.enum(['ACTION', 'NO_ACTION_REQUIRED']),
});
export const outcomeSchema = z.object({
  id: uuid,
  recommendationId: uuid.optional(),
  commandExecutionId: uuid.optional(),
  beyondDayId: uuid,
  recordedAt: isoDateTime,
  result: z.enum(['COMPLETED', 'PARTIAL', 'ABANDONED', 'SUPERSEDED', 'NO_ACTION', 'UNKNOWN']),
  note: z.string().optional(),
});
export const metaRecordSchema = z.object({ key: z.string().min(1), value: z.unknown() });

export const workoutSessionSchema = z
  .object({
    id: uuid,
    schemaVersion: z.number().int().positive(),
    beyondDayId: uuid,
    templateId: z.enum(['A', 'B', 'C']).optional(),
    sessionType: z.enum(['STANDARD', 'REDUCED', 'RECOVERY']),
    status: z.enum(['ACTIVE', 'COMPLETED', 'PARTIAL', 'ABANDONED']),
    startedAt: isoDateTime,
    endedAt: isoDateTime.optional(),
    durationMinutes: z.number().int().nonnegative().optional(),
  })
  .superRefine((session, ctx) => {
    if (session.status === 'ACTIVE' && session.endedAt)
      ctx.addIssue({ code: 'custom', message: 'Active workout cannot have endedAt' });
    if (session.status !== 'ACTIVE' && !session.endedAt)
      ctx.addIssue({ code: 'custom', message: 'Closed workout requires endedAt' });
    if (session.sessionType !== 'RECOVERY' && !session.templateId)
      ctx.addIssue({ code: 'custom', message: 'Strength workout requires templateId' });
    if (session.sessionType === 'RECOVERY' && session.templateId)
      ctx.addIssue({ code: 'custom', message: 'Recovery session cannot claim a strength template' });
    if (session.sessionType !== 'RECOVERY' && session.durationMinutes !== undefined)
      ctx.addIssue({ code: 'custom', message: 'Strength workout does not store recovery duration' });
    if (
      session.sessionType === 'RECOVERY' &&
      session.status !== 'ACTIVE' &&
      session.durationMinutes === undefined
    )
      ctx.addIssue({ code: 'custom', message: 'Closed recovery session requires duration' });
  });

export const performedSetSchema = z
  .object({
    id: uuid,
    schemaVersion: z.number().int().positive(),
    beyondDayId: uuid,
    workoutSessionId: uuid,
    exerciseId: z.string().min(1),
    setOrdinal: z.number().int().positive(),
    state: z.enum(['COMPLETED', 'SKIPPED']),
    weight: z.number().finite().nonnegative().optional(),
    reps: z.number().int().positive().optional(),
    recordedAt: isoDateTime,
  })
  .superRefine((set, ctx) => {
    if (set.state === 'COMPLETED' && (set.weight === undefined || set.reps === undefined))
      ctx.addIssue({ code: 'custom', message: 'Completed set requires weight and reps' });
    if (set.state === 'SKIPPED' && (set.weight !== undefined || set.reps !== undefined))
      ctx.addIssue({ code: 'custom', message: 'Skipped set cannot fabricate weight or reps' });
  });

const eventTypes = [
  'DAY_STARTED',
  'DAY_ENDED',
  'STATE_CHECKED_IN',
  'RECOMMENDATION_ISSUED',
  'RECOMMENDATION_ACCEPTED',
  'RECOMMENDATION_DISMISSED',
  'RECOMMENDATION_OVERRIDDEN',
  'COMMAND_STARTED',
  'COMMAND_COMPLETED',
  'COMMAND_ABORTED',
  'RESET_STARTED',
  'RESET_COMPLETED',
  'SHIFT_DOWN_STARTED',
  'SHIFT_DOWN_COMPLETED',
  'MINIMUM_DAY_ENABLED',
  'MINIMUM_ITEM_COMPLETED',
  'WATER_LOGGED',
  'PROTEIN_ACTION_LOGGED',
  'SLEEP_LOGGED',
  'WORKOUT_STARTED',
  'WORKOUT_SET_RECORDED',
  'WORKOUT_SET_SKIPPED',
  'WORKOUT_COMPLETED',
  'WORKOUT_ABANDONED',
  'NO_ACTION_RECORDED',
] as const;
const recommendationDecisionPayload = z.object({ recommendationId: uuid }).passthrough();
const commandPayload = z.object({ commandName }).passthrough();
const resetPayload = z
  .object({ commandId: uuid, intensity: z.number().int().min(1).max(5) })
  .passthrough();
const ritualPayload = z.object({ commandId: uuid }).passthrough();
const minimumEnabledPayload = z.object({ commandId: uuid });
const minimumItemPayload = z.object({ commandId: uuid, key: minimumItemKey });
const waterPayload = z.object({ commandId: uuid, amountOz: z.number().positive() });
const proteinPayload = z.object({ commandId: uuid, grams: z.number().positive() });
const sleepPayload = z.object({ commandId: uuid, durationMinutes: z.number().int().positive() });
const workoutStartedPayload = z.object({
  commandId: uuid,
  sessionId: uuid,
  templateId: z.enum(['A', 'B', 'C']).optional(),
  sessionType: z.enum(['STANDARD', 'REDUCED', 'RECOVERY']),
});
const workoutSetPayload = z.object({
  commandId: uuid,
  sessionId: uuid,
  setId: uuid,
  exerciseId: z.string().min(1),
  setOrdinal: z.number().int().positive(),
});
const workoutClosedPayload = z.object({
  commandId: uuid,
  sessionId: uuid,
  status: z.enum(['COMPLETED', 'PARTIAL', 'ABANDONED']),
  sessionType: z.enum(['STANDARD', 'REDUCED', 'RECOVERY']).optional(),
  durationMinutes: z.number().int().nonnegative().optional(),
});

const eventPayloadSchemas: Partial<Record<EventType, z.ZodType>> = {
  DAY_STARTED: z.object({ workContext: z.enum(['WORK', 'OFF_DUTY', 'UNKNOWN']) }),
  DAY_ENDED: z.object({ commandId: uuid }).passthrough(),
  STATE_CHECKED_IN: stateCheckInPayloadSchema,
  RECOMMENDATION_ISSUED: z.object({ recommendationId: uuid, kind: z.string().min(1) }),
  RECOMMENDATION_ACCEPTED: recommendationDecisionPayload,
  RECOMMENDATION_DISMISSED: recommendationDecisionPayload,
  RECOMMENDATION_OVERRIDDEN: recommendationDecisionPayload,
  COMMAND_STARTED: commandPayload,
  COMMAND_COMPLETED: commandPayload,
  COMMAND_ABORTED: commandPayload,
  RESET_STARTED: resetPayload,
  RESET_COMPLETED: ritualPayload,
  SHIFT_DOWN_STARTED: ritualPayload,
  SHIFT_DOWN_COMPLETED: ritualPayload,
  MINIMUM_DAY_ENABLED: minimumEnabledPayload,
  MINIMUM_ITEM_COMPLETED: minimumItemPayload,
  WATER_LOGGED: waterPayload,
  PROTEIN_ACTION_LOGGED: proteinPayload,
  SLEEP_LOGGED: sleepPayload,
  WORKOUT_STARTED: workoutStartedPayload,
  WORKOUT_SET_RECORDED: workoutSetPayload,
  WORKOUT_SET_SKIPPED: workoutSetPayload,
  WORKOUT_COMPLETED: workoutClosedPayload,
  WORKOUT_ABANDONED: workoutClosedPayload,
  NO_ACTION_RECORDED: recommendationDecisionPayload,
};

export const domainEventSchema = z
  .object({
    id: uuid,
    schemaVersion: z.number().int().positive(),
    type: z.enum(eventTypes),
    beyondDayId: uuid.optional(),
    occurredAt: isoDateTime,
    recordedAt: isoDateTime,
    payload: z.unknown(),
    source: z.enum(['USER', 'ENGINE', 'SYSTEM']),
    correlationId: uuid.optional(),
    causationId: uuid.optional(),
  })
  .superRefine((event, ctx) => {
    const schema = eventPayloadSchemas[event.type];
    if (!schema) return;
    const result = schema.safeParse(event.payload);
    if (!result.success)
      ctx.addIssue({ code: 'custom', message: `Invalid ${event.type} payload` });
  });

export function assertValidBeyondDay(value: unknown): BeyondDay {
  return beyondDaySchema.parse(value) as BeyondDay;
}
export function assertValidCheckIn(value: unknown): StateCheckIn {
  return stateCheckInPayloadSchema.parse(value) as StateCheckIn;
}
export function assertValidEvent(value: unknown): DomainEvent {
  return domainEventSchema.parse(value) as DomainEvent;
}
export function assertValidRecommendation(value: unknown): Recommendation {
  return recommendationSchema.parse(value) as Recommendation;
}
export function assertValidOutcome(value: unknown): Outcome {
  return outcomeSchema.parse(value) as Outcome;
}
export function assertValidMeta(value: unknown): MetaRecord {
  return metaRecordSchema.parse(value) as MetaRecord;
}
export function assertValidWorkoutSession(value: unknown): WorkoutSession {
  return workoutSessionSchema.parse(value) as WorkoutSession;
}
export function assertValidPerformedSet(value: unknown): PerformedSet {
  return performedSetSchema.parse(value) as PerformedSet;
}
