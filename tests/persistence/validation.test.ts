import { describe, expect, it } from 'vitest';
import { stateCheckInPayloadSchema } from '../../src/persistence/validation';

describe('persistence validation', () => {
  it('rejects invalid check-in records before persistence', () => {
    expect(() =>
      stateCheckInPayloadSchema.parse({
        id: crypto.randomUUID(),
        beyondDayId: crypto.randomUUID(),
        recordedAt: new Date().toISOString(),
        energy: 8,
        stress: 1,
        mood: 3,
        soreness: 0,
        alcoholUrge: 0,
      }),
    ).toThrow();
  });
});
