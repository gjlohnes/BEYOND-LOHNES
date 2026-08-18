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
import { ActionButton } from '../../components/ActionButton';
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
  const [statusTone, setStatusTone] = useState<'success' | 'error' | 'info'>('info');
  const [decision, setDecision] = useState<PersistedRecommendationDecision | null>(null);
  const [shiftDown, setShiftDown] = useState<ActiveRitual | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  function report(message: string, tone: 'success' | 'error' | 'info' = 'info') {
    setStatus(message);
    setStatusTone(tone);
  }

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
      report(`Recommendation ${decisionLabel(state.recommendationDecision).toLowerCase()}.`, 'success');
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
        report(`Recommendation ${decisionLabel(state.recommendationDecision).toLowerCase()}.`, 'success');
    });
  }, []);

  async function begin(context: WorkContext) {
    if (busy) return;
    setBusy(context === 'WORK' ? 'start-work' : 'start-day');
    try {
      const day = await startDay(context);
      setDayId(day.id);
      setWorkContext(day.workContext);
      setWorkEnded(false);
      report(day.workContext === 'WORK' ? 'Work BEYOND Day started.' : 'BEYOND Day started.', 'success');
    } catch {
      report('BEYOND Day could not be started. Existing local history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function finishDay() {
    if (!dayId || busy) return;
    setBusy('end-day');
    try {
      await endDay(dayId);
      setDayId(null);
      setWorkContext(null);
      setWorkEnded(false);
      setRec(null);
      setDecision(null);
      setShiftDown(null);
      report('BEYOND Day ended.', 'success');
    } catch (error) {
      report(
        error instanceof Error && error.message === 'ACTIVE_FLOW_EXISTS'
          ? 'Finish the active RESET, SHIFT DOWN, workout, or recovery session before ending this BEYOND Day.'
          : 'BEYOND Day could not be ended. Existing local history remains available.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function finishWorkPeriod() {
    if (!dayId || workContext !== 'WORK' || workEnded || busy) return;
    setBusy('shift-ended');
    try {
      const result = await markWorkEnded(dayId);
      if (result.status === 'COMPLETED' || result.errorCode === 'WORK_ALREADY_ENDED') {
        setWorkEnded(true);
        setRec(null);
        setDecision(null);
        report('Shift ended. Reassess when ready for the post-shift recommendation.', 'success');
      } else {
        report('Work transition could not be stored.', 'error');
      }
    } catch {
      report('Work transition could not be stored. Existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dayId || busy) return;
    const form = new FormData(event.currentTarget);
    const number = (key: string) => Number(form.get(key));
    setBusy('reassess');
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
      report('REASSESS completed.', 'success');
    } catch {
      report('Check-in could not be stored. Keep each value within its shown range and try again.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function decide(nextDecision: 'ACCEPT' | 'DISMISS' | 'NO_ACTION') {
    if (!rec || decision || busy) return;
    setBusy(`decision-${nextDecision.toLowerCase()}`);
    try {
      await decideRecommendation(rec.id, nextDecision);
      setDecision(nextDecision);
      report(`Recommendation ${decisionLabel(nextDecision).toLowerCase()}.`, 'success');
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
          report('Recommendation accepted, but SHIFT DOWN could not be started.', 'error');
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
          report('Recommendation accepted, but recovery session could not be started.', 'error');
        }
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'RECOMMENDATION_ALREADY_DECIDED') {
        await applyTodayState();
        return;
      }
      report('Decision could not be stored.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function override(command: 'START_RESET' | 'START_SHIFT_DOWN') {
    if (!rec || decision || !dayId || busy) return;
    setBusy(command === 'START_RESET' ? 'override-reset' : 'override-shift-down');
    try {
      await decideRecommendation(rec.id, 'OVERRIDE', command);
      setDecision('OVERRIDE');
      report(
        `Recommendation overridden with ${command === 'START_RESET' ? 'RESET' : 'SHIFT DOWN'}.`,
        'success',
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
        report('Override recorded, but SHIFT DOWN could not be started.', 'error');
      }
    } catch (error) {
      if (error instanceof Error && error.message === 'RECOMMENDATION_ALREADY_DECIDED') {
        await applyTodayState();
        return;
      }
      report('Override could not be stored.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function beginShiftDown() {
    if (!dayId || busy) return;
    setBusy('shift-down-start');
    try {
      const result = await startShiftDown(dayId);
      if (result.status === 'COMPLETED') {
        setShiftDown({
          kind: 'SHIFT_DOWN',
          commandId: result.commandId,
          startedAt: new Date().toISOString(),
        });
        report('SHIFT DOWN started and stored.', 'success');
      } else {
        report('SHIFT DOWN could not be started.', 'error');
      }
    } catch {
      report('SHIFT DOWN could not be started. Existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function finishShiftDown() {
    if (!dayId || !shiftDown || busy) return;
    setBusy('shift-down-complete');
    try {
      await completeShiftDown(dayId, shiftDown.commandId, shiftDown.recommendationId);
      setShiftDown(null);
      report('SHIFT DOWN completed and stored.', 'success');
    } catch {
      report('SHIFT DOWN could not be completed. Your existing history remains stored.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="screen screen--today">
      <div className="screen-heading">
        <div>
          <div className="eyebrow">BEYOND // TODAY</div>
          <h1>Command</h1>
        </div>
        <span className="status-chip">LOCAL</span>
      </div>
      <p className="screen-intro muted">One command surface. One primary recommendation. Your decision remains final.</p>
      {status && (
        <p role="status" aria-live="polite" className={`feedback feedback--${statusTone}`}>
          {status}
        </p>
      )}
      {!dayId ? (
        <div className="card card--priority">
          <div className="card-kicker">DAY LIFECYCLE</div>
          <h2>No active day</h2>
          <p className="muted">A BEYOND Day starts when you start it. Standard start is off duty.</p>
          <div className="action-row">
            <ActionButton busy={busy === 'start-day'} busyLabel="STARTING…" disabled={Boolean(busy && busy !== 'start-day')} onClick={() => void begin('OFF_DUTY')}>START DAY</ActionButton>
            <ActionButton variant="secondary" busy={busy === 'start-work'} busyLabel="STARTING…" disabled={Boolean(busy && busy !== 'start-work')} onClick={() => void begin('WORK')}>START WORK DAY</ActionButton>
          </div>
        </div>
      ) : (
        <>
          <div className="card card--priority">
            <div className="card-kicker">PRIMARY GUIDANCE</div>
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
                <p><Link className="text-action" to={`/why/${rec.id}`}>WHY</Link></p>
                {decision ? (
                  <p><strong>Decision: {decisionLabel(decision)}</strong></p>
                ) : (
                  <>
                    <div className="action-row">
                      {rec.statusAtIssue === 'NO_ACTION_REQUIRED' ? (
                        <ActionButton busy={busy === 'decision-no_action'} busyLabel="RECORDING…" disabled={Boolean(busy && busy !== 'decision-no_action')} onClick={() => void decide('NO_ACTION')}>RECORD NO ACTION</ActionButton>
                      ) : (
                        <>
                          <ActionButton busy={busy === 'decision-accept'} busyLabel="ACCEPTING…" disabled={Boolean(busy && busy !== 'decision-accept')} onClick={() => void decide('ACCEPT')}>ACCEPT</ActionButton>
                          <ActionButton variant="secondary" busy={busy === 'decision-dismiss'} busyLabel="DISMISSING…" disabled={Boolean(busy && busy !== 'decision-dismiss')} onClick={() => void decide('DISMISS')}>DISMISS</ActionButton>
                        </>
                      )}
                    </div>
                    <p className="muted">Override:</p>
                    <div className="action-row">
                      <ActionButton variant="quiet" busy={busy === 'override-reset'} busyLabel="OPENING…" disabled={Boolean(busy && busy !== 'override-reset')} onClick={() => void override('START_RESET')}>RESET</ActionButton>
                      <ActionButton variant="quiet" busy={busy === 'override-shift-down'} busyLabel="STARTING…" disabled={Boolean(busy && busy !== 'override-shift-down')} onClick={() => void override('START_SHIFT_DOWN')}>SHIFT DOWN</ActionButton>
                    </div>
                  </>
                )}
              </>
            )}
          </div>

          <form className="card card--action" onSubmit={checkIn} aria-busy={busy === 'reassess'}>
            <div className="card-kicker">STATE INPUT</div>
            <h2>State check-in</h2>
            <div className="grid">
              {CHECK_IN_FIELDS.map((field) => (
                <label key={field.key}>
                  {field.label}
                  <input name={field.key} type="number" min={field.min} max={field.max} defaultValue={field.min} inputMode="numeric" required />
                </label>
              ))}
            </div>
            <p><ActionButton type="submit" busy={busy === 'reassess'} busyLabel="REASSESSING…" disabled={Boolean(busy && busy !== 'reassess')}>REASSESS</ActionButton></p>
          </form>

          <div className="card">
            <div className="card-kicker">CONTEXT</div>
            <h2>Context actions</h2>
            {workContext === 'WORK' && !workEnded && (
              <p><ActionButton variant="secondary" busy={busy === 'shift-ended'} busyLabel="SAVING…" disabled={Boolean(busy && busy !== 'shift-ended')} onClick={() => void finishWorkPeriod()}>SHIFT ENDED</ActionButton></p>
            )}
            <p><Link className="text-action" to="/reset">I NEED A RESET</Link></p>
            {!shiftDown ? (
              <ActionButton variant="secondary" busy={busy === 'shift-down-start'} busyLabel="STARTING…" disabled={Boolean(busy && busy !== 'shift-down-start')} onClick={() => void beginShiftDown()}>SHIFT DOWN</ActionButton>
            ) : (
              <>
                <p className="muted">SHIFT DOWN in progress.</p>
                <ol>{getShiftDownSteps().map((step) => <li key={step.id}>{step.label}</li>)}</ol>
                <ActionButton busy={busy === 'shift-down-complete'} busyLabel="COMPLETING…" disabled={Boolean(busy && busy !== 'shift-down-complete')} onClick={() => void finishShiftDown()}>COMPLETE SHIFT DOWN</ActionButton>
              </>
            )}
            <p><Link className="text-action" to={`/history/${dayId}`}>VIEW HISTORY</Link></p>
          </div>

          <MinimumDayCard dayId={dayId} />

          <div className="card">
            <div className="card-kicker">DAY LIFECYCLE</div>
            <h2>End day</h2>
            <ActionButton variant="secondary" busy={busy === 'end-day'} busyLabel="ENDING…" disabled={Boolean(busy && busy !== 'end-day')} onClick={() => void finishDay()}>END DAY</ActionButton>
            <p className="muted">Explicit wake-to-sleep boundary. Never midnight rollover.</p>
          </div>
        </>
      )}
    </section>
  );
}
