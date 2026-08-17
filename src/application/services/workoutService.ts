import Dexie from 'dexie';
import { db } from '../../persistence/db';
import {
  assertValidEvent,
  assertValidOutcome,
  assertValidPerformedSet,
  assertValidWorkoutSession,
} from '../../persistence/validation';
import {
  getWorkoutTemplate,
  nextWorkoutTemplateId,
  WORKOUT_TEMPLATES,
} from '../../domain/workout/templates';
import type { DomainEvent } from '../../domain/common/events';
import type { CommandName, Outcome } from '../../domain/recommendation/types';
import type {
  PerformedSet,
  ProgressionSuggestion,
  WorkoutExerciseTemplate,
  WorkoutSession,
  WorkoutSessionType,
  WorkoutTemplate,
  WorkoutTemplateId,
} from '../../domain/workout/types';
import { deriveProgression } from '../../engine/workoutProgression';

function commandEvent(
  type: DomainEvent['type'],
  dayId: string,
  commandId: string,
  commandName: CommandName,
  payload: Record<string, unknown>,
  source: DomainEvent['source'],
  causationId?: string,
) {
  const now = new Date().toISOString();
  return assertValidEvent({
    id: crypto.randomUUID(),
    schemaVersion: 1,
    type,
    beyondDayId: dayId,
    occurredAt: now,
    recordedAt: now,
    payload,
    source,
    correlationId: commandId,
    ...(causationId ? { causationId } : {}),
  });
}

async function latestRotationSession(): Promise<WorkoutSession | undefined> {
  const sessions = await db.workoutSessions.orderBy('startedAt').reverse().toArray();
  return sessions.find(
    (session) =>
      session.sessionType !== 'RECOVERY' &&
      (session.status === 'COMPLETED' || session.status === 'PARTIAL'),
  );
}

export async function getNextWorkoutTemplateId(): Promise<WorkoutTemplateId> {
  const latest = await latestRotationSession();
  return nextWorkoutTemplateId(latest?.templateId);
}

export async function getActiveWorkout(dayId: string) {
  const candidate = await db.workoutSessions
    .where('beyondDayId')
    .equals(dayId)
    .filter((session) => session.status === 'ACTIVE')
    .first();
  return candidate ? assertValidWorkoutSession(candidate) : null;
}

async function startStrengthWorkout(
  dayId: string,
  sessionType: Extract<WorkoutSessionType, 'STANDARD' | 'REDUCED'>,
): Promise<WorkoutSession> {
  const commandName: CommandName =
    sessionType === 'STANDARD' ? 'START_WORKOUT' : 'START_REDUCED_WORKOUT';
  return db.transaction('rw', db.beyondDays, db.workoutSessions, db.events, async () => {
    const day = await db.beyondDays.get(dayId);
    if (!day || day.status !== 'ACTIVE') throw new Error('DAY_NOT_FOUND');
    const active = await db.workoutSessions
      .where('beyondDayId')
      .equals(dayId)
      .filter((session) => session.status === 'ACTIVE')
      .first();
    if (active) return assertValidWorkoutSession(active);

    const latest = await db.workoutSessions
      .orderBy('startedAt')
      .reverse()
      .filter(
        (session) =>
          session.sessionType !== 'RECOVERY' &&
          (session.status === 'COMPLETED' || session.status === 'PARTIAL'),
      )
      .first();
    const templateId = nextWorkoutTemplateId(latest?.templateId);
    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const session = assertValidWorkoutSession({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      beyondDayId: dayId,
      templateId,
      sessionType,
      status: 'ACTIVE',
      startedAt: now,
    });
    const started = commandEvent(
      'COMMAND_STARTED',
      dayId,
      commandId,
      commandName,
      { commandName },
      'USER',
    );
    const workoutStarted = commandEvent(
      'WORKOUT_STARTED',
      dayId,
      commandId,
      commandName,
      { commandId, sessionId: session.id, templateId, sessionType },
      'USER',
      started.id,
    );
    const completed = commandEvent(
      'COMMAND_COMPLETED',
      dayId,
      commandId,
      commandName,
      { commandName },
      'SYSTEM',
      started.id,
    );
    await db.workoutSessions.add(session);
    await db.events.bulkAdd([started, workoutStarted, completed]);
    return session;
  });
}

