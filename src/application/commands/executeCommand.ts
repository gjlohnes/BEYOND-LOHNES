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

async function persistCommandResult(
  command: Command,
  result: CommandResult,
): Promise<CommandResult> {
  return db.transaction('rw', db.events, async () => {
    const duplicate = await db.events
      .filter((candidate) => candidate.correlationId === command.id)
      .first();
    if (duplicate) return rejected(command, 'DUPLICATE_COMMAND');
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
