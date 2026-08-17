import { db } from '../../persistence/db';
import type { DomainEvent } from '../../domain/common/events';
import type { Outcome, Recommendation } from '../../domain/recommendation/types';
import type { RecommendationDecision } from '../../domain/recommendation/decision';
import { startReset, startShiftDown } from './ritualService';

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
  return {
    id: crypto.randomUUID(),
    schemaVersion: 1,
    type,
    beyondDayId: recommendation.beyondDayId,
    occurredAt: now,
    recordedAt: now,
    payload: { recommendationId: recommendation.id, ...payload },
    source: 'USER',
    causationId: recommendation.id,
  };
}

function terminalOutcome(
  recommendation: Recommendation,
  result: Outcome['result'],
): Outcome {
  return {
    id: crypto.randomUUID(),
    recommendationId: recommendation.id,
    beyondDayId: recommendation.beyondDayId,
    recordedAt: new Date().toISOString(),
    result,
  };
}

export async function decideRecommendation(
  recommendationId: string,
  decision: RecommendationDecision,
  overrideCommand?: 'START_RESET' | 'START_SHIFT_DOWN',
) {
  const recommendation = await db.recommendations.get(recommendationId);
  if (!recommendation) throw new Error('RECOMMENDATION_NOT_FOUND');

  const prior = await db.events
    .where('beyondDayId')
    .equals(recommendation.beyondDayId)
    .filter(
      (candidate) =>
        candidate.causationId === recommendation.id &&
        ['RECOMMENDATION_ACCEPTED', 'RECOMMENDATION_DISMISSED', 'RECOMMENDATION_OVERRIDDEN', 'NO_ACTION_RECORDED'].includes(candidate.type),
    )
    .first();
  if (prior) throw new Error('RECOMMENDATION_ALREADY_DECIDED');

  const event = decisionEvent(
    recommendation,
    decision,
    overrideCommand ? { overrideCommand } : {},
  );

  if (decision === 'DISMISS' || decision === 'NO_ACTION') {
    const outcome = terminalOutcome(
      recommendation,
      decision === 'NO_ACTION' ? 'NO_ACTION' : 'ABANDONED',
    );
    await db.transaction('rw', db.events, db.outcomes, async () => {
      await db.events.add(event);
      await db.outcomes.add(outcome);
    });
    return { event, outcome, commandResult: null };
  }

  if (decision === 'OVERRIDE') {
    const outcome = terminalOutcome(recommendation, 'SUPERSEDED');
    await db.transaction('rw', db.events, db.outcomes, async () => {
      await db.events.add(event);
      await db.outcomes.add(outcome);
    });
    return { event, outcome, commandResult: null };
  }

  await db.events.add(event);
  const commandResult =
    recommendation.suggestedCommand === 'START_RESET'
      ? await startReset(recommendation.beyondDayId, 3, recommendation.id)
      : recommendation.suggestedCommand === 'START_SHIFT_DOWN'
        ? await startShiftDown(recommendation.beyondDayId, recommendation.id)
        : null;

  const outcome = commandResult
    ? null
    : terminalOutcome(recommendation, 'UNKNOWN');
  if (outcome) await db.outcomes.add(outcome);
  return { event, outcome, commandResult };
}
