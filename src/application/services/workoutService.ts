import Dexie from 'dexie';
import { db } from '../../persistence/db';
import { assertValidEvent, assertValidOutcome, assertValidPerformedSet, assertValidWorkoutSession } from '../../persistence/validation';
import { getWorkoutTemplate, nextWorkoutTemplateId, WORKOUT_TEMPLATES } from '../../domain/workout/templates';
import type { DomainEvent } from '../../domain/common/events';
import type { CommandName, Outcome } from '../../domain/recommendation/types';
import type { PerformedSet, ProgressionSuggestion, WorkoutSession, WorkoutTemplate, WorkoutTemplateId } from '../../domain/workout/types';
import { deriveProgression } from '../../engine/workoutProgression';

function commandEvent(type: DomainEvent['type'], dayId: string, commandId: string, commandName: CommandName, payload: Record<string, unknown>, source: DomainEvent['source'], causationId?: string) {
  const now = new Date().toISOString();
  return assertValidEvent({id:crypto.randomUUID(),schemaVersion:1,type,beyondDayId:dayId,occurredAt:now,recordedAt:now,payload,source,correlationId:commandId,...(causationId?{causationId}:{})});
}

async function latestRotationSession(): Promise<WorkoutSession | undefined> {
  const sessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
  return sessions.find((session)=>session.sessionType!=='RECOVERY'&&(session.status==='COMPLETED'||session.status==='PARTIAL'));
}

export async function getNextWorkoutTemplateId(): Promise<WorkoutTemplateId> {
  const latest = await latestRotationSession();
  return nextWorkoutTemplateId(latest?.templateId);
}

export async function getActiveWorkout(dayId: string) {
  const candidate = await db.workoutSessions.where('beyondDayId').equals(dayId).filter((session)=>session.status==='ACTIVE').first();
  return candidate ? assertValidWorkoutSession(candidate) : null;
}

export async function startWorkout(dayId: string): Promise<WorkoutSession> {
  return db.transaction('rw',db.beyondDays,db.workoutSessions,db.events,async()=>{
    const day=await db.beyondDays.get(dayId);
    if(!day||day.status!=='ACTIVE')throw new Error('DAY_NOT_FOUND');
    const active=await db.workoutSessions.where('beyondDayId').equals(dayId).filter((session)=>session.status==='ACTIVE').first();
    if(active)return assertValidWorkoutSession(active);
    const latest=await db.workoutSessions.orderBy('startedAt').reverse().filter((session)=>session.sessionType!=='RECOVERY'&&(session.status==='COMPLETED'||session.status==='PARTIAL')).first();
    const templateId=nextWorkoutTemplateId(latest?.templateId);
    const now=new Date().toISOString();
    const commandId=crypto.randomUUID();
    const session=assertValidWorkoutSession({id:crypto.randomUUID(),schemaVersion:1,beyondDayId:dayId,templateId,sessionType:'STANDARD',status:'ACTIVE',startedAt:now});
    const started=commandEvent('COMMAND_STARTED',dayId,commandId,'START_WORKOUT',{commandName:'START_WORKOUT'},'USER');
    const workoutStarted=commandEvent('WORKOUT_STARTED',dayId,commandId,'START_WORKOUT',{commandId,sessionId:session.id,templateId,sessionType:'STANDARD'},'USER',started.id);
    const completed=commandEvent('COMMAND_COMPLETED',dayId,commandId,'START_WORKOUT',{commandName:'START_WORKOUT'},'SYSTEM',started.id);
    await db.workoutSessions.add(session);
    await db.events.bulkAdd([started,workoutStarted,completed]);
    return session;
  });
}

function findExercise(session: WorkoutSession, exerciseId: string) {
  if(!session.templateId)throw new Error('WORKOUT_TEMPLATE_REQUIRED');
  const exercise=getWorkoutTemplate(session.templateId).exercises.find((candidate)=>candidate.id===exerciseId);
  if(!exercise)throw new Error('EXERCISE_NOT_IN_WORKOUT');
  return exercise;
}

