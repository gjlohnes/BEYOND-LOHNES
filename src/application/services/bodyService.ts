import Dexie from 'dexie';
import { db } from '../../persistence/db';
import { executeCommand } from '../commands/executeCommand';
import { completeRecoverySession, startRecoverySession } from './workoutService';

export interface BodyState {
  dayId: string | null;
  waterOz: number;
  proteinGrams: number;
  sleepMinutes: number | null;
  recoveryMinutes: number;
  activeRecoverySessionId: string | null;
}

export async function getBodyState(): Promise<BodyState> {
  const day = await db.beyondDays.where('status').equals('ACTIVE').first();
  if (!day)
    return {
      dayId: null,
      waterOz: 0,
      proteinGrams: 0,
      sleepMinutes: null,
      recoveryMinutes: 0,
      activeRecoverySessionId: null,
    };

  const [events, recoverySessions] = await Promise.all([
    db.events
      .where('[beyondDayId+occurredAt]')
      .between([day.id, Dexie.minKey], [day.id, Dexie.maxKey], true, true)
      .toArray(),
    db.workoutSessions
      .where('beyondDayId')
      .equals(day.id)
      .filter((session) => session.sessionType === 'RECOVERY')
      .toArray(),
  ]);
  let waterOz = 0;
  let proteinGrams = 0;
  let sleepMinutes: number | null = null;

  for (const event of events) {
    if (event.type === 'WATER_LOGGED') {
      const amountOz = (event.payload as { amountOz?: unknown }).amountOz;
      if (typeof amountOz === 'number' && Number.isFinite(amountOz) && amountOz > 0) {
        waterOz += amountOz;
      }
    }
    if (event.type === 'PROTEIN_ACTION_LOGGED') {
      const grams = (event.payload as { grams?: unknown }).grams;
      if (typeof grams === 'number' && Number.isFinite(grams) && grams > 0) {
        proteinGrams += grams;
      }
    }
    if (event.type === 'SLEEP_LOGGED') {
      const durationMinutes = (event.payload as { durationMinutes?: unknown }).durationMinutes;
      if (
        typeof durationMinutes === 'number' &&
        Number.isInteger(durationMinutes) &&
        durationMinutes > 0
      ) {
        sleepMinutes = durationMinutes;
      }
    }
  }

  const recoveryMinutes = recoverySessions.reduce(
    (total, session) => total + (session.durationMinutes ?? 0),
    0,
  );
  const activeRecovery = recoverySessions.find((session) => session.status === 'ACTIVE');

  return {
    dayId: day.id,
    waterOz,
    proteinGrams,
    sleepMinutes,
    recoveryMinutes,
    activeRecoverySessionId: activeRecovery?.id ?? null,
  };
}

export async function logWater(dayId: string, amountOz: number) {
  return executeCommand({
    id: crypto.randomUUID(),
    name: 'LOG_WATER',
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: { amountOz },
  });
}

export async function logProtein(dayId: string, grams: number) {
  return executeCommand({
    id: crypto.randomUUID(),
    name: 'PROTEIN_ACTION',
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: { grams },
  });
}

export async function logSleep(dayId: string, durationMinutes: number) {
  return executeCommand({
    id: crypto.randomUUID(),
    name: 'LOG_SLEEP',
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: { durationMinutes },
  });
}

export async function startBodyRecovery(dayId: string) {
  const session = await startRecoverySession(dayId);
  if (session.sessionType !== 'RECOVERY') throw new Error('WORKOUT_ALREADY_ACTIVE');
  return session;
}

export function completeBodyRecovery(sessionId: string, durationMinutes: number) {
  return completeRecoverySession(sessionId, durationMinutes);
}
