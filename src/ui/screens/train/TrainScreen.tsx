import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  completeRecoverySession,
  completeWorkout,
  getTrainDashboard,
  logWorkoutSet,
  skipWorkoutSet,
  startRecoverySession,
  startReducedWorkout,
  startWorkout,
  type TrainDashboard,
} from '../../../application/services/workoutService';

export function TrainScreen() {
  const [state, setState] = useState<TrainDashboard | null>(null);
  const [status, setStatus] = useState('');

  async function refresh() {
    setState(await getTrainDashboard());
  }

  useEffect(() => {
    void getTrainDashboard().then(setState);
  }, []);

  async function begin(kind: 'STANDARD' | 'REDUCED' | 'RECOVERY') {
    if (!state?.dayId) return;
    try {
      if (kind === 'STANDARD') await startWorkout(state.dayId);
      else if (kind === 'REDUCED') await startReducedWorkout(state.dayId);
      else await startRecoverySession(state.dayId);
      setStatus(`${kind === 'RECOVERY' ? 'Recovery session' : `${kind} workout`} started.`);
      await refresh();
    } catch {
      setStatus('Session could not be started. Your existing training history was not changed.');
    }
  }

  async function logSet(
    event: FormEvent<HTMLFormElement>,
    exerciseId: string,
    setOrdinal: number,
  ) {
    event.preventDefault();
    if (!state?.activeWorkout) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const weight = Number(form.get('weight'));
    const reps = Number(form.get('reps'));
    try {
      await logWorkoutSet(state.activeWorkout.id, exerciseId, setOrdinal, weight, reps);
      formElement.reset();
      setStatus('Set logged.');
      await refresh();
    } catch {
      setStatus('Set could not be logged. Check weight and reps, then try again.');
    }
  }

  async function skip(exerciseId: string, setOrdinal: number) {
    if (!state?.activeWorkout) return;
    try {
      await skipWorkoutSet(state.activeWorkout.id, exerciseId, setOrdinal);
      setStatus('Set skipped.');
      await refresh();
    } catch {
      setStatus('Set could not be skipped. Your existing training history was not changed.');
    }
  }

  async function finishStrength() {
    if (!state?.activeWorkout) return;
    try {
      const closed = await completeWorkout(state.activeWorkout.id);
      setStatus(`Workout ${closed.status.toLowerCase()}.`);
      await refresh();
    } catch {
      setStatus('Workout could not be completed. Your recorded sets remain stored.');
    }
  }

  async function finishRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!state?.activeWorkout) return;
    const durationMinutes = Number(new FormData(event.currentTarget).get('durationMinutes'));
    try {
      const closed = await completeRecoverySession(state.activeWorkout.id, durationMinutes);
      setStatus(`Recovery session ${closed.status.toLowerCase()}.`);
      await refresh();
    } catch {
      setStatus('Recovery minutes must be a whole number, 0 or greater.');
    }
  }

  if (!state)
    return (
      <section>
        <div className="eyebrow">TRAIN</div>
        <h1>Loading…</h1>
      </section>
    );

  const active = state.activeWorkout;
  const activeTemplate = state.activeTemplate;
  const heading = active
    ? active.sessionType === 'RECOVERY'
      ? 'Recovery session'
      : `Workout ${activeTemplate?.id ?? '—'} · ${active.sessionType}`
    : `Next: Workout ${state.nextTemplate.id} · ${state.nextTemplate.emphasis}`;

  return (
    <section>
      <div className="eyebrow">TRAIN</div>
      <h1>{heading}</h1>
      {status && (
        <p role="status" className="card">
          {status}
        </p>
      )}

      {!state.dayId ? (
        <div className="card">
          <h2>No active day</h2>
          <p className="muted">Start a BEYOND Day before training.</p>
          <Link to="/today">GO TO TODAY</Link>
        </div>
      ) : active?.sessionType === 'RECOVERY' ? (
        <form className="card" onSubmit={finishRecovery}>
          <h2>Easy movement / mobility</h2>
          <p className="muted">
            Record what happened. 10+ minutes completes recovery; 5–9 can satisfy minimum
            movement without pretending it was a full session.
          </p>
          <label>
            Recovery minutes
            <input name="durationMinutes" type="number" min="0" step="1" required />
          </label>
          <p>
            <button type="submit">END RECOVERY</button>
          </p>
        </form>
      ) : active && activeTemplate ? (
        <>
          <div className="card">
            <strong>{active.sessionType}</strong>
            {active.sessionType === 'REDUCED' && (
              <p className="muted">Two exercises · two sets each. Reduced work is legitimate work.</p>
            )}
          </div>
          {state.activeExercises.map((exercise) => {
            const guidance = state.guidance.find((item) => item.exerciseId === exercise.id);
            return (
              <div className="card" key={exercise.id}>
                <h2>{exercise.name}</h2>
                <p>
                  {exercise.setCount} sets · {exercise.repMin}–{exercise.repMax} reps
                </p>
                {guidance && active.sessionType === 'STANDARD' && (
                  <p className="muted">
                    Previous:{' '}
                    {guidance.previous.length
                      ? guidance.previous
                          .map((set) =>
                            set.state === 'COMPLETED' ? `${set.weight}×${set.reps}` : 'SKIP',
                          )
                          .join(' / ')
                      : 'NONE'}{' '}
                    · Next: {guidance.progression.action}
                  </p>
                )}
                {Array.from({ length: exercise.setCount }, (_, index) => index + 1).map(
                  (ordinal) => {
                    const recorded = state.activeSets.find(
                      (set) => set.exerciseId === exercise.id && set.setOrdinal === ordinal,
                    );
                    return (
                      <div key={ordinal}>
                        {recorded ? (
                          <p>
                            <strong>Set {ordinal}:</strong>{' '}
                            {recorded.state === 'COMPLETED'
                              ? `${recorded.weight} × ${recorded.reps}`
                              : 'SKIPPED'}
                          </p>
                        ) : (
                          <form onSubmit={(event) => logSet(event, exercise.id, ordinal)}>
                            <strong>Set {ordinal}</strong>
                            <label>
                              {exercise.name} set {ordinal} weight
                              <input name="weight" type="number" min="0" step="0.5" required />
                            </label>
                            <label>
                              {exercise.name} set {ordinal} reps
                              <input name="reps" type="number" min="1" step="1" required />
                            </label>
                            <p>
                              <button type="submit">LOG SET</button>{' '}
                              <button type="button" onClick={() => skip(exercise.id, ordinal)}>
                                SKIP
                              </button>
                            </p>
                          </form>
                        )}
                      </div>
                    );
                  },
                )}
              </div>
            );
          })}
          <p>
            <button onClick={finishStrength}>COMPLETE SESSION</button>
          </p>
        </>
      ) : (
        <>
          <div className="card">
            <h2>Workout {state.nextTemplate.id}</h2>
            {state.nextTemplate.exercises.map((exercise) => {
              const guidance = state.guidance.find((item) => item.exerciseId === exercise.id);
              return (
                <p key={exercise.id}>
                  <strong>{exercise.name}</strong> · {exercise.setCount}×{exercise.repMin}–
                  {exercise.repMax}
                  {guidance ? (
                    <>
                      <br />
                      <span className="muted">
                        {guidance.progression.action}: {guidance.progression.reason}
                      </span>
                    </>
                  ) : null}
                </p>
              );
            })}
            <button onClick={() => begin('STANDARD')}>START WORKOUT</button>{' '}
            <button onClick={() => begin('REDUCED')}>REDUCED WORKOUT</button>{' '}
            <button onClick={() => begin('RECOVERY')}>RECOVERY SESSION</button>
          </div>
          {state.history.length > 0 && (
            <div className="card">
              <h2>Recent sessions</h2>
              {state.history.map((session) => (
                <p key={session.id}>
                  {session.sessionType === 'RECOVERY'
                    ? `Recovery · ${session.durationMinutes ?? '—'} min · ${session.status}`
                    : `Workout ${session.templateId ?? '—'} · ${session.sessionType} · ${session.status}`}
                </p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