export async function logWorkoutSet(sessionId:string,exerciseId:string,setOrdinal:number,weight:number,reps:number):Promise<PerformedSet>{
  return db.transaction('rw',db.workoutSessions,db.performedSets,db.events,async()=>{
    const sessionRaw=await db.workoutSessions.get(sessionId);
    if(!sessionRaw)throw new Error('WORKOUT_NOT_FOUND');
    const session=assertValidWorkoutSession(sessionRaw);
    if(session.status!=='ACTIVE')throw new Error('WORKOUT_NOT_ACTIVE');
    const exercise=findExercise(session,exerciseId);
    if(!Number.isInteger(setOrdinal)||setOrdinal<1||setOrdinal>exercise.setCount)throw new Error('INVALID_SET_ORDINAL');
    if(!Number.isFinite(weight)||weight<0||!Number.isInteger(reps)||reps<1)throw new Error('INVALID_SET_INPUT');
    const duplicate=await db.performedSets.where('[workoutSessionId+exerciseId]').equals([sessionId,exerciseId]).filter((set)=>set.setOrdinal===setOrdinal).first();
    if(duplicate)return assertValidPerformedSet(duplicate);
    const now=new Date().toISOString();const commandId=crypto.randomUUID();
    const set=assertValidPerformedSet({id:crypto.randomUUID(),schemaVersion:1,beyondDayId:session.beyondDayId,workoutSessionId:session.id,exerciseId,setOrdinal,state:'COMPLETED',weight,reps,recordedAt:now});
    const started=commandEvent('COMMAND_STARTED',session.beyondDayId,commandId,'LOG_WORKOUT_SET',{commandName:'LOG_WORKOUT_SET'},'USER');
    const recorded=commandEvent('WORKOUT_SET_RECORDED',session.beyondDayId,commandId,'LOG_WORKOUT_SET',{commandId,sessionId:session.id,setId:set.id,exerciseId,setOrdinal},'USER',started.id);
    const completed=commandEvent('COMMAND_COMPLETED',session.beyondDayId,commandId,'LOG_WORKOUT_SET',{commandName:'LOG_WORKOUT_SET'},'SYSTEM',started.id);
    await db.performedSets.add(set);await db.events.bulkAdd([started,recorded,completed]);return set;
  });
}

export async function skipWorkoutSet(sessionId:string,exerciseId:string,setOrdinal:number):Promise<PerformedSet>{
  return db.transaction('rw',db.workoutSessions,db.performedSets,db.events,async()=>{
    const sessionRaw=await db.workoutSessions.get(sessionId);if(!sessionRaw)throw new Error('WORKOUT_NOT_FOUND');const session=assertValidWorkoutSession(sessionRaw);if(session.status!=='ACTIVE')throw new Error('WORKOUT_NOT_ACTIVE');const exercise=findExercise(session,exerciseId);if(!Number.isInteger(setOrdinal)||setOrdinal<1||setOrdinal>exercise.setCount)throw new Error('INVALID_SET_ORDINAL');
    const duplicate=await db.performedSets.where('[workoutSessionId+exerciseId]').equals([sessionId,exerciseId]).filter((set)=>set.setOrdinal===setOrdinal).first();if(duplicate)return assertValidPerformedSet(duplicate);
    const now=new Date().toISOString();const commandId=crypto.randomUUID();const set=assertValidPerformedSet({id:crypto.randomUUID(),schemaVersion:1,beyondDayId:session.beyondDayId,workoutSessionId:session.id,exerciseId,setOrdinal,state:'SKIPPED',recordedAt:now});
    const started=commandEvent('COMMAND_STARTED',session.beyondDayId,commandId,'SKIP_WORKOUT_SET',{commandName:'SKIP_WORKOUT_SET'},'USER');const skipped=commandEvent('WORKOUT_SET_SKIPPED',session.beyondDayId,commandId,'SKIP_WORKOUT_SET',{commandId,sessionId:session.id,setId:set.id,exerciseId,setOrdinal},'USER',started.id);const completed=commandEvent('COMMAND_COMPLETED',session.beyondDayId,commandId,'SKIP_WORKOUT_SET',{commandName:'SKIP_WORKOUT_SET'},'SYSTEM',started.id);
    await db.performedSets.add(set);await db.events.bulkAdd([started,skipped,completed]);return set;
  });
}