export function startWorkout(dayId: string) {
  return startStrengthWorkout(dayId, 'STANDARD');
}

export function startReducedWorkout(dayId: string) {
  return startStrengthWorkout(dayId, 'REDUCED');
}

export async function startRecoverySession(dayId: string): Promise<WorkoutSession> {
  return db.transaction('rw', db.beyondDays, db.workoutSessions, db.events, async () => {
    const day = await db.beyondDays.get(dayId);
    if (!day || day.status !== 'ACTIVE') throw new Error('DAY_NOT_FOUND');
    const active = await db.workoutSessions
      .where('beyondDayId')
      .equals(dayId)
      .filter((session) => session.status === 'ACTIVE')
      .first();
    if (active) return assertValidWorkoutSession(active);

    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const session = assertValidWorkoutSession({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      beyondDayId: dayId,
      sessionType: 'RECOVERY',
      status: 'ACTIVE',
      startedAt: now,
    });
    const started = commandEvent(
      'COMMAND_STARTED',
      dayId,
      commandId,
      'RECOVERY_SESSION',
      { commandName: 'RECOVERY_SESSION' },
      'USER',
    );
    const recoveryStarted = commandEvent(
      'WORKOUT_STARTED',
      dayId,
      commandId,
      'RECOVERY_SESSION',
      { commandId, sessionId: session.id, sessionType: 'RECOVERY' },
      'USER',
      started.id,
    );
    const completed = commandEvent(
      'COMMAND_COMPLETED',
      dayId,
      commandId,
      'RECOVERY_SESSION',
      { commandName: 'RECOVERY_SESSION' },
      'SYSTEM',
      started.id,
    );
    await db.workoutSessions.add(session);
    await db.events.bulkAdd([started, recoveryStarted, completed]);
    return session;
  });
}

function plannedExercises(session: WorkoutSession): WorkoutExerciseTemplate[] {
  if (!session.templateId) throw new Error('WORKOUT_TEMPLATE_REQUIRED');
  const exercises = [...getWorkoutTemplate(session.templateId).exercises];
  if (session.sessionType === 'REDUCED') {
    return exercises.slice(0, 2).map((exercise) => ({ ...exercise, setCount: 2 }));
  }
  return exercises;
}

function findExercise(session: WorkoutSession, exerciseId: string) {
  const exercise = plannedExercises(session).find((candidate) => candidate.id === exerciseId);
  if (!exercise) throw new Error('EXERCISE_NOT_IN_WORKOUT');
  return exercise;
}

export async function logWorkoutSet(
  sessionId: string,
  exerciseId: string,
  setOrdinal: number,
  weight: number,
  reps: number,
): Promise<PerformedSet> {
  return db.transaction('rw', db.workoutSessions, db.performedSets, db.events, async () => {
    const sessionRaw = await db.workoutSessions.get(sessionId);
    if (!sessionRaw) throw new Error('WORKOUT_NOT_FOUND');
    const session = assertValidWorkoutSession(sessionRaw);
    if (session.status !== 'ACTIVE') throw new Error('WORKOUT_NOT_ACTIVE');
    if (session.sessionType === 'RECOVERY') throw new Error('RECOVERY_HAS_NO_STRENGTH_SETS');
    const exercise = findExercise(session, exerciseId);
    if (!Number.isInteger(setOrdinal) || setOrdinal < 1 || setOrdinal > exercise.setCount)
      throw new Error('INVALID_SET_ORDINAL');
    if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps < 1)
      throw new Error('INVALID_SET_INPUT');
    const duplicate = await db.performedSets
      .where('[workoutSessionId+exerciseId]')
      .equals([sessionId, exerciseId])
      .filter((set) => set.setOrdinal === setOrdinal)
      .first();
    if (duplicate) return assertValidPerformedSet(duplicate);

    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const set = assertValidPerformedSet({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      beyondDayId: session.beyondDayId,
      workoutSessionId: session.id,
      exerciseId,
      setOrdinal,
      state: 'COMPLETED',
      weight,
      reps,
      recordedAt: now,
    });
    const started = commandEvent(
      'COMMAND_STARTED',
      session.beyondDayId,
      commandId,
      'LOG_WORKOUT_SET',
      { commandName: 'LOG_WORKOUT_SET' },
      'USER',
    );
    const recorded = commandEvent(
      'WORKOUT_SET_RECORDED',
      session.beyondDayId,
      commandId,
      'LOG_WORKOUT_SET',
      { commandId, sessionId: session.id, setId: set.id, exerciseId, setOrdinal },
      'USER',
      started.id,
    );
    const completed = commandEvent(
      'COMMAND_COMPLETED',
      session.beyondDayId,
      commandId,
      'LOG_WORKOUT_SET',
      { commandName: 'LOG_WORKOUT_SET' },
      'SYSTEM',
      started.id,
    );
    await db.performedSets.add(set);
    await db.events.bulkAdd([started, recorded, completed]);
    return set;
  });
}

