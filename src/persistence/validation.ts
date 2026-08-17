import { z } from 'zod';

const uuid = z.string().uuid();
const isoDateTime = z.string().datetime();

export const beyondDaySchema = z.object({
  id: uuid,
  schemaVersion: z.number().int().positive(),
  startedAt: isoDateTime,
  endedAt: isoDateTime.optional(),
  timezoneId: z.string().min(1),
  workContext: z.enum(['WORK', 'OFF_DUTY', 'UNKNOWN']),
  status: z.enum(['ACTIVE', 'COMPLETED']),
  createdAt: isoDateTime,
  updatedAt: isoDateTime,
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

export const domainEventSchema = z.object({
  id: uuid,
  schemaVersion: z.number().int().positive(),
  type: z.enum([
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
  ]),
  beyondDayId: uuid.optional(),
  occurredAt: isoDateTime,
  recordedAt: isoDateTime,
  payload: z.unknown(),
  source: z.enum(['USER', 'ENGINE', 'SYSTEM']),
  correlationId: uuid.optional(),
  causationId: uuid.optional(),
});

export function assertValidEvent(value: unknown) {
  return domainEventSchema.parse(value);
}
