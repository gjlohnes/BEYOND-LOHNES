import { executeCommand } from '../commands/executeCommand';
import { db } from '../../persistence/db';
import {
  MINIMUM_DAY_ITEMS,
  type MinimumDayItemKey,
  type MinimumDayState,
} from '../../domain/minimumDay/types';

function numberFromPayload(payload: unknown, key: string): number {
  if (!payload || typeof payload !== 'object') return 0;
  const value = (payload as Record<string, unknown>)[key];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function minimumKeyFromPayload(payload: unknown): MinimumDayItemKey | null {
  if (!payload || typeof payload !== 'object') return null;
  const value = (payload as Record<string, unknown>).key;
  return MINIMUM_DAY_ITEMS.some((item) => item.key === value)
    ? (value as MinimumDayItemKey)
    : null;
}

export async function getMinimumDayState(dayId: string): Promise<MinimumDayState> {
  const events = await db.events.where('beyondDayId').equals(dayId).toArray();
  const enabled = events.some((event) => event.type === 'MINIMUM_DAY_ENABLED');
  const manual = new Set<MinimumDayItemKey>();
  let waterOz = 0;
  let proteinGrams = 0;

  for (const event of events) {
    if (event.type === 'WATER_LOGGED') waterOz += numberFromPayload(event.payload, 'amountOz');
    if (event.type === 'PROTEIN_ACTION_LOGGED')
      proteinGrams += numberFromPayload(event.payload, 'grams');
    if (event.type === 'MINIMUM_ITEM_COMPLETED') {
      const key = minimumKeyFromPayload(event.payload);
      if (key) manual.add(key);
    }
  }

  const recoverySessions = await db.workoutSessions
    .where('beyondDayId')
    .equals(dayId)
    .filter(
      (session) =>
        session.sessionType === 'RECOVERY' &&
        session.status !== 'ACTIVE' &&
        (session.durationMinutes ?? 0) > 0,
    )
    .toArray();
  const maxRecoveryMinutes = recoverySessions.reduce(
    (maximum, session) => Math.max(maximum, session.durationMinutes ?? 0),
    0,
  );

  return {
    enabled,
    items: MINIMUM_DAY_ITEMS.map((item) => {
      const automatic =
        (item.key === 'HYDRATE' && waterOz >= 40) ||
        (item.key === 'PROTEIN' && proteinGrams >= 25) ||
        (item.key === 'MOVE' && maxRecoveryMinutes >= 5) ||
        (item.key === 'RECOVER_CONNECT' && maxRecoveryMinutes >= 10);
      const manuallyComplete = manual.has(item.key);
      return {
        ...item,
        complete: automatic || manuallyComplete,
        source: automatic ? ('AUTO' as const) : manuallyComplete ? ('MANUAL' as const) : null,
      };
    }),
  };
}

export async function enableMinimumDay(dayId: string): Promise<MinimumDayState> {
  const existing = await getMinimumDayState(dayId);
  if (existing.enabled) return existing;
  const command = {
    id: crypto.randomUUID(),
    name: 'ENABLE_MINIMUM_DAY' as const,
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: {},
  };
  const result = await executeCommand(command);
  if (result.status !== 'COMPLETED')
    throw new Error(result.errorCode ?? 'ENABLE_MINIMUM_DAY_FAILED');
  return getMinimumDayState(dayId);
}

export async function completeMinimumItem(
  dayId: string,
  key: MinimumDayItemKey,
): Promise<MinimumDayState> {
  const existing = await getMinimumDayState(dayId);
  const current = existing.items.find((item) => item.key === key);
  if (current?.complete) return existing;
  const command = {
    id: crypto.randomUUID(),
    name: 'COMPLETE_MINIMUM_ITEM' as const,
    beyondDayId: dayId,
    issuedAt: new Date().toISOString(),
    input: { key },
  };
  const result = await executeCommand(command);
  if (result.status !== 'COMPLETED')
    throw new Error(result.errorCode ?? 'COMPLETE_MINIMUM_ITEM_FAILED');
  return getMinimumDayState(dayId);
}
