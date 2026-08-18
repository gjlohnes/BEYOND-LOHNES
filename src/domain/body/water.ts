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

function correctionPayload(event: DomainEvent) {
  if (event.type !== 'WATER_LOG_CORRECTED' || !event.payload || typeof event.payload !== 'object')
    return null;
  const { originalEventId, supersedesEventId } = event.payload as {
    originalEventId?: unknown;
    supersedesEventId?: unknown;
  };
  const amountOz = positiveAmount(event.payload);
  if (
    typeof originalEventId !== 'string' ||
    typeof supersedesEventId !== 'string' ||
    amountOz === null
  )
    return null;
  return { originalEventId, supersedesEventId, amountOz };
}

export function deriveEffectiveWaterEntries(events: DomainEvent[]): WaterEntry[] {
  const originals = events
    .filter((event) => event.type === 'WATER_LOGGED')
    .map((event) => ({ event, amountOz: positiveAmount(event.payload) }))
    .filter((candidate): candidate is { event: DomainEvent; amountOz: number } => candidate.amountOz !== null);

  const correctionsByOriginal = new Map<string, DomainEvent[]>();
  for (const event of events) {
    const payload = correctionPayload(event);
    if (!payload) continue;
    const group = correctionsByOriginal.get(payload.originalEventId) ?? [];
    group.push(event);
    correctionsByOriginal.set(payload.originalEventId, group);
  }

  return originals
    .map(({ event: original, amountOz }) => {
      let entry: WaterEntry = {
        originalEventId: original.id,
        currentEventId: original.id,
        amountOz,
        loggedAt: original.occurredAt,
        correctionCount: 0,
      };
      const remaining = new Map(
        (correctionsByOriginal.get(original.id) ?? []).map((correction) => [correction.id, correction]),
      );

      while (remaining.size > 0) {
        const next = [...remaining.values()].filter(
          (candidate) => correctionPayload(candidate)?.supersedesEventId === entry.currentEventId,
        );
        if (next.length !== 1) break;
        const candidate = next[0];
        const payload = correctionPayload(candidate)!;
        entry = {
          ...entry,
          currentEventId: candidate.id,
          amountOz: payload.amountOz,
          correctedAt: candidate.occurredAt,
          correctionCount: entry.correctionCount + 1,
        };
        remaining.delete(candidate.id);
      }

      return entry;
    })
    .sort(
      (a, b) => a.loggedAt.localeCompare(b.loggedAt) || a.originalEventId.localeCompare(b.originalEventId),
    );
}

export function effectiveWaterTotal(events: DomainEvent[]) {
  return deriveEffectiveWaterEntries(events).reduce((total, entry) => total + entry.amountOz, 0);
}
