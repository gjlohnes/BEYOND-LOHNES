import Dexie from 'dexie';
import { db } from '../../persistence/db';
import type { WorkContext } from '../../domain/common/types';
import type { StateCheckIn } from '../../domain/checkin/types';
import { evaluate } from '../../engine/evaluate';
import {
  assertValidBeyondDay,
  assertValidEvent,
  assertValidRecommendation,
  stateCheckInInputSchema,
  stateCheckInPayloadSchema,
} from '../../persistence/validation';
import { executeCommand } from '../commands/executeCommand';
import { getActiveRitual } from './ritualService';
import { getWorkTransitionState } from './workContextService';

export type PersistedRecommendationDecision = 'ACCEPT' | 'DISMISS' | 'OVERRIDE' | 'NO_ACTION';

function recommendationDecisionFromEventType(type: string): PersistedRecommendationDecision | null {
  if (type === 'RECOMMENDATION_ACCEPTED') return 'ACCEPT';
  if (type === 'RECOMMENDATION_DISMISSED') return 'DISMISS';
  if (type === 'RECOMMENDATION_OVERRIDDEN') return 'OVERRIDE';
  if (type === 'NO_ACTION_RECORDED') return 'NO_ACTION';
  return null;
}

export async function startDay(workContext: WorkContext) {
  return db.transaction('rw', db.beyondDays, db.events, async () => {
    const active = await db.beyondDays.where('status').equals('ACTIVE').first();
    if (active) return assertValidBeyondDay(active);

    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    const day = assertValidBeyondDay({
      id,
      schemaVersion: 1,
      startedAt: now,
      timezoneId: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      workContext,
      status: 'ACTIVE',
      createdAt: now,
      updatedAt: now,
    });
    const event = assertValidEvent({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'DAY_STARTED',
      beyondDayId: id,
      occurredAt: now,
      recordedAt: now,
      payload: { workContext },
      source: 'USER',
    });
    await db.beyondDays.add(day);
    await db.events.add(event);
    return day;
  });
}

export async function endDay(dayId: string) {
  return db.transaction('rw', db.beyondDays, db.events, db.workoutSessions, async () => {
    const dayRaw = await db.beyondDays.get(dayId);
    if (!dayRaw) throw new Error('DAY_NOT_FOUND');
    const day = assertValidBeyondDay(dayRaw);
    if (day.status === 'COMPLETED') return day;

    const [activeWorkout, activeReset, activeShiftDown] = await Promise.all([
      db.workoutSessions
        .where('status')
        .equals('ACTIVE')
        .filter((session) => session.beyondDayId === dayId)
        .first(),
      getActiveRitual(dayId, 'RESET'),
      getActiveRitual(dayId, 'SHIFT_DOWN'),
    ]);
    if (activeWorkout || activeReset || activeShiftDown) throw new Error('ACTIVE_FLOW_EXISTS');

    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const completed = assertValidBeyondDay({
      ...day,
      status: 'COMPLETED',
      endedAt: now,
      updatedAt: now,
    });
    const started = assertValidEvent({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'COMMAND_STARTED',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: { commandName: 'END_DAY' },
      source: 'USER',
      correlationId: commandId,
    });
    const ended = assertValidEvent({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'DAY_ENDED',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: { commandId },
      source: 'USER',
      correlationId: commandId,
      causationId: started.id,
    });
    const commandCompleted = assertValidEvent({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      type: 'COMMAND_COMPLETED',
      beyondDayId: dayId,
      occurredAt: now,
      recordedAt: now,
      payload: { commandName: 'END_DAY' },
      source: 'SYSTEM',
      correlationId: commandId,
      causationId: started.id,
    });

    await db.beyondDays.put(completed);
    await db.events.bulkAdd([started, ended, commandCompleted]);
    return completed;
  });
}

export async function submitCheckIn(
  dayId: string,
  values: Omit<StateCheckIn, 'id' | 'beyondDayId' | 'recordedAt'>,
) {
  const dayRaw = await db.beyondDays.get(dayId);
  if (!dayRaw || dayRaw.status !== 'ACTIVE') throw new Error('DAY_NOT_FOUND');
  const day = assertValidBeyondDay(dayRaw);
  const input = stateCheckInInputSchema.parse(values);
  const now = new Date().toISOString();
  const checkIn = stateCheckInPayloadSchema.parse({
    id: crypto.randomUUID(),
    beyondDayId: dayId,
    recordedAt: now,
    ...input,
  }) as StateCheckIn;
  const reassessCommand = {
    id: crypto.randomUUID(),
    name: 'REASSESS' as const,
    beyondDayId: dayId,
    issuedAt: now,
    input,
  };
  const commandResult = await executeCommand(reassessCommand);
  if (commandResult.status !== 'COMPLETED')
    throw new Error(commandResult.errorCode ?? 'REASSESS_FAILED');

  const [recentEvents, workTransition] = await Promise.all([
    db.events
      .where('[beyondDayId+occurredAt]')
      .between([dayId, Dexie.minKey], [dayId, Dexie.maxKey])
      .reverse()
      .limit(25)
      .toArray(),
    getWorkTransitionState(dayId),
  ]);
  const result = evaluate({
    beyondDay: day,
    latestCheckIn: checkIn,
    recentEvents,
    context: { postShift: workTransition.postShift },
    now,
  });
  const recommendation = assertValidRecommendation({
    id: crypto.randomUUID(),
    beyondDayId: dayId,
    issuedAt: now,
    ...result.primary,
    trace: result.trace,
  });
  const checkInEvent = assertValidEvent({
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
  const issued = assertValidEvent({
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
  await db.transaction('rw', db.events, db.recommendations, async () => {
    await db.events.add(checkInEvent);
    await db.recommendations.add(recommendation);
    await db.events.add(issued);
  });
  return { checkIn, recommendation, commandResult };
}

export async function getTodayState() {
  const dayRaw = await db.beyondDays.where('status').equals('ACTIVE').first();
  if (!dayRaw)
    return { day: null, recommendation: null, recommendationDecision: null, workEnded: false };
  const day = assertValidBeyondDay(dayRaw);
  const workTransition = await getWorkTransitionState(day.id);
  const recommendationRaw = await db.recommendations
    .where('[beyondDayId+issuedAt]')
    .between([day.id, Dexie.minKey], [day.id, Dexie.maxKey])
    .last();
  const recommendationCandidate = recommendationRaw ? assertValidRecommendation(recommendationRaw) : null;
  const recommendation =
    recommendationCandidate &&
    workTransition.endedAt &&
    recommendationCandidate.issuedAt < workTransition.endedAt
      ? null
      : recommendationCandidate;
  if (!recommendation)
    return {
      day,
      recommendation: null,
      recommendationDecision: null,
      workEnded: workTransition.ended,
    };

  const decisionEvent = await db.events
    .where('beyondDayId')
    .equals(day.id)
    .filter(
      (candidate) =>
        candidate.causationId === recommendation.id &&
        recommendationDecisionFromEventType(candidate.type) !== null,
    )
    .first();

  return {
    day,
    recommendation,
    recommendationDecision: decisionEvent
      ? recommendationDecisionFromEventType(decisionEvent.type)
      : null,
    workEnded: workTransition.ended,
  };
}
