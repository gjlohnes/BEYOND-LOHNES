import { db } from '../../persistence/db';
import { executeCommand } from '../commands/executeCommand';

export async function getWorkTransitionState(dayId: string) {
  const event = await db.events
    .where('beyondDayId')
    .equals(dayId)
    .filter((candidate) => candidate.type === 'WORK_PERIOD_ENDED')
    .first();
  return {
    ended: Boolean(event),
    endedAt: event?.occurredAt ?? null,
  };
}

export async function hasWorkEnded(dayId: string) {
  return (await getWorkTransitionState(dayId)).ended;
}

export async function markWorkEnded(dayId: string) {
  const command = {
    id: crypto.randomUUID(),
    name: 'MARK_WORK_ENDED' as const,
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: {},
  };
  return executeCommand(command);
}
