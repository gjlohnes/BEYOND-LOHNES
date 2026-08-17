import { db } from '../../persistence/db';
import type { Command, CommandResult, DomainErrorCode } from './contracts';
import type { DomainEvent } from '../../domain/common/events';
import type { ResetIntensity } from '../../domain/reset/types';
import { assertValidEvent } from '../../persistence/validation';

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

export async function executeCommand(
  command: Command,
  options: { recommendationId?: string } = {},
): Promise<CommandResult> {
  if (!command.beyondDayId) return rejected(command, 'NO_ACTIVE_DAY');

  const day = await db.beyondDays.get(command.beyondDayId);
  if (!day || day.status !== 'ACTIVE') return rejected(command, 'DAY_NOT_FOUND');

  const duplicate = await db.events
    .filter((candidate) => candidate.correlationId === command.id)
    .first();
  if (duplicate) return rejected(command, 'DUPLICATE_COMMAND');

  const started = event(
    'COMMAND_STARTED',
    command,
    'USER',
    { commandName: command.name, ...(options.recommendationId ? { recommendationId: options.recommendationId } : {}) },
    options.recommendationId,
  );

  const emitted: DomainEvent[] = [started];

  if (command.name === 'START_RESET') {
    const intensity = (command.input as { intensity?: number }).intensity;
    if (typeof intensity !== 'number' || !Number.isInteger(intensity) || intensity < 1 || intensity > 5) {
      const aborted = event(
        'COMMAND_ABORTED',
        command,
        'SYSTEM',
        { commandName: command.name, errorCode: 'INVALID_COMMAND_INPUT' },
        started.id,
      );
      await db.events.bulkAdd([started, aborted]);
      return {
        commandId: command.id,
        status: 'REJECTED',
        emittedEvents: [started, aborted],
        errorCode: 'INVALID_COMMAND_INPUT',
      };
    }
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
  } else if (command.name !== 'REASSESS') {
    const aborted = event(
      'COMMAND_ABORTED',
      command,
      'SYSTEM',
      { commandName: command.name, errorCode: 'UNSUPPORTED_COMMAND' },
      started.id,
    );
    await db.events.bulkAdd([started, aborted]);
    return {
      commandId: command.id,
      status: 'REJECTED',
      emittedEvents: [started, aborted],
      errorCode: 'UNSUPPORTED_COMMAND',
    };
  }

  const completed = event(
    'COMMAND_COMPLETED',
    command,
    'SYSTEM',
    { commandName: command.name },
    started.id,
  );
  emitted.push(completed);

  await db.events.bulkAdd(emitted);
  return { commandId: command.id, status: 'COMPLETED', emittedEvents: emitted };
}