export async function completeWorkout(sessionId:string):Promise<WorkoutSession>{
  return db.transaction('rw',db.workoutSessions,db.performedSets,db.events,db.outcomes,async()=>{
    const sessionRaw=await db.workoutSessions.get(sessionId);if(!sessionRaw)throw new Error('WORKOUT_NOT_FOUND');const session=assertValidWorkoutSession(sessionRaw);if(session.status!=='ACTIVE')return session;
    if(!session.templateId)throw new Error('WORKOUT_TEMPLATE_REQUIRED');const template=getWorkoutTemplate(session.templateId);const sets=await db.performedSets.where('workoutSessionId').equals(session.id).toArray();const planned=template.exercises.reduce((total,exercise)=>total+exercise.setCount,0);const completedCount=sets.filter((set)=>set.state==='COMPLETED').length;
    const status:WorkoutSession['status']=completedCount===planned?'COMPLETED':sets.length>0?'PARTIAL':'ABANDONED';const now=new Date().toISOString();const commandId=crypto.randomUUID();const closed=assertValidWorkoutSession({...session,status,endedAt:now});
    const started=commandEvent('COMMAND_STARTED',session.beyondDayId,commandId,'COMPLETE_WORKOUT',{commandName:'COMPLETE_WORKOUT'},'USER');const domain=commandEvent(status==='ABANDONED'?'WORKOUT_ABANDONED':'WORKOUT_COMPLETED',session.beyondDayId,commandId,'COMPLETE_WORKOUT',{commandId,sessionId:session.id,status},'USER',started.id);const completed=commandEvent('COMMAND_COMPLETED',session.beyondDayId,commandId,'COMPLETE_WORKOUT',{commandName:'COMPLETE_WORKOUT'},'SYSTEM',started.id);
    const outcome:Outcome=assertValidOutcome({id:crypto.randomUUID(),commandExecutionId:commandId,beyondDayId:session.beyondDayId,recordedAt:now,result:status==='COMPLETED'?'COMPLETED':status==='PARTIAL'?'PARTIAL':'ABANDONED'});
    await db.workoutSessions.put(closed);await db.events.bulkAdd([started,domain,completed]);await db.outcomes.add(outcome);return closed;
  });
}

async function previousStandardSets(exerciseId:string,beforeStartedAt?:string):Promise<PerformedSet[]>{
  const candidates=await db.performedSets.where('[exerciseId+recordedAt]').between([exerciseId,Dexie.minKey],[exerciseId,beforeStartedAt??Dexie.maxKey],false,true).reverse().toArray();
  for(const candidate of candidates){const sessionRaw=await db.workoutSessions.get(candidate.workoutSessionId);if(!sessionRaw)continue;const session=assertValidWorkoutSession(sessionRaw);if(session.sessionType!=='STANDARD'||session.status==='ACTIVE'||session.status==='ABANDONED')continue;const sets=await db.performedSets.where('[workoutSessionId+exerciseId]').equals([session.id,exerciseId]).toArray();return sets.map(assertValidPerformedSet).sort((a,b)=>a.setOrdinal-b.setOrdinal);}
  return [];
}

export interface ExerciseGuidance { exerciseId:string; previous:PerformedSet[]; progression:ProgressionSuggestion; }
export interface TrainDashboard { dayId:string|null; nextTemplate:WorkoutTemplate; activeWorkout:WorkoutSession|null; activeTemplate:WorkoutTemplate|null; activeSets:PerformedSet[]; guidance:ExerciseGuidance[]; history:WorkoutSession[]; }

export async function getTrainDashboard():Promise<TrainDashboard>{
  const day=await db.beyondDays.where('status').equals('ACTIVE').first();const nextId=await getNextWorkoutTemplateId();const nextTemplate=WORKOUT_TEMPLATES[nextId];if(!day)return{dayId:null,nextTemplate,activeWorkout:null,activeTemplate:null,activeSets:[],guidance:[],history:[]};
  const activeWorkout=await getActiveWorkout(day.id);const activeTemplate=activeWorkout?.templateId?getWorkoutTemplate(activeWorkout.templateId):null;const activeSets=activeWorkout?await db.performedSets.where('workoutSessionId').equals(activeWorkout.id).toArray():[];const templateForGuidance=activeTemplate??nextTemplate;const guidance:ExerciseGuidance[]=[];
  for(const exercise of templateForGuidance.exercises){const previous=await previousStandardSets(exercise.id,activeWorkout?.startedAt);guidance.push({exerciseId:exercise.id,previous,progression:deriveProgression(exercise,previous)});}
  const history=(await db.workoutSessions.orderBy('startedAt').reverse().limit(5).toArray()).map(assertValidWorkoutSession);return{dayId:day.id,nextTemplate,activeWorkout,activeTemplate,activeSets:activeSets.map(assertValidPerformedSet),guidance,history};
}