export async function skipWorkoutSet(
  sessionId: string,
  exerciseId: string,
  setOrdinal: number,
): Promise<PerformedSet> {
  return db.transaction('rw', db.workoutSessions, db.performedSets, db.events, async () => {
    const sessionRaw = await db.workoutSessions.get(sessionId);
    if (!sessionRaw) throw new Error('WORKOUT_NOT_FOUND');
    const session = assertValidWorkoutSession(sessionRaw);
    if (session.status !== 'ACTIVE') throw new Error('WORKOUT_NOT_ACTIVE');
    if (session.sessionType === 'RECOVERY') throw new Error('RECOVERY_HAS_NO_STRENGTH_SETS');
    const exercise = findExercise(session, exerciseId);
    if (!Number.isInteger(setOrdinal) || setOrdinal < 1 || setOrdinal > exercise.setCount)
      throw new Error('INVALID_SET_ORDINAL');
    const duplicate = await db.performedSets
      .where('[workoutSessionId+exerciseId]')
      .equals([sessionId, exerciseId])
      .filter((set) => set.setOrdinal === setOrdinal)
      .first();
    if (duplicate) return assertValidPerformedSet(duplicate);

    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const set = assertValidPerformedSet({
      id: crypto.randomUUID(),
      schemaVersion: 1,
      beyondDayId: session.beyondDayId,
      workoutSessionId: session.id,
      exerciseId,
      setOrdinal,
      state: 'SKIPPED',
      recordedAt: now,
    });
    const started = commandEvent(
      'COMMAND_STARTED',
      session.beyondDayId,
      commandId,
      'SKIP_WORKOUT_SET',
      { commandName: 'SKIP_WORKOUT_SET' },
      'USER',
    );
    const skipped = commandEvent(
      'WORKOUT_SET_SKIPPED',
      session.beyondDayId,
      commandId,
      'SKIP_WORKOUT_SET',
      { commandId, sessionId: session.id, setId: set.id, exerciseId, setOrdinal },
      'USER',
      started.id,
    );
    const completed = commandEvent(
      'COMMAND_COMPLETED',
      session.beyondDayId,
      commandId,
      'SKIP_WORKOUT_SET',
      { commandName: 'SKIP_WORKOUT_SET' },
      'SYSTEM',
      started.id,
    );
    await db.performedSets.add(set);
    await db.events.bulkAdd([started, skipped, completed]);
    return set;
  });
}

