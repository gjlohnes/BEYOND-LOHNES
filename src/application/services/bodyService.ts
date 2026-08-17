import { db } from '../../persistence/db';
import { executeCommand } from '../commands/executeCommand';

export interface BodyState {
  dayId: string | null;
  waterOz: number;
  proteinGrams: number;
}

export async function getBodyState(): Promise<BodyState> {
  const day = await db.beyondDays.where('status').equals('ACTIVE').first();
  if (!day) return { dayId: null, waterOz: 0, proteinGrams: 0 };

  const events = await db.events.where('beyondDayId').equals(day.id).toArray();
  let waterOz = 0;
  let proteinGrams = 0;

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
  }

  return { dayId: day.id, waterOz, proteinGrams };
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
