import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getWhyContext } from '../../../application/queries/history';
import type { DomainEvent } from '../../../domain/common/events';
import type { Outcome, Recommendation } from '../../../domain/recommendation/types';

type Context = {
  recommendation: Recommendation;
  events: DomainEvent[];
  outcomes: Outcome[];
};

export function WhyScreen() {
  const { recommendationId } = useParams();
  const [context, setContext] = useState<Context | null>(null);

  useEffect(() => {
    if (!recommendationId) return;
    void getWhyContext(recommendationId).then((result) => setContext(result as Context | null));
  }, [recommendationId]);

  if (!context) {
    return <section><div className="eyebrow">BEYOND // WHY</div><p>Recommendation not found.</p></section>;
  }

  const { recommendation, events, outcomes } = context;
  return (
    <section>
      <div className="eyebrow">BEYOND // WHY</div>
      <h1>{recommendation.title}</h1>
      <div className="card">
        <h2>Observed</h2>
        <ul>{recommendation.trace.inputs.map((item) => <li key={item.key}>{item.key}: {String(item.value)}</li>)}</ul>
        <h2>Derived</h2>
        <ul>{recommendation.trace.derived.map((item) => <li key={item.key}>{item.key}: {String(item.value)}</li>)}</ul>
        <h2>Rules</h2>
        <ul>{recommendation.trace.matchedRules.map((rule) => <li key={rule.ruleId}>{rule.ruleId}: {rule.result ? 'matched' : 'not matched'} — {rule.reason}</li>)}</ul>
        <h2>Selection</h2>
        <p>{recommendation.trace.selectionReason}</p>
      </div>
      <div className="card">
        <h2>User decision + what happened</h2>
        {events.length === 0 && outcomes.length === 0 ? <p className="muted">No decision or outcome recorded yet.</p> : null}
        {events.map((event) => <p key={event.id}><strong>{event.type}</strong></p>)}
        {outcomes.map((outcome) => <p key={outcome.id}>Outcome: <strong>{outcome.result}</strong></p>)}
      </div>
      <Link to="/today">Return to TODAY</Link>
    </section>
  );
}
