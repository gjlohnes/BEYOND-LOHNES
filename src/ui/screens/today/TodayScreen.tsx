import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  endDay,
  getTodayState,
  startDay,
  submitCheckIn,
  type PersistedRecommendationDecision,
} from '../../../application/services/dayService';
import { decideRecommendation } from '../../../application/services/recommendationService';
import {
  completeShiftDown,
  getActiveRitual,
  startShiftDown,
  type ActiveRitual,
} from '../../../application/services/ritualService';
import { startRecoverySession } from '../../../application/services/workoutService';
import { markWorkEnded } from '../../../application/services/workContextService';
import type { WorkContext } from '../../../domain/common/types';
import type { Recommendation } from '../../../domain/recommendation/types';
import { getShiftDownSteps } from '../../../engine/shiftDownRules';
import { MinimumDayCard } from './MinimumDayCard';

function decisionLabel(decision: PersistedRecommendationDecision) {
  if (decision === 'ACCEPT') return 'ACCEPTED';
  if (decision === 'DISMISS') return 'DISMISSED';
  if (decision === 'OVERRIDE') return 'OVERRIDDEN';
  return 'NO ACTION RECORDED';
}

const CHECK_IN_FIELDS = [
  { key: 'energy', label: 'Energy', min: 1, max: 5 },
  { key: 'stress', label: 'Stress', min: 1, max: 5 },
  { key: 'mood', label: 'Mood', min: 1, max: 5 },
  { key: 'soreness', label: 'Soreness', min: 0, max: 5 },
  { key: 'alcoholUrge', label: 'Alcohol urge', min: 0, max: 5 },
] as const;

