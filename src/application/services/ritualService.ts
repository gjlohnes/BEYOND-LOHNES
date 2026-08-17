import { db } from '../../persistence/db';
import type { DomainEvent } from '../../domain/common/events';
import type { Outcome } from '../../domain/recommendation/types';
import type { ResetIntensity } from '../../domain/reset/types';
import { executeCommand } from '../commands/executeCommand';

export async function startReset(dayId: string, intensity: ResetIntensity, recommendationId?: string) {
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

  const existing = await db.events
    .filter(
      (candidate) =>
        candidate.correlationId === commandId &&
        candidate.type === `${kind}_COMPLETED`,
    )
    .first();
  if (existing) return existing;

  const now = new Date().toISOString();
  const completion: DomainEvent = {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    type: kind === 'RESET' ? 'RESET_COMPLETED' : 'SHIFT_DOWN_COMPLETED',
    beyondDayId: dayId,
    occurredAt: now,
    recordedAt: now,
    payload: { commandId, ...(recommendationId ? { recommendationId } : {}) },
    source: 'USER',
    correlationId: commandId,
  };
  const outcome: Outcome = {
    id: crypto.randomUUID(),
    ...(recommendationId ? { recommendationId } : {}),
    commandExecutionId: commandId,
    beyondDayId: dayId,
    recordedAt: now,
    result: 'COMPLETED',
  };

  await db.transaction('rw', db.events, db.outcomes, async () => {
    await db.events.add(completion);
    await db.outcomes.add(outcome);
  });
  return completion;
}

export function completeReset(dayId: string, commandId: string, recommendationId?: string) {
  return completeRitual(dayId, 'RESET', commandId, recommendationId);
}

export function completeShiftDown(dayId: string, commandId: string, recommendationId?: string) {
  return completeRitual(dayId, 'SHIFT_DOWN', commandId, recommendationId);
}