export async function completeWorkout(sessionId: string): Promise<WorkoutSession> {
  return db.transaction(
    'rw',
    db.workoutSessions,
    db.performedSets,
    db.events,
    db.outcomes,
    async () => {
      const sessionRaw = await db.workoutSessions.get(sessionId);
      if (!sessionRaw) throw new Error('WORKOUT_NOT_FOUND');
      const session = assertValidWorkoutSession(sessionRaw);
      if (session.status !== 'ACTIVE') return session;
      if (session.sessionType === 'RECOVERY') throw new Error('USE_RECOVERY_COMPLETION');
      const exercises = plannedExercises(session);
      const sets = await db.performedSets.where('workoutSessionId').equals(session.id).toArray();
      const planned = exercises.reduce((total, exercise) => total + exercise.setCount, 0);
      const completedCount = sets.filter((set) => set.state === 'COMPLETED').length;
      const status: WorkoutSession['status'] =
        completedCount === planned ? 'COMPLETED' : sets.length > 0 ? 'PARTIAL' : 'ABANDONED';
      const now = new Date().toISOString();
      const commandId = crypto.randomUUID();
      const closed = assertValidWorkoutSession({ ...session, status, endedAt: now });
      const started = commandEvent(
        'COMMAND_STARTED',
        session.beyondDayId,
        commandId,
        'COMPLETE_WORKOUT',
        { commandName: 'COMPLETE_WORKOUT' },
        'USER',
      );
      const domain = commandEvent(
        status === 'ABANDONED' ? 'WORKOUT_ABANDONED' : 'WORKOUT_COMPLETED',
        session.beyondDayId,
        commandId,
        'COMPLETE_WORKOUT',
        { commandId, sessionId: session.id, status, sessionType: session.sessionType },
        'USER',
        started.id,
      );
      const completed = commandEvent(
        'COMMAND_COMPLETED',
        session.beyondDayId,
        commandId,
        'COMPLETE_WORKOUT',
        { commandName: 'COMPLETE_WORKOUT' },
        'SYSTEM',
        started.id,
      );
      const outcome: Outcome = assertValidOutcome({
        id: crypto.randomUUID(),
        commandExecutionId: commandId,
        beyondDayId: session.beyondDayId,
        recordedAt: now,
        result:
          status === 'COMPLETED' ? 'COMPLETED' : status === 'PARTIAL' ? 'PARTIAL' : 'ABANDONED',
      });
      await db.workoutSessions.put(closed);
      await db.events.bulkAdd([started, domain, completed]);
      await db.outcomes.add(outcome);
      return closed;
    },
  );
}

export async function completeRecoverySession(
  sessionId: string,
  durationMinutes: number,
): Promise<WorkoutSession> {
  if (!Number.isInteger(durationMinutes) || durationMinutes < 0)
    throw new Error('INVALID_RECOVERY_DURATION');
  return db.transaction('rw', db.workoutSessions, db.events, db.outcomes, async () => {
    const sessionRaw = await db.workoutSessions.get(sessionId);
    if (!sessionRaw) throw new Error('WORKOUT_NOT_FOUND');
    const session = assertValidWorkoutSession(sessionRaw);
    if (session.sessionType !== 'RECOVERY') throw new Error('RECOVERY_SESSION_REQUIRED');
    if (session.status !== 'ACTIVE') return session;

    const status: WorkoutSession['status'] =
      durationMinutes >= 10 ? 'COMPLETED' : durationMinutes > 0 ? 'PARTIAL' : 'ABANDONED';
    const now = new Date().toISOString();
    const commandId = crypto.randomUUID();
    const closed = assertValidWorkoutSession({
      ...session,
      status,
      endedAt: now,
      durationMinutes,
    });
    const started = commandEvent(
      'COMMAND_STARTED',
      session.beyondDayId,
      commandId,
      'COMPLETE_WORKOUT',
      { commandName: 'COMPLETE_WORKOUT' },
      'USER',
    );
    const domain = commandEvent(
      status === 'ABANDONED' ? 'WORKOUT_ABANDONED' : 'WORKOUT_COMPLETED',
      session.beyondDayId,
      commandId,
      'COMPLETE_WORKOUT',
      { commandId, sessionId: session.id, status, sessionType: 'RECOVERY', durationMinutes },
      'USER',
      started.id,
    );
    const completed = commandEvent(
      'COMMAND_COMPLETED',
      session.beyondDayId,
      commandId,
      'COMPLETE_WORKOUT',
      { commandName: 'COMPLETE_WORKOUT' },
      'SYSTEM',
      started.id,
    );
    const outcome = assertValidOutcome({
      id: crypto.randomUUID(),
      commandExecutionId: commandId,
      beyondDayId: session.beyondDayId,
      recordedAt: now,
      result:
        status === 'COMPLETED' ? 'COMPLETED' : status === 'PARTIAL' ? 'PARTIAL' : 'ABANDONED',
    });
    await db.workoutSessions.put(closed);
    await db.events.bulkAdd([started, domain, completed]);
    await db.outcomes.add(outcome);
    return closed;
  });
}

