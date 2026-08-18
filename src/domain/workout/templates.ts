import type { WorkoutTemplate, WorkoutTemplateId } from './types';

export const WORKOUT_TEMPLATES: Record<WorkoutTemplateId, WorkoutTemplate> = {
  A: {
    id: 'A',
    emphasis: 'Chest',
    exercises: [
      { id: 'chest_press', name: 'Machine Chest Press', setCount: 3, repMin: 8, repMax: 12, required: true },
      { id: 'pec_deck', name: 'Pec Deck', setCount: 3, repMin: 10, repMax: 15, required: true },
      { id: 'leg_press', name: 'Leg Press', setCount: 3, repMin: 8, repMax: 12, required: true },
      { id: 'triceps_pressdown', name: 'Triceps Pressdown', setCount: 2, repMin: 10, repMax: 15, required: true },
    ],
  },
  B: {
    id: 'B',
    emphasis: 'Back',
    exercises: [
      { id: 'lat_pulldown', name: 'Lat Pulldown', setCount: 3, repMin: 8, repMax: 12, required: true },
      { id: 'seated_cable_row', name: 'Seated Cable Row', setCount: 3, repMin: 8, repMax: 12, required: true },
      { id: 'leg_curl', name: 'Leg Curl', setCount: 3, repMin: 10, repMax: 15, required: true },
      { id: 'preacher_curl', name: 'Preacher Curl', setCount: 2, repMin: 10, repMax: 15, required: true },
    ],
  },
  C: {
    id: 'C',
    emphasis: 'Arms / Shoulders',
    exercises: [
      { id: 'machine_shoulder_press', name: 'Machine Shoulder Press', setCount: 3, repMin: 8, repMax: 12, required: true },
      { id: 'preacher_curl', name: 'Preacher Curl', setCount: 3, repMin: 10, repMax: 15, required: true },
      { id: 'triceps_pressdown', name: 'Triceps Pressdown', setCount: 3, repMin: 10, repMax: 15, required: true },
      { id: 'reverse_pec_deck', name: 'Reverse Pec Deck', setCount: 3, repMin: 12, repMax: 15, required: true },
    ],
  },
};

export function nextWorkoutTemplateId(previous?: WorkoutTemplateId): WorkoutTemplateId {
  if (!previous) return 'A';
  if (previous === 'A') return 'B';
  if (previous === 'B') return 'C';
  return 'A';
}

export function getWorkoutTemplate(id: WorkoutTemplateId): WorkoutTemplate {
  return WORKOUT_TEMPLATES[id];
}
