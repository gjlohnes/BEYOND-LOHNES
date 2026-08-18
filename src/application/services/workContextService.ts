import Dexie from 'dexie';
import { db } from '../../persistence/db';
import { executeCommand } from '../commands/executeCommand';

export async function getWorkTransitionState(dayId: string) {
  const events = await db.events
    .where('[beyondDayId+occurredAt]')
    .between([dayId, Dexie.minKey], [dayId, Dexie.maxKey])
    .toArray();
  const workEnded = events.find((candidate) => candidate.type === 'WORK_PERIOD_ENDED');
  const latestShiftDownCompleted = [...events]
    .reverse()
    .find((candidate) => candidate.type === 'SHIFT_DOWN_COMPLETED');
  const endedAt = workEnded?.occurredAt ?? null;
  const shiftDownCompletedAt = latestShiftDownCompleted?.occurredAt ?? null;
  const postShift =
    endedAt !== null && (shiftDownCompletedAt === null || shiftDownCompletedAt <= endedAt);

  return {
    ended: endedAt !== null,
    endedAt,
    shiftDownCompletedAt,
    postShift,
  };
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
