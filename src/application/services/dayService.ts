import Dexie from 'dexie';
import { db } from '../../persistence/db';
import type { WorkContext } from '../../domain/common/types';
import type { StateCheckIn } from '../../domain/checkin/types';
import { evaluate } from '../../engine/evaluate';
import { stateCheckInPayloadSchema } from '../../persistence/validation';
import { executeCommand } from '../commands/executeCommand';

export async function startDay(workContext: WorkContext) {
  const active = await db.beyondDays.where('status').equals('ACTIVE').first();
  if (active) return active;

  const now = new Date().toISOString();
  const id = crypto.randomUUID();
  const day = {
    id,
    schemaVersion: 1,
    startedAt: now,
    timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
    workContext,
    status: 'ACTIVE' as const,
    createdAt: now,
    updatedAt: now,
  };

  await db.transaction('rw', db.beyondDays, db.events, async () => {
    await db.beyondDays.add(day);
    await db.events.add({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'DAY_STARTED',
      beyondDayId: id,
      occurredAt: now,
      recordedAt: now,
      payload: { workContext },
      source: 'USER',
    });
  });
  return day;
}

export async function submitCheckIn(
  dayId: string,
  values: Omit<StateCheckIn, 'id' | 'beyondDayId' | 'recordedAt'>,
) {
  const day = await db.beyondDays.get(dayId);
  if (!day || day.status !== 'ACTIVE') throw new Error('DAY_NOT_FOUND');

  const now = new Date().toISOString();
  const checkIn = stateCheckInPayloadSchema.parse({
    id: crypto.randomUUID(),
    beyondDayId: dayId,
    recordedAt: now,
    ...values,
  }) as StateCheckIn;

  const reassessCommand = {
    id: crypto.randomUUID(),
    name: 'REASSESS' as const,
    beyondDayId: dayId,
    issuedAt: now,
    input: values,
  };
  const commandResult = await executeCommand(reassessCommand);
  if (commandResult.status !== 'COMPLETED') throw new Error(commandResult.errorCode ?? 'REASSESS_FAILED');

  const recentEvents = await db.events
    .where('beyondDayId')
    .equals(dayId)
    .reverse()
    .sortBy('occurredAt');

  const result = evaluate({
    beyondDay: day,
    latestCheckIn: checkIn,
    recentEvents: recentEvents.slice(0, 25),
    context: {},
    now,
  });
  const recommendation = {
    id: crypto.randomUUID(),
    beyondDayId: dayId,
    issuedAt: now,
    ...result.primary,
    trace: result.trace,
  };

  await db.transaction('rw', db.events, db.recommendations, async () => {
    await db.events.add({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'STATE_CHECKED_IN',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: checkIn,
      source: 'USER',
      correlationId: reassessCommand.id,
    });
    await db.recommendations.add(recommendation);
    await db.events.add({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'RECOMMENDATION_ISSUED',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: { recommendationId: recommendation.id, kind: recommendation.kind },
      source: 'ENGINE',
      causationId: reassessCommand.id,
    });
  });
  return { checkIn, recommendation, commandResult };
}

export async function getTodayState() {
  const day = await db.beyondDays.where('status').equals('ACTIVE').first();
  if (!day) return { day: null, recommendation: null };
  const recommendation = await db.recommendations
    .where('[beyondDayId+issuedAt]')
    .between([day.id, Dexie.minKey], [day.id, Dexie.maxKey])
    .last();
  return { day, recommendation: recommendation ?? null };
}
