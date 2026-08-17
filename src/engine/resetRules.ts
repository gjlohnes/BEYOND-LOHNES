import type { ResetIntensity } from '../domain/reset/types';

export interface ResetGuidance {
  intensityBand: 'LOW' | 'STANDARD' | 'HIGH';
  instruction: string;
}

export function getResetGuidance(intensity: ResetIntensity): ResetGuidance {
  if (intensity <= 2) {
    return {
      intensityBand: 'LOW',
      instruction: 'Make one deliberate physical reset, then reassess.',
    };
  }
  if (intensity === 3) {
    return {
      intensityBand: 'STANDARD',
      instruction: 'Reduce input, address basic body needs, then reassess.',
    };
  }
  return {
    intensityBand: 'HIGH',
    instruction: 'Reduce demands and stay with physical state before analysis.',
  };
}
