import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../src/persistence/db';
import { startDay, submitCheckIn, getTodayState } from '../../src/application/services/dayService';
import { executeCommand } from '../../src/application/commands/executeCommand';
import { decideRecommendation } from '../../src/application/services/recommendationService';
import {
  completeReset,
  completeShiftDown,
  getActiveRitual,
  startReset,
  startShiftDown,
} from '../../src/application/services/ritualService';
import { getDayHistory, getWhyContext } from '../../src/application/queries/history';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('persistent FIELD loop', () => {
  it('reconstructs the active BeyondDay after repository reads', async () => {
    const day = await startDay('OFF_DUTY');
    const recovered = await getTodayState();
    expect(recovered.day?.id).toBe(day.id);
    expect(recovered.day?.status).toBe('ACTIVE');
  });

  it('records REASSESS, check-in, recommendation, and WHY evidence', async () => {
    const day = await startDay('OFF_DUTY');
    const { recommendation } = await submitCheckIn(day.id, {
      energy: 5,
      stress: 1,
      mood: 5,
      soreness: 0,
      alcoholUrge: 0,
    });
    const history = await getDayHistory(day.id);
    expect(history.some((event) => event.type === 'COMMAND_STARTED')).toBe(true);
    expect(history.some((event) => event.type === 'STATE_CHECKED_IN')).toBe(true);
    expect(recommendation.statusAtIssue).toBe('NO_ACTION_REQUIRED');

    await decideRecommendation(recommendation.id, 'NO_ACTION');
    const why = await getWhyContext(recommendation.id);
    expect(why?.events.some((event) => event.type === 'NO_ACTION_RECORDED')).toBe(true);
    expect(why?.outcomes.at(-1)?.result).toBe('NO_ACTION');
  });

  it('rejects duplicate command IDs without appending duplicate history', async () => {
    const day = await startDay('OFF_DUTY');
    const command = {
      id: crypto.randomUUID(),
      name: 'START_SHIFT_DOWN' as const,
      beyondDayId: day.id,
      issuedAt: new Date().toISOString(),
      input: {},
    };
    const first = await executeCommand(command);
    const second = await executeCommand(command);
    expect(first.status).toBe('COMPLETED');
    expect(second.status).toBe('REJECTED');
    expect(second.errorCode).toBe('DUPLICATE_COMMAND');
  });

  it('reconstructs active RESET and SHIFT DOWN from stored events until completion', async () => {
    const day = await startDay('WORK');
    const reset = await startReset(day.id, 4);
    expect((await getActiveRitual(day.id, 'RESET'))?.commandId).toBe(reset.commandId);
    expect((await getActiveRitual(day.id, 'RESET'))?.intensity).toBe(4);
    await completeReset(day.id, reset.commandId);
    expect(await getActiveRitual(day.id, 'RESET')).toBeNull();

    const shift = await startShiftDown(day.id);
    expect((await getActiveRitual(day.id, 'SHIFT_DOWN'))?.commandId).toBe(shift.commandId);
    await completeShiftDown(day.id, shift.commandId);
    expect(await getActiveRitual(day.id, 'SHIFT_DOWN')).toBeNull();
  });

  it('persists RESET and SHIFT DOWN lifecycle events', async () => {
    const day = await startDay('WORK');
    const reset = await startReset(day.id, 4);
    expect(reset.status).toBe('COMPLETED');
    await completeReset(day.id, reset.commandId);

    const shift = await startShiftDown(day.id);
    expect(shift.status).toBe('COMPLETED');

    const history = await getDayHistory(day.id);
    expect(history.some((event) => event.type === 'RESET_STARTED')).toBe(true);
    expect(history.some((event) => event.type === 'RESET_COMPLETED')).toBe(true);
    expect(history.some((event) => event.type === 'SHIFT_DOWN_STARTED')).toBe(true);
  });

  it('accepts RESET without inventing intensity and links the later ritual outcome', async () => {
    const day = await startDay('OFF_DUTY');
    const { recommendation } = await submitCheckIn(day.id, {
      energy: 1,
      stress: 1,
      mood: 4,
      soreness: 0,
      alcoholUrge: 0,
    });
    expect(recommendation.suggestedCommand).toBe('START_RESET');
    const decision = await decideRecommendation(recommendation.id, 'ACCEPT');
    expect(decision.commandResult).toBeNull();

    const reset = await startReset(day.id, 5, recommendation.id);
    const recovered = await getActiveRitual(day.id, 'RESET');
    expect(recovered?.recommendationId).toBe(recommendation.id);
    await completeReset(day.id, reset.commandId);
    const why = await getWhyContext(recommendation.id);
    expect(why?.outcomes.map((outcome) => outcome.result)).toContain('COMPLETED');
  });

  it('records dismiss and override as immutable historical evidence', async () => {
    const day = await startDay('OFF_DUTY');
    const first = await submitCheckIn(day.id, {
      energy: 4,
      stress: 1,
      mood: 4,
      soreness: 0,
      alcoholUrge: 0,
    });
    await decideRecommendation(first.recommendation.id, 'DISMISS');
    const firstWhy = await getWhyContext(first.recommendation.id);
    expect(firstWhy?.outcomes.at(-1)?.result).toBe('ABANDONED');

    const second = await submitCheckIn(day.id, {
      energy: 1,
      stress: 1,
      mood: 4,
      soreness: 0,
      alcoholUrge: 0,
    });
    await decideRecommendation(second.recommendation.id, 'OVERRIDE', 'START_SHIFT_DOWN');
    const secondWhy = await getWhyContext(second.recommendation.id);
    expect(secondWhy?.events.some((event) => event.type === 'RECOMMENDATION_OVERRIDDEN')).toBe(true);
    expect(secondWhy?.outcomes.at(-1)?.result).toBe('SUPERSEDED');
  });
});