async function previousStandardSets(
  exerciseId: string,
  beforeStartedAt?: string,
): Promise<PerformedSet[]> {
  const candidates = await db.performedSets
    .where('[exerciseId+recordedAt]')
    .between(
      [exerciseId, Dexie.minKey],
      [exerciseId, beforeStartedAt ?? Dexie.maxKey],
      false,
      true,
    )
    .reverse()
    .toArray();
  for (const candidate of candidates) {
    const sessionRaw = await db.workoutSessions.get(candidate.workoutSessionId);
    if (!sessionRaw) continue;
    const session = assertValidWorkoutSession(sessionRaw);
    if (
      session.sessionType !== 'STANDARD' ||
      session.status === 'ACTIVE' ||
      session.status === 'ABANDONED'
    )
      continue;
    const sets = await db.performedSets
      .where('[workoutSessionId+exerciseId]')
      .equals([session.id, exerciseId])
      .toArray();
    return sets.map(assertValidPerformedSet).sort((a, b) => a.setOrdinal - b.setOrdinal);
  }
  return [];
}

export interface ExerciseGuidance {
  exerciseId: string;
  previous: PerformedSet[];
  progression: ProgressionSuggestion;
}
export interface TrainDashboard {
  dayId: string | null;
  nextTemplate: WorkoutTemplate;
  activeWorkout: WorkoutSession | null;
  activeTemplate: WorkoutTemplate | null;
  activeExercises: WorkoutExerciseTemplate[];
  activeSets: PerformedSet[];
  guidance: ExerciseGuidance[];
  history: WorkoutSession[];
}

export async function getTrainDashboard(): Promise<TrainDashboard> {
  const day = await db.beyondDays.where('status').equals('ACTIVE').first();
  const nextId = await getNextWorkoutTemplateId();
  const nextTemplate = WORKOUT_TEMPLATES[nextId];
  if (!day)
    return {
      dayId: null,
      nextTemplate,
      activeWorkout: null,
      activeTemplate: null,
      activeExercises: [],
      activeSets: [],
      guidance: [],
      history: [],
    };
  const activeWorkout = await getActiveWorkout(day.id);
  const activeTemplate = activeWorkout?.templateId
    ? getWorkoutTemplate(activeWorkout.templateId)
    : null;
  const activeExercises =
    activeWorkout && activeWorkout.sessionType !== 'RECOVERY' ? plannedExercises(activeWorkout) : [];
  const activeSets = activeWorkout
    ? await db.performedSets.where('workoutSessionId').equals(activeWorkout.id).toArray()
    : [];
  const templateForGuidance = activeTemplate ?? nextTemplate;
  const guidance: ExerciseGuidance[] = [];
  for (const exercise of templateForGuidance.exercises) {
    const previous = await previousStandardSets(exercise.id, activeWorkout?.startedAt);
    guidance.push({ exerciseId: exercise.id, previous, progression: deriveProgression(exercise, previous) });
  }
  const history = (
    await db.workoutSessions.orderBy('startedAt').reverse().limit(5).toArray()
  ).map(assertValidWorkoutSession);
  return {
    dayId: day.id,
    nextTemplate,
    activeWorkout,
    activeTemplate,
    activeExercises,
    activeSets: activeSets.map(assertValidPerformedSet),
    guidance,
    history,
  };
}
