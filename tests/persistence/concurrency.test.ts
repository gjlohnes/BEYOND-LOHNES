import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import { executeCommand } from '../../src/application/commands/executeCommand';
import {
  endDay,
  startDay,
  submitCheckIn,
} from '../../src/application/services/dayService';
import { decideRecommendation } from '../../src/application/services/recommendationService';
import {
  completeReset,
  startReset,
} from '../../src/application/services/ritualService';
import { db } from '../../src/persistence/db';

beforeEach(async () => {
  db.close();
  await db.delete();
  await db.open();
});

describe('rapid-action persistence safety', () => {
  it('serializes concurrent START DAY requests into one active day', async () => {
    const [first, second] = await Promise.all([
      startDay('OFF_DUTY'),
      startDay('OFF_DUTY'),
    ]);

    expect(second.id).toBe(first.id);
    expect(await db.beyondDays.where('status').equals('ACTIVE').count()).toBe(1);
    expect(await db.events.where('type').equals('DAY_STARTED').count()).toBe(1);
  });

  it('serializes concurrent END DAY requests into one lifecycle close', async () => {
    const day = await startDay('WORK');
    const [first, second] = await Promise.all([endDay(day.id), endDay(day.id)]);

    expect(first.status).toBe('COMPLETED');
    expect(second.status).toBe('COMPLETED');
    expect(second.endedAt).toBe(first.endedAt);
    expect(await db.events.where('type').equals('DAY_ENDED').count()).toBe(1);
  });

  it('persists a command ID only once when the same command races itself', async () => {
    const day = await startDay('OFF_DUTY');
    const command = {
      id: crypto.randomUUID(),
      name: 'START_SHIFT_DOWN' as const,
      beyondDayId: day.id,
      issuedAt: new Date().toISOString(),
      input: {},
    };

    const results = await Promise.all([executeCommand(command), executeCommand(command)]);
    expect(results.map((result) => result.status).sort()).toEqual(['COMPLETED', 'REJECTED']);
    expect(results.find((result) => result.status === 'REJECTED')?.errorCode).toBe(
      'DUPLICATE_COMMAND',
    );
    expect(
      await db.events.filter((event) => event.correlationId === command.id).count(),
    ).toBe(3);
  });

  it('allows only one terminal decision for a recommendation', async () => {
    const day = await startDay('OFF_DUTY');
    const { recommendation } = await submitCheckIn(day.id, {
      energy: 5,
      stress: 1,
      mood: 5,
      soreness: 0,
      alcoholUrge: 0,
    });

    const results = await Promise.allSettled([
      decideRecommendation(recommendation.id, 'NO_ACTION'),
      decideRecommendation(recommendation.id, 'NO_ACTION'),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
    expect(
      await db.events
        .where('beyondDayId')
        .equals(day.id)
        .filter((event) => event.causationId === recommendation.id)
        .count(),
    ).toBe(1);
    expect(await db.outcomes.where('recommendationId').equals(recommendation.id).count()).toBe(1);
  });

  it('makes ritual completion idempotent and requires a real ritual start', async () => {
    const day = await startDay('OFF_DUTY');
    const started = await startReset(day.id, 3);
    expect(started.status).toBe('COMPLETED');

    const [first, second] = await Promise.all([
      completeReset(day.id, started.commandId),
      completeReset(day.id, started.commandId),
    ]);
    expect(second.id).toBe(first.id);
    expect(
      await db.events
        .where('beyondDayId')
        .equals(day.id)
        .filter(
          (event) =>
            event.type === 'RESET_COMPLETED' && event.correlationId === started.commandId,
        )
        .count(),
    ).toBe(1);
    expect(
      await db.outcomes
        .where('beyondDayId')
        .equals(day.id)
        .filter((outcome) => outcome.commandExecutionId === started.commandId)
        .count(),
    ).toBe(1);

    await expect(completeReset(day.id, crypto.randomUUID())).rejects.toThrow(
      'RITUAL_NOT_STARTED',
    );
  });
});
