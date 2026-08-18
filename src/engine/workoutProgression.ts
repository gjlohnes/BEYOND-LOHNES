import type { PerformedSet, ProgressionSuggestion, WorkoutExerciseTemplate } from '../domain/workout/types';

export function deriveProgression(
  exercise: WorkoutExerciseTemplate,
  priorSets: PerformedSet[],
): ProgressionSuggestion {
  if (priorSets.length === 0) {
    return { action: 'NO_HISTORY', reason: 'No prior standard-session performance exists.', evidence: [] };
  }

  const ordered = [...priorSets].sort((a, b) => a.setOrdinal - b.setOrdinal);
  const completed = ordered.filter((set) => set.state === 'COMPLETED');
  if (completed.length !== exercise.setCount || ordered.some((set) => set.state === 'SKIPPED')) {
    return {
      action: 'HOLD',
      reason: 'Prior evidence is incomplete or includes skipped work; hold rather than infer progression.',
      evidence: ordered,
    };
  }

  const firstWeight = completed[0]?.weight;
  if (firstWeight === undefined || completed.some((set) => set.weight !== firstWeight)) {
    return {
      action: 'HOLD',
      reason: 'Prior working sets used mixed loads; hold until a comparable set pattern exists.',
      evidence: ordered,
    };
  }

  if (completed.every((set) => (set.reps ?? 0) >= exercise.repMax)) {
    return {
      action: 'INCREASE_NEXT_AVAILABLE',
      reason: `All ${exercise.setCount} required sets reached the top of the ${exercise.repMin}–${exercise.repMax} range at the same load.`,
      evidence: ordered,
    };
  }

  if (completed.every((set) => (set.reps ?? 0) < exercise.repMin)) {
    return {
      action: 'REDUCE_NEXT_AVAILABLE',
      reason: `Every required set fell below the ${exercise.repMin}–${exercise.repMax} target range at the logged load.`,
      evidence: ordered,
    };
  }

  return {
    action: 'HOLD',
    reason: `Performance does not yet qualify for a load change within the ${exercise.repMin}–${exercise.repMax} target range.`,
    evidence: ordered,
  };
}
