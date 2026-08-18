import { db } from '../../persistence/db';
import type { Command, CommandResult, DomainErrorCode } from './contracts';
import type { DomainEvent } from '../../domain/common/events';
import type { ResetIntensity } from '../../domain/reset/types';
import { assertValidEvent } from '../../persistence/validation';

const MINIMUM_ITEM_KEYS = [
  'HYDRATE',
  'PROTEIN',
  'MEDS',
  'HYGIENE',
  'MOVE',
  'RECOVER_CONNECT',
] as const;

type MinimumItemKey = (typeof MINIMUM_ITEM_KEYS)[number];

function event(
  type: DomainEvent['type'],
  command: Command,
  source: DomainEvent['source'],
  payload: unknown,
  causationId?: string,
): DomainEvent {
  const now = new Date().toISOString();
  return assertValidEvent({
    id: crypto.randomUUID(),
    schemaVersion: 1,
    type,
    ...(command.beyondDayId ? { beyondDayId: command.beyondDayId } : {}),
    occurredAt: now,
    recordedAt: now,
    payload,
    source,
    correlationId: command.id,
    ...(causationId ? { causationId } : {}),
  }) as DomainEvent;
}

function rejected(command: Command, errorCode: DomainErrorCode): CommandResult {
  return { commandId: command.id, status: 'REJECTED', emittedEvents: [], errorCode };
}

function positiveNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function positiveWholeNumber(value: unknown): value is number {
  return positiveNumber(value) && Number.isInteger(value);
}

function isMinimumItemKey(value: unknown): value is MinimumItemKey {
  return typeof value === 'string' && MINIMUM_ITEM_KEYS.includes(value as MinimumItemKey);
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  );
}

function waterAmount(event: DomainEvent | undefined) {
  if (!event || !event.payload || typeof event.payload !== 'object') return null;
  const amountOz = (event.payload as { amountOz?: unknown }).amountOz;
  return typeof amountOz === 'number' && Number.isFinite(amountOz) && amountOz > 0
    ? amountOz
    : null;
}

async function correctionTargetIsCurrent(
  beyondDayId: string,
  originalEventId: string,
  supersedesEventId: string,
) {
  const events = await db.events.where('beyondDayId').equals(beyondDayId).toArray();
  const original = events.find(
    (candidate) => candidate.id === originalEventId && candidate.type === 'WATER_LOGGED',
  );
  if (!original) return false;

  const remaining = new Map(
    events
      .filter((candidate) => {
        if (candidate.type !== 'WATER_LOG_CORRECTED') return false;
        return (candidate.payload as { originalEventId?: unknown }).originalEventId === originalEventId;
      })
      .map((candidate) => [candidate.id, candidate]),
  );
  let currentEventId = original.id;

  while (remaining.size > 0) {
    const next = [...remaining.values()].filter(
      (candidate) =>
        (candidate.payload as { supersedesEventId?: unknown }).supersedesEventId === currentEventId,
    );
    if (next.length !== 1) return false;
    const nextEvent = next[0];
    if (!nextEvent) return false;
    currentEventId = nextEvent.id;
    remaining.delete(nextEvent.id);
  }

  return currentEventId === supersedesEventId;
}

async function persistCommandResult(
  command: Command,
  result: CommandResult,
): Promise<CommandResult> {
  return db.transaction('rw', db.events, async () => {
    const duplicate = await db.events
      .filter((candidate) => candidate.correlationId === command.id)
      .first();
    if (duplicate) return rejected(command, 'DUPLICATE_COMMAND');

    if (
      command.name === 'MARK_WORK_ENDED' &&
      command.beyondDayId &&
      result.emittedEvents.some((candidate) => candidate.type === 'WORK_PERIOD_ENDED')
    ) {
      const alreadyEnded = await db.events
        .where('beyondDayId')
        .equals(command.beyondDayId)
        .filter((candidate) => candidate.type === 'WORK_PERIOD_ENDED')
        .first();
      if (alreadyEnded) return rejected(command, 'WORK_ALREADY_ENDED');
    }

    const correction = result.emittedEvents.find(
      (candidate) => candidate.type === 'WATER_LOG_CORRECTED',
    );
    if (correction && command.beyondDayId) {
      const payload = correction.payload as {
        originalEventId: string;
        supersedesEventId: string;
        amountOz: number;
      };
      if (
        !(await correctionTargetIsCurrent(
          command.beyondDayId,
          payload.originalEventId,
          payload.supersedesEventId,
        ))
      ) {
        return rejected(command, 'STALE_CORRECTION_TARGET');
      }
      const target = await db.events.get(payload.supersedesEventId);
      if (waterAmount(target) === payload.amountOz) {
        return rejected(command, 'NO_CORRECTION_CHANGE');
      }
    }

    if (result.emittedEvents.length > 0) await db.events.bulkAdd(result.emittedEvents);
    return result;
  });
}

function invalidInput(command: Command, started: DomainEvent): Promise<CommandResult> {
  const aborted = event(
    'COMMAND_ABORTED',
    command,
    'SYSTEM',
    { commandName: command.name, errorCode: 'INVALID_COMMAND_INPUT' },
    started.id,
  );
  return persistCommandResult(command, {
    commandId: command.id,
    status: 'REJECTED',
    emittedEvents: [started, aborted],
    errorCode: 'INVALID_COMMAND_INPUT',
  });
}

