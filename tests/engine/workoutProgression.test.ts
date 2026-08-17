import { describe, expect, it } from 'vitest';
import { deriveProgression } from '../../src/engine/workoutProgression';
import { WORKOUT_TEMPLATES } from '../../src/domain/workout/templates';
import type { PerformedSet } from '../../src/domain/workout/types';

const exercise=WORKOUT_TEMPLATES.A.exercises[0]!;
function set(ordinal:number,reps:number,weight=100):PerformedSet{return{id:crypto.randomUUID(),schemaVersion:1,beyondDayId:crypto.randomUUID(),workoutSessionId:crypto.randomUUID(),exerciseId:exercise.id,setOrdinal:ordinal,state:'COMPLETED',weight,reps,recordedAt:new Date().toISOString()};}

describe('workout progression',()=>{
  it('recommends the next available increment only when every required set reaches the top',()=>{expect(deriveProgression(exercise,[set(1,12),set(2,12),set(3,12)]).action).toBe('INCREASE_NEXT_AVAILABLE');});
  it('holds on mixed or incomplete evidence',()=>{expect(deriveProgression(exercise,[set(1,12),set(2,10),set(3,9)]).action).toBe('HOLD');expect(deriveProgression(exercise,[set(1,12)]).action).toBe('HOLD');});
  it('suggests reduction only when every required set is below minimum',()=>{expect(deriveProgression(exercise,[set(1,7),set(2,6),set(3,7)]).action).toBe('REDUCE_NEXT_AVAILABLE');});
});
