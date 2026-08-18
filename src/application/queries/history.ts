import Dexie from 'dexie';
import { db } from '../../persistence/db';

export async function getDayHistory(dayId: string) {
  return db.events
    .where('[beyondDayId+occurredAt]')
    .between([dayId, Dexie.minKey], [dayId, Dexie.maxKey])
    .toArray();
}

export async function getWhyContext(recommendationId: string) {
  const recommendation = await db.recommendations.get(recommendationId);
  if (!recommendation) return null;
  const events = await db.events
    .where('beyondDayId')
    .equals(recommendation.beyondDayId)
    .filter(
      (candidate) =>
        candidate.causationId === recommendationId ||
        (typeof candidate.payload === 'object' &&
          candidate.payload !== null &&
          'recommendationId' in candidate.payload &&
          (candidate.payload as { recommendationId?: string }).recommendationId === recommendationId),
    )
    .toArray();
  const outcomes = await db.outcomes
    .where('recommendationId')
    .equals(recommendationId)
    .toArray();
  return { recommendation, events, outcomes };
}

export async function getLatestStartedRitual(dayId: string, kind: 'RESET' | 'SHIFT_DOWN') {
  const eventType = kind === 'RESET' ? 'RESET_STARTED' : 'SHIFT_DOWN_STARTED';
  const events = await db.events.where('beyondDayId').equals(dayId).reverse().sortBy('occurredAt');
  return events.find((event) => event.type === eventType) ?? null;
}