export async function executeCommand(
  command: Command,
  options: { recommendationId?: string } = {},
): Promise<CommandResult> {
  if (!command.beyondDayId) return rejected(command, 'NO_ACTIVE_DAY');

  const day = await db.beyondDays.get(command.beyondDayId);
  if (!day || day.status !== 'ACTIVE') return rejected(command, 'DAY_NOT_FOUND');

  if (command.name === 'MARK_WORK_ENDED') {
    if (day.workContext !== 'WORK') return rejected(command, 'WORK_CONTEXT_REQUIRED');
    const alreadyEnded = await db.events
      .where('beyondDayId')
      .equals(command.beyondDayId)
      .filter((candidate) => candidate.type === 'WORK_PERIOD_ENDED')
      .first();
    if (alreadyEnded) return rejected(command, 'WORK_ALREADY_ENDED');
  }

  const started = event(
    'COMMAND_STARTED',
    command,
    'USER',
    {
      commandName: command.name,
      ...(options.recommendationId ? { recommendationId: options.recommendationId } : {}),
    },
    options.recommendationId,
  );

  const emitted: DomainEvent[] = [started];

  if (command.name === 'START_RESET') {
    const intensity = (command.input as { intensity?: number }).intensity;
    if (
      typeof intensity !== 'number' ||
      !Number.isInteger(intensity) ||
      intensity < 1 ||
      intensity > 5
    )
      return invalidInput(command, started);
    emitted.push(
      event(
        'RESET_STARTED',
        command,
        'USER',
        {
          commandId: command.id,
          intensity: intensity as ResetIntensity,
          ...(options.recommendationId ? { recommendationId: options.recommendationId } : {}),
        },
        started.id,
      ),
    );
  } else if (command.name === 'START_SHIFT_DOWN') {
    emitted.push(
      event(
        'SHIFT_DOWN_STARTED',
        command,
        'USER',
        {
          commandId: command.id,
          ...(options.recommendationId ? { recommendationId: options.recommendationId } : {}),
        },
        started.id,
      ),
    );
  } else if (command.name === 'MARK_WORK_ENDED') {
    emitted.push(
      event(
        'WORK_PERIOD_ENDED',
        command,
        'USER',
        { commandId: command.id },
        started.id,
      ),
    );
  } else if (command.name === 'ENABLE_MINIMUM_DAY') {
    emitted.push(
      event(
        'MINIMUM_DAY_ENABLED',
        command,
        'USER',
        { commandId: command.id },
        started.id,
      ),
    );
  } else if (command.name === 'COMPLETE_MINIMUM_ITEM') {
    const key = (command.input as { key?: unknown }).key;
    if (!isMinimumItemKey(key)) return invalidInput(command, started);
    emitted.push(
      event(
        'MINIMUM_ITEM_COMPLETED',
        command,
        'USER',
        { commandId: command.id, key },
        started.id,
      ),
    );
  } else if (command.name === 'LOG_WATER') {
    const amountOz = (command.input as { amountOz?: unknown }).amountOz;
    if (!positiveNumber(amountOz)) return invalidInput(command, started);
    emitted.push(
      event(
        'WATER_LOGGED',
        command,
        'USER',
        { commandId: command.id, amountOz },
        started.id,
      ),
    );
  } else if (command.name === 'CORRECT_WATER_LOG') {
    const { originalEventId, supersedesEventId, amountOz } = command.input as {
      originalEventId?: unknown;
      supersedesEventId?: unknown;
      amountOz?: unknown;
    };
    if (!isUuid(originalEventId) || !isUuid(supersedesEventId) || !positiveNumber(amountOz))
      return invalidInput(command, started);
    emitted.push(
      event(
        'WATER_LOG_CORRECTED',
        command,
        'USER',
        { commandId: command.id, originalEventId, supersedesEventId, amountOz },
        started.id,
      ),
    );
  } else if (command.name === 'PROTEIN_ACTION') {
    const grams = (command.input as { grams?: unknown }).grams;
    if (!positiveNumber(grams)) return invalidInput(command, started);
    emitted.push(
      event(
        'PROTEIN_ACTION_LOGGED',
        command,
        'USER',
        { commandId: command.id, grams },
        started.id,
      ),
    );
  } else if (command.name === 'LOG_SLEEP') {
    const durationMinutes = (command.input as { durationMinutes?: unknown }).durationMinutes;
    if (!positiveWholeNumber(durationMinutes)) return invalidInput(command, started);
    emitted.push(
      event(
        'SLEEP_LOGGED',
        command,
        'USER',
        { commandId: command.id, durationMinutes },
        started.id,
      ),
    );
  } else if (command.name !== 'REASSESS') {
    const aborted = event(
      'COMMAND_ABORTED',
      command,
      'SYSTEM',
      { commandName: command.name, errorCode: 'UNSUPPORTED_COMMAND' },
      started.id,
    );
    return persistCommandResult(command, {
      commandId: command.id,
      status: 'REJECTED',
      emittedEvents: [started, aborted],
      errorCode: 'UNSUPPORTED_COMMAND',
    });
  }

  const completed = event(
    'COMMAND_COMPLETED',
    command,
    'SYSTEM',
    { commandName: command.name },
    started.id,
  );
  emitted.push(completed);

  return persistCommandResult(command, {
    commandId: command.id,
    status: 'COMPLETED',
    emittedEvents: emitted,
  });
}
