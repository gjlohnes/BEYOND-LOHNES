import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getTodayState } from '../../../application/services/dayService';
import {
  completeReset,
  getActiveRitual,
  startReset,
} from '../../../application/services/ritualService';
import type { ResetIntensity } from '../../../domain/reset/types';
import { getResetGuidance } from '../../../engine/resetRules';

export function ResetScreen() {
  const [searchParams] = useSearchParams();
  const routeRecommendationId = searchParams.get('recommendationId') ?? undefined;
  const [dayId, setDayId] = useState<string | null>(null);
  const [intensity, setIntensity] = useState<ResetIntensity>(3);
  const [commandId, setCommandId] = useState<string | null>(null);
  const [activeRecommendationId, setActiveRecommendationId] = useState<string | undefined>(
    routeRecommendationId,
  );
  const [status, setStatus] = useState('');

  useEffect(() => {
    void getTodayState().then(async (state) => {
      const activeDayId = state.day?.id ?? null;
      setDayId(activeDayId);
      if (!activeDayId) return;

      const activeReset = await getActiveRitual(activeDayId, 'RESET');
      if (!activeReset) return;
      setCommandId(activeReset.commandId);
      if (activeReset.intensity) setIntensity(activeReset.intensity);
      if (activeReset.recommendationId) setActiveRecommendationId(activeReset.recommendationId);
      setStatus('RESET in progress.');
    });
  }, []);

  async function begin() {
    if (!dayId) return;
    try {
      const result = await startReset(dayId, intensity, routeRecommendationId);
      if (result.status === 'COMPLETED') {
        setCommandId(result.commandId);
        setActiveRecommendationId(routeRecommendationId);
        setStatus('RESET started. BODY BEFORE STORY.');
      } else {
        setStatus('RESET could not be started.');
      }
    } catch {
      setStatus('RESET could not be started. Your existing history was not changed.');
    }
  }

  async function complete() {
    if (!dayId || !commandId) return;
    try {
      await completeReset(dayId, commandId, activeRecommendationId);
      setStatus('RESET completed and stored.');
      setCommandId(null);
      setActiveRecommendationId(undefined);
    } catch {
      setStatus('RESET could not be completed. Your existing history remains stored.');
    }
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
                aria-label="Intensity"
                type="number"
                min={1}
                max={5}
                inputMode="numeric"
                value={intensity}
                disabled={Boolean(commandId)}
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
            {status && <p role="status" className="muted">{status}</p>}
          </div>
          <Link to="/today">Return to TODAY</Link>
        </>
      )}
    </section>
  );
}
