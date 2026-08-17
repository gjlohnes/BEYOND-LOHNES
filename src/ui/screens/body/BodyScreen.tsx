import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  completeBodyRecovery,
  getBodyState,
  logProtein,
  logSleep,
  logWater,
  startBodyRecovery,
  type BodyState,
} from '../../../application/services/bodyService';

const EMPTY_STATE: BodyState = {
  dayId: null,
  waterOz: 0,
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

export function BodyScreen() {
  const [body, setBody] = useState<BodyState>(EMPTY_STATE);
  const [status, setStatus] = useState('');

  async function refresh() {
    setBody(await getBodyState());
  }

  useEffect(() => {
    void getBodyState().then(setBody);
  }, []);

  async function submitWater(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const amountOz = Number(form.get('waterOz'));
    const result = await logWater(body.dayId, amountOz);
    if (result.status !== 'COMPLETED') {
      setStatus(result.errorCode ?? 'Water log rejected.');
      return;
    }
    formElement.reset();
    setStatus(`${amountOz} oz water logged.`);
    await refresh();
  }

  async function submitProtein(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const grams = Number(form.get('proteinGrams'));
    const result = await logProtein(body.dayId, grams);
    if (result.status !== 'COMPLETED') {
      setStatus(result.errorCode ?? 'Protein log rejected.');
      return;
    }
    formElement.reset();
    setStatus(`${grams} g protein logged.`);
    await refresh();
  }

  async function submitSleep(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.dayId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const hours = Number(form.get('sleepHours'));
    const minutes = Number(form.get('sleepMinutes'));
    const durationMinutes = hours * 60 + minutes;
    const result = await logSleep(body.dayId, durationMinutes);
    if (result.status !== 'COMPLETED') {
      setStatus(result.errorCode ?? 'Sleep log rejected.');
      return;
    }
    formElement.reset();
    setStatus(`${formatSleep(durationMinutes)} sleep logged.`);
    await refresh();
  }

  async function beginRecovery() {
    if (!body.dayId) return;
    try {
      await startBodyRecovery(body.dayId);
      setStatus('Recovery session started.');
      await refresh();
    } catch (error) {
      setStatus(
        error instanceof Error && error.message === 'WORKOUT_ALREADY_ACTIVE'
          ? 'Finish the active TRAIN session before starting recovery.'
          : 'Recovery session could not be started.',
      );
    }
  }

  async function submitRecovery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!body.activeRecoverySessionId) return;
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const durationMinutes = Number(form.get('recoveryMinutes'));
    try {
      const session = await completeBodyRecovery(body.activeRecoverySessionId, durationMinutes);
      formElement.reset();
      setStatus(
        session.status === 'COMPLETED'
          ? `${durationMinutes} min recovery logged.`
          : session.status === 'PARTIAL'
            ? `${durationMinutes} min recovery logged as partial.`
            : 'Recovery session ended with no movement logged.',
      );
      await refresh();
    } catch {
      setStatus('Recovery duration must be a whole number of minutes, 0 or greater.');
    }
  }

  return (
    <section>
      <div className="eyebrow">BODY</div>
      <h1>Essentials only</h1>
      {status && (
        <p role="status" className="card">
          {status}
        </p>
      )}
      {!body.dayId ? (
        <div className="card">
          <h2>No active day</h2>
          <p className="muted">Start a BEYOND Day before recording body inputs.</p>
          <Link to="/today">GO TO TODAY</Link>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>Current day</h2>
            <p>
              <strong>Water:</strong> {body.waterOz} oz
            </p>
            <p>
              <strong>Protein:</strong> {body.proteinGrams} g
            </p>
            <p>
              <strong>Sleep:</strong> {formatSleep(body.sleepMinutes)}
            </p>
            <p>
              <strong>Recovery:</strong> {body.recoveryMinutes} min
            </p>
            <p className="muted">Only committed events and sessions count. No hidden daily telemetry.</p>
          </div>
          <form className="card" onSubmit={submitWater}>
            <h2>Log water</h2>
            <label>
              Water (oz)
              <input name="waterOz" type="number" min="0.1" step="0.1" required />
            </label>
            <p>
              <button type="submit">LOG WATER</button>
            </p>
          </form>
          <form className="card" onSubmit={submitProtein}>
            <h2>Log protein</h2>
            <label>
              Protein (g)
              <input name="proteinGrams" type="number" min="0.1" step="0.1" required />
            </label>
            <p>
              <button type="submit">LOG PROTEIN</button>
            </p>
          </form>
          <form className="card" onSubmit={submitSleep}>
            <h2>Log sleep</h2>
            <p className="muted">Primary sleep before this BEYOND Day. Duration only.</p>
            <label>
              Sleep hours
              <input name="sleepHours" type="number" min="0" max="24" step="1" inputMode="numeric" required />
            </label>
            <label>
              Sleep minutes
              <input name="sleepMinutes" type="number" min="0" max="59" step="1" inputMode="numeric" defaultValue="0" required />
            </label>
            <p>
              <button type="submit">LOG SLEEP</button>
            </p>
          </form>
          <div className="card">
            <h2>Recovery</h2>
            <p className="muted">Easy movement or mobility. Duration is the only required input.</p>
            {body.activeRecoverySessionId ? (
              <form onSubmit={submitRecovery}>
                <label>
                  Recovery minutes
                  <input
                    name="recoveryMinutes"
                    type="number"
                    min="0"
                    step="1"
                    inputMode="numeric"
                    required
                  />
                </label>
                <p>
                  <button type="submit">END & LOG RECOVERY</button>
                </p>
              </form>
            ) : (
              <button type="button" onClick={() => void beginRecovery()}>
                START RECOVERY
              </button>
            )}
          </div>
        </>
      )}
    </section>
  );
}
