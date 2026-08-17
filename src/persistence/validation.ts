import { z } from 'zod';
import type { BeyondDay } from '../domain/day/types';
import type { DomainEvent, EventType } from '../domain/common/events';
import type { Outcome, Recommendation } from '../domain/recommendation/types';
import type { StateCheckIn } from '../domain/checkin/types';
import type { MetaRecord } from './db';

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime({ offset: true });
const primitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);

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

export const stateCheckInInputSchema = z.object({
  energy: z.number().int().min(1).max(5),
  stress: z.number().int().min(1).max(5),
  mood: z.number().int().min(1).max(5),
  soreness: z.number().int().min(0).max(5),
  alcoholUrge: z.number().int().min(0).max(5),
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

export const recommendationSchema = z.object({
  id: uuid,
  beyondDayId: uuid,
  issuedAt: isoDateTime,
  kind: z.string().min(1),
  priority: z.number().int().nonnegative(),
  title: z.string().min(1),
  rationale: z.string().min(1),
  suggestedCommand: z
    .enum([
      'START_RESET',
      'START_SHIFT_DOWN',
      'REASSESS',
      'ENABLE_MINIMUM_DAY',
      'START_WORKOUT',
      'START_REDUCED_WORKOUT',
      'RECOVERY_SESSION',
      'LOG_WATER',
      'PROTEIN_ACTION',
      'SLEEP_PROTECTION',
      'SUGGEST_ACTIVITY',
      'START_DAY',
      'END_DAY',
    ])
    .optional(),
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
  'WATER_LOGGED',
  'PROTEIN_ACTION_LOGGED',
  'NO_ACTION_RECORDED',
] as const;

const commandName = z.enum([
  'START_RESET',
  'START_SHIFT_DOWN',
  'REASSESS',
  'ENABLE_MINIMUM_DAY',
  'START_WORKOUT',
  'START_REDUCED_WORKOUT',
  'RECOVERY_SESSION',
  'LOG_WATER',
  'PROTEIN_ACTION',
  'SLEEP_PROTECTION',
  'SUGGEST_ACTIVITY',
  'START_DAY',
  'END_DAY',
]);
const recommendationDecisionPayload = z.object({ recommendationId: uuid }).passthrough();
const commandPayload = z.object({ commandName }).passthrough();
const resetPayload = z
  .object({ commandId: uuid, intensity: z.number().int().min(1).max(5) })
  .passthrough();
const ritualPayload = z.object({ commandId: uuid }).passthrough();
const waterPayload = z.object({ commandId: uuid, amountOz: z.number().positive() });
const proteinPayload = z.object({ commandId: uuid, grams: z.number().positive() });

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
  WATER_LOGGED: waterPayload,
  PROTEIN_ACTION_LOGGED: proteinPayload,
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
