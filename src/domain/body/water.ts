import type { DomainEvent } from '../common/events';

export interface WaterEntry {
  originalEventId: string;
  currentEventId: string;
  amountOz: number;
  loggedAt: string;
  correctedAt?: string;
  correctionCount: number;
}

function positiveAmount(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const amountOz = (payload as { amountOz?: unknown }).amountOz;
  return typeof amountOz === 'number' && Number.isFinite(amountOz) && amountOz > 0
    ? amountOz
    : null;
}

export function compareDomainEvents(a: DomainEvent, b: DomainEvent) {
  return (
    a.occurredAt.localeCompare(b.occurredAt) ||
    a.recordedAt.localeCompare(b.recordedAt) ||
    a.id.localeCompare(b.id)
  );
}

export function deriveEffectiveWaterEntries(events: DomainEvent[]): WaterEntry[] {
  const entries = new Map<string, WaterEntry>();

  for (const event of [...events].sort(compareDomainEvents)) {
    if (event.type === 'WATER_LOGGED') {
      const amountOz = positiveAmount(event.payload);
      if (amountOz === null) continue;
      entries.set(event.id, {
        originalEventId: event.id,
        currentEventId: event.id,
        amountOz,
        loggedAt: event.occurredAt,
        correctionCount: 0,
      });
      continue;
    }

    if (event.type !== 'WATER_LOG_CORRECTED') continue;
    const payload = event.payload as {
      originalEventId?: unknown;
      supersedesEventId?: unknown;
      amountOz?: unknown;
    };
    if (typeof payload.originalEventId !== 'string' || typeof payload.supersedesEventId !== 'string')
      continue;
    const amountOz = positiveAmount(event.payload);
    if (amountOz === null) continue;
    const entry = entries.get(payload.originalEventId);
    if (!entry || entry.currentEventId !== payload.supersedesEventId) continue;
    entries.set(payload.originalEventId, {
      ...entry,
      currentEventId: event.id,
      amountOz,
      correctedAt: event.occurredAt,
      correctionCount: entry.correctionCount + 1,
    });
  }

  return [...entries.values()].sort(
    (a, b) => a.loggedAt.localeCompare(b.loggedAt) || a.originalEventId.localeCompare(b.originalEventId),
  );
}

export function effectiveWaterTotal(events: DomainEvent[]) {
  return deriveEffectiveWaterEntries(events).reduce((total, entry) => total + entry.amountOz, 0);
}
