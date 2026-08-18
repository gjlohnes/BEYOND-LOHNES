import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  completeBodyRecovery,
  correctWaterLog,
  getBodyState,
  logProtein,
  logSleep,
  logWater,
  startBodyRecovery,
  type BodyState,
} from '../../../application/services/bodyService';
import type { WaterEntry } from '../../../domain/body/water';
import { ActionButton } from '../../components/ActionButton';

const EMPTY_STATE: BodyState = {
  dayId: null,
  waterOz: 0,
  waterEntries: [],
  proteinGrams: 0,
  sleepMinutes: null,
  recoveryMinutes: 0,
  activeRecoverySessionId: null,
};

function formatSleep(minutes: number | null) {
  if (minutes === null) return 'Not logged';
  const hours = Math.floor(minutes / 60);
  const remaining = minutes % 60;
  if (hours === 0) return `${remaining} min`;
  if (remaining === 0) return `${hours} hr`;
  return `${hours} hr ${remaining} min`;
}

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export function BodyScreen() {
  const [body, setBody] = useState<BodyState>(EMPTY_STATE);
  const [status, setStatus] = useState('');
  const [statusTone, setStatusTone] = useState<'success' | 'error' | 'info'>('info');
  const [busy, setBusy] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState<WaterEntry | null>(null);

  async function refresh() {
    setBody(await getBodyState());
  }

  function report(message: string, tone: 'success' | 'error' | 'info') {
    setStatus(message);
    setStatusTone(tone);
  }

  useEffect(() => {
    void getBodyState().then(setBody);
  }, []);

  async function submitWater(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId || busy) return;
    const formElement = event.currentTarget;
    const amountOz = Number(new FormData(formElement).get('waterOz'));
    setBusy('water');
    try {
      const result = await logWater(body.dayId, amountOz);
      if (result.status !== 'COMPLETED') {
        report('Water could not be logged. Enter an amount greater than zero and try again.', 'error');
        return;
      }
      formElement.reset();
      report(`${amountOz} oz water logged.`, 'success');
      await refresh();
    } catch {
      report('Water could not be logged. Your existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId || !correcting || busy) return;
    const amountOz = Number(new FormData(event.currentTarget).get('correctedWaterOz'));
    setBusy('correct-water');
    try {
      const result = await correctWaterLog(
        body.dayId,
        correcting.originalEventId,
        correcting.currentEventId,
        amountOz,
      );
      if (result.status !== 'COMPLETED') {
        report(
          result.errorCode === 'STALE_CORRECTION_TARGET'
            ? 'That entry changed before this correction saved. Review the current value and try again.'
            : 'Water correction could not be saved. Existing history was not changed.',
          'error',
        );
        await refresh();
        setCorrecting(null);
        return;
      }
      report(`Water entry corrected to ${amountOz} oz. Original history preserved.`, 'success');
      setCorrecting(null);
      await refresh();
    } catch {
      report('Water correction could not be saved. Existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function submitProtein(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId || busy) return;
    const formElement = event.currentTarget;
    const grams = Number(new FormData(formElement).get('proteinGrams'));
    setBusy('protein');
    try {
      const result = await logProtein(body.dayId, grams);
      if (result.status !== 'COMPLETED') {
        report('Protein could not be logged. Enter an amount greater than zero and try again.', 'error');
        return;
      }
      formElement.reset();
      report(`${grams} g protein logged.`, 'success');
      await refresh();
    } catch {
      report('Protein could not be logged. Your existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function submitSleep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId || busy) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const durationMinutes = Number(form.get('sleepHours')) * 60 + Number(form.get('sleepMinutes'));
    setBusy('sleep');
    try {
      const result = await logSleep(body.dayId, durationMinutes);
      if (result.status !== 'COMPLETED') {
        report('Sleep could not be logged. Enter a primary-sleep duration greater than zero.', 'error');
        return;
      }
      formElement.reset();
      report(`${formatSleep(durationMinutes)} sleep logged.`, 'success');
      await refresh();
    } catch {
      report('Sleep could not be logged. Your existing history was not changed.', 'error');
    } finally {
      setBusy(null);
    }
  }

  async function beginRecovery() {
    if (!body.dayId || busy) return;
    setBusy('recovery-start');
    try {
      await startBodyRecovery(body.dayId);
      report('Recovery session started.', 'success');
      await refresh();
    } catch (error) {
      report(
        error instanceof Error && error.message === 'WORKOUT_ALREADY_ACTIVE'
          ? 'Finish the active TRAIN session before starting recovery.'
          : 'Recovery session could not be started.',
        'error',
      );
    } finally {
      setBusy(null);
    }
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.activeRecoverySessionId || busy) return;
    const formElement = event.currentTarget;
    const durationMinutes = Number(new FormData(formElement).get('recoveryMinutes'));
    setBusy('recovery-end');
    try {
      const session = await completeBodyRecovery(body.activeRecoverySessionId, durationMinutes);
      formElement.reset();
      report(
        session.status === 'COMPLETED'
          ? `${durationMinutes} min recovery logged.`
          : session.status === 'PARTIAL'
            ? `${durationMinutes} min recovery logged as partial.`
            : 'Recovery session ended with no movement logged.',
        'success',
      );
      await refresh();
    } catch {
      report('Recovery duration must be a whole number of minutes, 0 or greater.', 'error');
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="screen screen--body">
      <div className="screen-heading">
        <div>
          <div className="eyebrow">BODY // ESSENTIALS</div>
          <h1>Readiness inputs</h1>
        </div>
        <span className="status-chip">LOCAL</span>
      </div>
      <p className="screen-intro muted">Fast inputs. Committed history only. Correct mistakes without erasing what happened.</p>
      {status && <p role="status" aria-live="polite" className={`feedback feedback--${statusTone}`}>{status}</p>}
      {!body.dayId ? (
        <div className="card card--priority">
          <div className="card-kicker">DAY REQUIRED</div>
          <h2>No active day</h2>
          <p className="muted">Start a BEYOND Day before recording body inputs.</p>
          <Link className="text-action" to="/today">GO TO TODAY</Link>
        </div>
      ) : (
        <>
          <div className="metric-grid">
            <div className="metric-card"><span>WATER</span><strong>{body.waterOz} oz</strong></div>
            <div className="metric-card"><span>PROTEIN</span><strong>{body.proteinGrams} g</strong></div>
            <div className="metric-card"><span>SLEEP</span><strong>{formatSleep(body.sleepMinutes)}</strong></div>
            <div className="metric-card"><span>RECOVERY</span><strong>{body.recoveryMinutes} min</strong></div>
          </div>

          <form className="card card--action" onSubmit={submitWater} aria-busy={busy === 'water'}>
            <div className="card-kicker">HYDRATION</div>
            <h2>Log water</h2>
            <label className="field-label">Water (oz)<input name="waterOz" type="number" min="0.1" step="0.1" inputMode="decimal" required /></label>
            <ActionButton type="submit" busy={busy === 'water'} busyLabel="LOGGING…">LOG WATER</ActionButton>
          </form>

          {body.waterEntries.length > 0 && (
            <div className="card">
              <div className="card-kicker">TODAY'S HYDRATION HISTORY</div>
              <h2>Water entries</h2>
              <p className="muted">Correction preserves the original fact and changes only the effective value.</p>
              <div className="entry-list">
                {body.waterEntries.map((entry) => (
                  <div className="entry-row" key={entry.originalEventId}>
                    <div><strong>{entry.amountOz} oz</strong><div className="entry-meta">{formatTime(entry.loggedAt)}{entry.correctionCount ? ` · corrected ${entry.correctionCount}x` : ''}</div></div>
                    <ActionButton type="button" variant="secondary" disabled={Boolean(busy)} onClick={() => setCorrecting(entry)}>CORRECT</ActionButton>
                  </div>
                ))}
              </div>
            </div>
          )}

          {correcting && (
            <form className="card correction-card" onSubmit={submitCorrection} aria-busy={busy === 'correct-water'}>
              <div className="card-kicker">CORRECTION // HISTORY PRESERVED</div>
              <h2>Correct water entry</h2>
              <p>Current value: <strong>{correcting.amountOz} oz</strong> · logged {formatTime(correcting.loggedAt)}</p>
              <p className="muted">The original entry remains in history. This correction becomes the effective value used by BODY and MINIMUM DAY.</p>
              <label className="field-label">Correct amount (oz)<input name="correctedWaterOz" type="number" min="0.1" step="0.1" inputMode="decimal" defaultValue={correcting.amountOz} required /></label>
              <div className="action-row">
                <ActionButton type="submit" busy={busy === 'correct-water'} busyLabel="CORRECTING…">CONFIRM CORRECTION</ActionButton>
                <ActionButton type="button" variant="quiet" disabled={busy === 'correct-water'} onClick={() => setCorrecting(null)}>CANCEL</ActionButton>
              </div>
            </form>
          )}

          <form className="card card--action" onSubmit={submitProtein} aria-busy={busy === 'protein'}>
            <div className="card-kicker">NUTRITION</div><h2>Log protein</h2>
            <label className="field-label">Protein (g)<input name="proteinGrams" type="number" min="0.1" step="0.1" inputMode="decimal" required /></label>
            <ActionButton type="submit" busy={busy === 'protein'} busyLabel="LOGGING…">LOG PROTEIN</ActionButton>
          </form>

          <form className="card card--action" onSubmit={submitSleep} aria-busy={busy === 'sleep'}>
            <div className="card-kicker">PRIMARY SLEEP</div><h2>Log sleep</h2>
            <p className="muted">Primary sleep before this BEYOND Day. Duration only.</p>
            <div className="grid">
              <label className="field-label">Hours<input name="sleepHours" type="number" min="0" max="24" step="1" inputMode="numeric" required /></label>
              <label className="field-label">Minutes<input name="sleepMinutes" type="number" min="0" max="59" step="1" inputMode="numeric" defaultValue="0" required /></label>
            </div>
            <ActionButton type="submit" busy={busy === 'sleep'} busyLabel="LOGGING…">LOG SLEEP</ActionButton>
          </form>

          <div className="card card--action">
            <div className="card-kicker">RECOVERY</div><h2>Easy movement / mobility</h2>
            <p className="muted">Duration is the only required input.</p>
            {body.activeRecoverySessionId ? (
              <form onSubmit={submitRecovery} aria-busy={busy === 'recovery-end'}>
                <label className="field-label">Recovery minutes<input name="recoveryMinutes" type="number" min="0" step="1" inputMode="numeric" required /></label>
                <ActionButton type="submit" busy={busy === 'recovery-end'} busyLabel="SAVING…">END & LOG RECOVERY</ActionButton>
              </form>
            ) : (
              <ActionButton type="button" busy={busy === 'recovery-start'} busyLabel="STARTING…" onClick={() => void beginRecovery()}>START RECOVERY</ActionButton>
            )}
          </div>
        </>
      )}
    </section>
  );
}
