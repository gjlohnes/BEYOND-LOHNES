import { db } from '../../persistence/db';
import type { DomainEvent } from '../../domain/common/events';
import type { Outcome, Recommendation } from '../../domain/recommendation/types';
import type { RecommendationDecision } from '../../domain/recommendation/decision';
import {
  assertValidEvent,
  assertValidOutcome,
  assertValidRecommendation,
} from '../../persistence/validation';

function decisionEvent(
  recommendation: Recommendation,
  decision: RecommendationDecision,
  payload: Record<string, unknown> = {},
): DomainEvent {
  const now = new Date().toISOString();
  const type =
    decision === 'ACCEPT'
      ? 'RECOMMENDATION_ACCEPTED'
      : decision === 'DISMISS'
        ? 'RECOMMENDATION_DISMISSED'
        : decision === 'OVERRIDE'
          ? 'RECOMMENDATION_OVERRIDDEN'
          : 'NO_ACTION_RECORDED';
  return assertValidEvent({
    id: crypto.randomUUID(),
    schemaVersion: 1,
    type,
    beyondDayId: recommendation.beyondDayId,
    occurredAt: now,
    recordedAt: now,
    payload: { recommendationId: recommendation.id, ...payload },
    source: 'USER',
    causationId: recommendation.id,
  });
}

function terminalOutcome(
  recommendation: Recommendation,
  result: Outcome['result'],
): Outcome {
  return assertValidOutcome({
    id: crypto.randomUUID(),
    recommendationId: recommendation.id,
    beyondDayId: recommendation.beyondDayId,
    recordedAt: new Date().toISOString(),
    result,
  });
}

export async function decideRecommendation(
  recommendationId: string,
  decision: RecommendationDecision,
  overrideCommand?: 'START_RESET' | 'START_SHIFT_DOWN',
) {
  const recommendationRaw = await db.recommendations.get(recommendationId);
  if (!recommendationRaw) throw new Error('RECOMMENDATION_NOT_FOUND');
  const recommendation = assertValidRecommendation(recommendationRaw);

  return db.transaction('rw', db.events, db.outcomes, async () => {
    const prior = await db.events
      .where('beyondDayId')
      .equals(recommendation.beyondDayId)
      .filter(
        (candidate) =>
          candidate.causationId === recommendation.id &&
          [
            'RECOMMENDATION_ACCEPTED',
            'RECOMMENDATION_DISMISSED',
            'RECOMMENDATION_OVERRIDDEN',
            'NO_ACTION_RECORDED',
          ].includes(candidate.type),
      )
      .first();
    if (prior) throw new Error('RECOMMENDATION_ALREADY_DECIDED');

    const event = decisionEvent(
      recommendation,
      decision,
      overrideCommand ? { overrideCommand } : {},
    );
    const result: Outcome['result'] =
      decision === 'DISMISS'
        ? 'ABANDONED'
        : decision === 'NO_ACTION'
          ? 'NO_ACTION'
          : decision === 'OVERRIDE'
            ? 'SUPERSEDED'
            : 'UNKNOWN';
    const outcome = terminalOutcome(recommendation, result);

    await db.events.add(event);
    await db.outcomes.add(outcome);
    return { event, outcome, commandResult: null };
  });
}
