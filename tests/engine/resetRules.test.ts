import { describe, expect, it } from 'vitest';
import { getResetGuidance } from '../../src/engine/resetRules';
import { getShiftDownSteps } from '../../src/engine/shiftDownRules';

describe('reset rules', () => {
  it('maps identical intensity to deterministic guidance', () => {
    expect(getResetGuidance(4)).toEqual(getResetGuidance(4));
    expect(getResetGuidance(1).intensityBand).toBe('LOW');
    expect(getResetGuidance(3).intensityBand).toBe('STANDARD');
    expect(getResetGuidance(5).intensityBand).toBe('HIGH');
  });

  it('keeps SHIFT DOWN deterministic and minimal', () => {
    expect(getShiftDownSteps().map((step) => step.id)).toEqual([
      'END_WORK_MODE',
      'BODY_NEEDS',
      'RETURN_ATTENTION',
    ]);
  });
});
