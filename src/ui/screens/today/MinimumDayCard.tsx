import { useEffect, useState } from 'react';
import {
  completeMinimumItem,
  enableMinimumDay,
  getMinimumDayState,
} from '../../../application/services/minimumDayService';
import type { MinimumDayState } from '../../../domain/minimumDay/types';

export function MinimumDayCard({ dayId }: { dayId: string }) {
  const [state, setState] = useState<MinimumDayState | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void getMinimumDayState(dayId).then(setState);
  }, [dayId]);

  async function enable() {
    try {
      setState(await enableMinimumDay(dayId));
      setStatus('MINIMUM DAY enabled for this BEYOND Day.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'MINIMUM DAY could not be enabled.');
    }
  }

  async function complete(key: MinimumDayState['items'][number]['key']) {
    try {
      setState(await completeMinimumItem(dayId, key));
      setStatus('Minimum recorded.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Minimum could not be recorded.');
    }
  }

  if (!state) return null;

  return (
    <div className="card">
      <h2>Minimum Day</h2>
      {status && <p role="status">{status}</p>}
      {!state.enabled ? (
        <>
          <p className="muted">Use the six-minimum baseline when normal execution is not useful.</p>
          <button onClick={enable}>ENABLE MINIMUM DAY</button>
        </>
      ) : (
        <>
          <p className="muted">Reduced expectations are active until this BEYOND Day ends.</p>
          {state.items.map((item) => (
            <div key={item.key}>
              <p>
                <strong>{item.label}:</strong> {item.complete ? 'COMPLETE' : 'OPEN'} ·{' '}
                {item.requirement}
                {item.complete && item.source ? ` · ${item.source}` : ''}
              </p>
              {!item.complete && <button onClick={() => complete(item.key)}>MARK COMPLETE</button>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
