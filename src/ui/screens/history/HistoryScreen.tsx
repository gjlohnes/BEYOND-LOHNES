import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getDayHistory } from '../../../application/queries/history';
import type { DomainEvent } from '../../../domain/common/events';

export function HistoryScreen() {
  const { dayId } = useParams();
  const [events, setEvents] = useState<DomainEvent[]>([]);

  useEffect(() => {
    if (!dayId) return;
    void getDayHistory(dayId).then(setEvents);
  }, [dayId]);

  return (
    <section>
      <div className="eyebrow">BEYOND // HISTORY</div>
      <h1>What happened</h1>
      <div className="card">
        {events.length === 0 ? (
          <p className="muted">No stored events.</p>
        ) : (
          <ol>
            {events.map((event) => (
              <li key={event.id}>
                <strong>{event.type}</strong>
                <div className="muted">{new Date(event.occurredAt).toLocaleString()}</div>
              </li>
            ))}
          </ol>
        )}
      </div>
      <Link to="/today">Return to TODAY</Link>
    </section>
  );
}
