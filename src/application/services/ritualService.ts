import Dexie from 'dexie';
import { db } from '../../persistence/db';
import type { DomainEvent } from '../../domain/common/events';
import type { Outcome } from '../../domain/recommendation/types';
import type { ResetIntensity } from '../../domain/reset/types';
import { assertValidEvent, assertValidOutcome } from '../../persistence/validation';
import { executeCommand } from '../commands/executeCommand';

export interface ActiveRitual {
  kind: 'RESET' | 'SHIFT_DOWN';
  commandId: string;
  recommendationId?: string;
  intensity?: ResetIntensity;
  startedAt: string;
}

function stringField(payload: unknown, key: string) {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : undefined;
}

function resetIntensity(payload: unknown): ResetIntensity | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const value = (payload as Record<string, unknown>).intensity;
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5
    ? (value as ResetIntensity)
    : undefined;
}

export async function getActiveRitual(
  dayId: string,
  kind: 'RESET' | 'SHIFT_DOWN',
): Promise<ActiveRitual | null> {
  const startType = kind === 'RESET' ? 'RESET_STARTED' : 'SHIFT_DOWN_STARTED';
  const completionType = kind === 'RESET' ? 'RESET_COMPLETED' : 'SHIFT_DOWN_COMPLETED';
  const events = await db.events
    .where('[beyondDayId+occurredAt]')
    .between([dayId, Dexie.minKey], [dayId, Dexie.maxKey])
    .toArray();

  const completedCommands = new Set(
    events
      .filter((event) => event.type === completionType)
      .map((event) => event.correlationId)
      .filter((id): id is string => Boolean(id)),
  );

  const started = events
    .filter(
      (event) =>
        event.type === startType &&
        Boolean(event.correlationId) &&
        !completedCommands.has(event.correlationId!),
    )
    .sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))[0];

  if (!started?.correlationId) return null;
  const recommendationId = stringField(started.payload, 'recommendationId');
  const intensity = kind === 'RESET' ? resetIntensity(started.payload) : undefined;

  return {
    kind,
    commandId: started.correlationId,
    ...(recommendationId ? { recommendationId } : {}),
    ...(intensity ? { intensity } : {}),
    startedAt: started.occurredAt,
  };
}

export async function startReset(
  dayId: string,
  intensity: ResetIntensity,
  recommendationId?: string,
) {
  const command = {
    id: crypto.randomUUID(),
    name: 'START_RESET' as const,
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: { intensity },
  };
  return executeCommand(command, recommendationId ? { recommendationId } : {});
}

export async function startShiftDown(dayId: string, recommendationId?: string) {
  const command = {
    id: crypto.randomUUID(),
    name: 'START_SHIFT_DOWN' as const,
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: {},
  };
  return executeCommand(command, recommendationId ? { recommendationId } : {});
}

async function completeRitual(
  dayId: string,
  kind: 'RESET' | 'SHIFT_DOWN',
  commandId: string,
  recommendationId?: string,
) {
  const day = await db.beyondDays.get(dayId);
  if (!day || day.status !== 'ACTIVE') throw new Error('DAY_NOT_FOUND');

  return db.transaction('rw', db.events, db.outcomes, async () => {
    const existing = await db.events
      .filter(
        (candidate) =>
          candidate.beyondDayId === dayId &&
          candidate.correlationId === commandId &&
          candidate.type === `${kind}_COMPLETED`,
      )
      .first();
    if (existing) return existing;

    const startType = kind === 'RESET' ? 'RESET_STARTED' : 'SHIFT_DOWN_STARTED';
    const started = await db.events
      .filter(
        (candidate) =>
          candidate.beyondDayId === dayId &&
          candidate.correlationId === commandId &&
          candidate.type === startType,
      )
      .first();
    if (!started) throw new Error('RITUAL_NOT_STARTED');

    const persistedRecommendationId =
      recommendationId ?? stringField(started.payload, 'recommendationId');
    const now = new Date().toISOString();
    const completion: DomainEvent = assertValidEvent({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: kind === 'RESET' ? 'RESET_COMPLETED' : 'SHIFT_DOWN_COMPLETED',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: {
        commandId,
        ...(persistedRecommendationId ? { recommendationId: persistedRecommendationId } : {}),
      },
      source: 'USER',
      correlationId: commandId,
      causationId: started.id,
    });
    const outcome: Outcome = assertValidOutcome({
      id: crypto.randomUUID(),
      ...(persistedRecommendationId ? { recommendationId: persistedRecommendationId } : {}),
      commandExecutionId: commandId,
      beyondDayId: dayId,
      recordedAt: now,
      result: 'COMPLETED',
    });

    await db.events.add(completion);
    await db.outcomes.add(outcome);
    return completion;
  });
}

export function completeReset(dayId: string, commandId: string, recommendationId?: string) {
  return completeRitual(dayId, 'RESET', commandId, recommendationId);
}

export function completeShiftDown(
  dayId: string,
  commandId: string,
  recommendationId?: string,
) {
  return completeRitual(dayId, 'SHIFT_DOWN', commandId, recommendationId);
}