export function TodayScreen() {
  const navigate = useNavigate();
  const [dayId, setDayId] = useState<string | null>(null);
  const [workContext, setWorkContext] = useState<WorkContext | null>(null);
  const [workEnded, setWorkEnded] = useState(false);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [status, setStatus] = useState('');
  const [decision, setDecision] = useState<PersistedRecommendationDecision | null>(null);
  const [shiftDown, setShiftDown] = useState<ActiveRitual | null>(null);

  async function applyTodayState() {
    const state = await getTodayState();
    const activeDayId = state.day?.id ?? null;
    setDayId(activeDayId);
    setWorkContext(state.day?.workContext ?? null);
    setWorkEnded(state.workEnded);
    setRec(state.recommendation);
    setDecision(state.recommendationDecision);
    setShiftDown(activeDayId ? await getActiveRitual(activeDayId, 'SHIFT_DOWN') : null);
    if (state.recommendationDecision)
      setStatus(`Recommendation ${decisionLabel(state.recommendationDecision).toLowerCase()}.`);
  }

  useEffect(() => {
    void getTodayState().then(async (state) => {
      const activeDayId = state.day?.id ?? null;
      const activeShiftDown = activeDayId
        ? await getActiveRitual(activeDayId, 'SHIFT_DOWN')
        : null;
      setDayId(activeDayId);
      setWorkContext(state.day?.workContext ?? null);
      setWorkEnded(state.workEnded);
      setRec(state.recommendation);
      setDecision(state.recommendationDecision);
      setShiftDown(activeShiftDown);
      if (state.recommendationDecision)
        setStatus(`Recommendation ${decisionLabel(state.recommendationDecision).toLowerCase()}.`);
    });
  }, []);

  async function begin(context: WorkContext) {
    try {
      const day = await startDay(context);
      setDayId(day.id);
      setWorkContext(day.workContext);
      setWorkEnded(false);
      setStatus(day.workContext === 'WORK' ? 'Work BEYOND Day started.' : 'BEYOND Day started.');
    } catch {
      setStatus('BEYOND Day could not be started. Existing local history was not changed.');
    }
  }

  async function finishDay() {
    if (!dayId) return;
    try {
      await endDay(dayId);
      setDayId(null);
      setWorkContext(null);
      setWorkEnded(false);
      setRec(null);
      setDecision(null);
      setShiftDown(null);
      setStatus('BEYOND Day ended.');
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === 'ACTIVE_FLOW_EXISTS'
          ? 'Finish the active RESET, SHIFT DOWN, workout, or recovery session before ending this BEYOND Day.'
          : 'BEYOND Day could not be ended. Existing local history remains available.',
      );
    }
  }

  async function finishWorkPeriod() {
    if (!dayId || workContext !== 'WORK' || workEnded) return;
    try {
      const result = await markWorkEnded(dayId);
      if (result.status === 'COMPLETED' || result.errorCode === 'WORK_ALREADY_ENDED') {
        setWorkEnded(true);
        setRec(null);
        setDecision(null);
        setStatus('Shift ended. Reassess when ready for the post-shift recommendation.');
      } else {
        setStatus('Work transition could not be stored.');
      }
    } catch {
      setStatus('Work transition could not be stored. Existing history was not changed.');
    }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dayId) return;
    const form = new FormData(event.currentTarget);
    const number = (key: string) => Number(form.get(key));
    try {
      const result = await submitCheckIn(dayId, {
        energy: number('energy') as 1 | 2 | 3 | 4 | 5,
        stress: number('stress') as 1 | 2 | 3 | 4 | 5,
        mood: number('mood') as 1 | 2 | 3 | 4 | 5,
        soreness: number('soreness') as 0 | 1 | 2 | 3 | 4 | 5,
        alcoholUrge: number('alcoholUrge') as 0 | 1 | 2 | 3 | 4 | 5,
      });
      setRec(result.recommendation);
      setDecision(null);
      setStatus('REASSESS completed.');
    } catch {
      setStatus('Check-in could not be stored. Keep each value within its shown range and try again.');
    }
  }

  async function decide(nextDecision: 'ACCEPT' | 'DISMISS' | 'NO_ACTION') {
    if (!rec || decision) return;
    try {
      await decideRecommendation(rec.id, nextDecision);
      setDecision(nextDecision);
      setStatus(`Recommendation ${decisionLabel(nextDecision).toLowerCase()}.`);
      if (nextDecision === 'ACCEPT' && rec.suggestedCommand === 'START_RESET') {
        navigate(`/reset?recommendationId=${rec.id}`);
      } else if (
        nextDecision === 'ACCEPT' &&
        rec.suggestedCommand === 'START_SHIFT_DOWN' &&
        dayId
      ) {
        const result = await startShiftDown(dayId, rec.id);
        if (result.status === 'COMPLETED') {
          setShiftDown({
            kind: 'SHIFT_DOWN',
            commandId: result.commandId,
            recommendationId: rec.id,
            startedAt: new Date().toISOString(),
          });
        } else {
          setStatus('Recommendation accepted, but SHIFT DOWN could not be started.');
        }
      } else if (
        nextDecision === 'ACCEPT' &&
        rec.suggestedCommand === 'RECOVERY_SESSION' &&
        dayId
      ) {
        try {
          await startRecoverySession(dayId, rec.id);
          navigate('/train');
        } catch {
          setStatus('Recommendation accepted, but recovery session could not be started.');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'RECOMMENDATION_ALREADY_DECIDED') {
        await applyTodayState();
        return;
      }
      setStatus('Decision could not be stored.');
    }
  }

  async function override(command: 'START_RESET' | 'START_SHIFT_DOWN') {
    if (!rec || decision || !dayId) return;
    try {
      await decideRecommendation(rec.id, 'OVERRIDE', command);
      setDecision('OVERRIDE');
      setStatus(
        `Recommendation overridden with ${command === 'START_RESET' ? 'RESET' : 'SHIFT DOWN'}.`,
      );

      if (command === 'START_RESET') {
        navigate(`/reset?recommendationId=${rec.id}`);
        return;
      }

      const result = await startShiftDown(dayId, rec.id);
      if (result.status === 'COMPLETED') {
        setShiftDown({
          kind: 'SHIFT_DOWN',
          commandId: result.commandId,
          recommendationId: rec.id,
          startedAt: new Date().toISOString(),
        });
      } else {
        setStatus('Override recorded, but SHIFT DOWN could not be started.');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'RECOMMENDATION_ALREADY_DECIDED') {
        await applyTodayState();
        return;
      }
      setStatus('Override could not be stored.');
    }
  }

  async function beginShiftDown() {
    if (!dayId) return;
    try {
      const result = await startShiftDown(dayId);
      if (result.status === 'COMPLETED') {
        setShiftDown({
          kind: 'SHIFT_DOWN',
          commandId: result.commandId,
          startedAt: new Date().toISOString(),
        });
        setStatus('SHIFT DOWN started and stored.');
      } else {
        setStatus('SHIFT DOWN could not be started.');
      }
    } catch {
      setStatus('SHIFT DOWN could not be started. Existing history was not changed.');
    }
  }

  async function finishShiftDown() {
    if (!dayId || !shiftDown) return;
    try {
      await completeShiftDown(dayId, shiftDown.commandId, shiftDown.recommendationId);
      setShiftDown(null);
      setStatus('SHIFT DOWN completed and stored.');
    } catch {
      setStatus('SHIFT DOWN could not be completed. Your existing history remains stored.');
    }
  }

  return (
    <section>
      <div className="eyebrow">BEYOND // TODAY</div>
      <h1>Command</h1>
      {status && (
        <p role="status" className="card">
          {status}
        </p>
      )}
      {!dayId ? (
        <div className="card">
          <h2>No active day</h2>
          <p className="muted">A BEYOND Day starts when you start it. Standard start is off duty.</p>
          <button onClick={() => begin('OFF_DUTY')}>START DAY</button>{' '}
          <button onClick={() => begin('WORK')}>START WORK DAY</button>
        </div>
      ) : (
        <>
          <div className="card">
            <p className="muted">
              Context:{' '}
              {workContext === 'WORK'
                ? workEnded
                  ? 'WORK · POST SHIFT'
                  : 'WORK · ACTIVE'
                : workContext ?? 'UNKNOWN'}
            </p>
            <h2>{rec?.title ?? 'State check-in required'}</h2>
            <p>{rec?.rationale ?? 'Record current state to produce one deterministic recommendation.'}</p>
            {rec && (
              <>
                <p>
                  <Link to={`/why/${rec.id}`}>WHY</Link>
                </p>
                {decision ? (
                  <p>
                    <strong>Decision: {decisionLabel(decision)}</strong>
                  </p>
                ) : (
                  <>
                    {rec.statusAtIssue === 'NO_ACTION_REQUIRED' ? (
                      <button onClick={() => decide('NO_ACTION')}>RECORD NO ACTION</button>
                    ) : (
                      <>
                        <button onClick={() => decide('ACCEPT')}>ACCEPT</button>{' '}
                        <button onClick={() => decide('DISMISS')}>DISMISS</button>
                      </>
                    )}
                    <p className="muted">Override:</p>
                    <button onClick={() => override('START_RESET')}>RESET</button>{' '}
                    <button onClick={() => override('START_SHIFT_DOWN')}>SHIFT DOWN</button>
                  </>
                )}
              </>
            )}
          </div>

          <form className="card" onSubmit={checkIn}>
            <h2>State check-in</h2>
            <div className="grid">
              {CHECK_IN_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input
                    name={field.key}
                    type="number"
                    min={field.min}
                    max={field.max}
                    defaultValue={field.min}
                    inputMode="numeric"
                    required
                  />
                </label>
              ))}
            </div>
            <p>
              <button type="submit">REASSESS</button>
            </p>
          </form>

          <div className="card">
            <h2>Context actions</h2>
            {workContext === 'WORK' && !workEnded && (
              <p>
                <button onClick={finishWorkPeriod}>SHIFT ENDED</button>
              </p>
            )}
            <p>
              <Link to="/reset">I NEED A RESET</Link>
            </p>
            {!shiftDown ? (
              <button onClick={beginShiftDown}>SHIFT DOWN</button>
            ) : (
              <>
                <p className="muted">SHIFT DOWN in progress.</p>
                <ol>
                  {getShiftDownSteps().map((step) => (
                    <li key={step.id}>{step.label}</li>
                  ))}
                </ol>
                <button onClick={finishShiftDown}>COMPLETE SHIFT DOWN</button>
              </>
            )}
            <p>
              <Link to={`/history/${dayId}`}>VIEW HISTORY</Link>
            </p>
          </div>

          <MinimumDayCard dayId={dayId} />

          <div className="card">
            <h2>Day lifecycle</h2>
            <button onClick={finishDay}>END DAY</button>
            <p className="muted">Explicit wake-to-sleep boundary. Never midnight rollover.</p>
          </div>
        </>
      )}
    </section>
  );
}
