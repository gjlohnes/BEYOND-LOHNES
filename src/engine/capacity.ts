import type { StateCheckIn } from '../domain/checkin/types';
import type { Capacity } from '../domain/common/types';
export type CapacityReason = 'ENERGY_SEVERE'|'STRESS_SEVERE'|'MOOD_SEVERE'|'ALCOHOL_URGE_SEVERE'|'ENERGY_CONSTRAINED'|'STRESS_CONSTRAINED'|'MOOD_CONSTRAINED'|'SORENESS_CONSTRAINED'|'ALCOHOL_URGE_CONSTRAINED'|'BASELINE_CLEAR';
export interface CapacityResult { capacity: Capacity; reasons: CapacityReason[]; }
export function deriveCapacity(c: StateCheckIn): CapacityResult {
  const severe: CapacityReason[] = [];
  if (c.energy === 1) severe.push('ENERGY_SEVERE');
  if (c.stress === 5) severe.push('STRESS_SEVERE');
  if (c.mood === 1) severe.push('MOOD_SEVERE');
  if (c.alcoholUrge >= 4) severe.push('ALCOHOL_URGE_SEVERE');
  if (severe.length) return { capacity: 'RED', reasons: severe };
  const constrained: CapacityReason[] = [];
  if (c.energy <= 2) constrained.push('ENERGY_CONSTRAINED');
  if (c.stress >= 4) constrained.push('STRESS_CONSTRAINED');
  if (c.mood <= 2) constrained.push('MOOD_CONSTRAINED');
  if (c.soreness >= 4) constrained.push('SORENESS_CONSTRAINED');
  if (c.alcoholUrge >= 2) constrained.push('ALCOHOL_URGE_CONSTRAINED');
  return constrained.length ? { capacity: 'YELLOW', reasons: constrained } : { capacity: 'GREEN', reasons: ['BASELINE_CLEAR'] };
}
