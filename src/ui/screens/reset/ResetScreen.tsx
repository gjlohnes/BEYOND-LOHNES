import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getTodayState } from '../../../application/services/dayService';
import { completeReset, startReset } from '../../../application/services/ritualService';
import type { ResetIntensity } from '../../../domain/reset/types';
import { getResetGuidance } from '../../../engine/resetRules';

export function ResetScreen() {
  const [dayId, setDayId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<ResetIntensity>(3);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void getTodayState().then((state) => setDayId(state.day?.id ?? null));
  }, []);

  async function begin() {
    if (!dayId) return;
    const result = await startReset(dayId, intensity);
    if (result.status === 'COMPLETED') {
      setCommandId(result.commandId);
      setStatus('RESET started. BODY BEFORE STORY.');
    } else {
      setStatus(`RESET not started: ${result.errorCode ?? 'unknown error'}`);
    }
  }

  async function complete() {
    if (!dayId || !commandId) return;
    await completeReset(dayId, commandId);
    setStatus('RESET completed and stored.');
    setCommandId(null);
  }

  return (
    <section>
      <div className="eyebrow">BEYOND // RESET</div>
      <h1>I NEED A RESET</h1>
      {!dayId ? (
        <div className="card">
          <p>No active BEYOND Day.</p>
          <Link to="/today">Return to TODAY</Link>
        </div>
      ) : (
        <>
          <div className="card">
            <h2>BODY BEFORE STORY</h2>
            <p className="muted">Set intensity. Start the reset. Analysis can wait.</p>
            <p>{getResetGuidance(intensity).instruction}</p>
            <label>
              Intensity 1–5
              <input
                type="number"
                min={1}
                max={5}
                value={intensity}
                onChange={(event) => setIntensity(Number(event.target.value) as ResetIntensity)}
              />
            </label>
            <p>
              {!commandId ? (
                <button onClick={begin}>START RESET</button>
              ) : (
                <button onClick={complete}>COMPLETE RESET</button>
              )}
            </p>
            <p className="muted">{status}</p>
          </div>
          <Link to="/today">Return to TODAY</Link>
        </>
      )}
    </section>
  );
}
