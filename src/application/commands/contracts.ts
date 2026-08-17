import type { ISODateTime, UUID } from '../../domain/common/types';
import type { DomainEvent } from '../../domain/common/events';
import type { CommandName } from '../../domain/recommendation/types';
import type { ResetIntensity } from '../../domain/reset/types';
import type { StateCheckIn } from '../../domain/checkin/types';

export type DomainErrorCode =
  | 'DAY_NOT_FOUND'
  | 'NO_ACTIVE_DAY'
  | 'INVALID_COMMAND_INPUT'
  | 'DUPLICATE_COMMAND'
  | 'UNSUPPORTED_COMMAND';

export type CommandInput =
  | { name: 'START_RESET'; input: { intensity: ResetIntensity } }
  | { name: 'START_SHIFT_DOWN'; input: Record<string, never> }
  | {
      name: 'REASSESS';
      input: Omit<StateCheckIn, 'id' | 'beyondDayId' | 'recordedAt'>;
    }
  | { name: Exclude<CommandName, 'START_RESET' | 'START_SHIFT_DOWN' | 'REASSESS'>; input: unknown };

export interface Command<TInput = unknown> {
  id: UUID;
  name: CommandName;
  beyondDayId?: UUID;
  issuedAt: ISODateTime;
  input: TInput;
}

export interface CommandResult {
  commandId: UUID;
  status: 'COMPLETED' | 'REJECTED' | 'FAILED';
  emittedEvents: DomainEvent[];
  errorCode?: DomainErrorCode;
}
