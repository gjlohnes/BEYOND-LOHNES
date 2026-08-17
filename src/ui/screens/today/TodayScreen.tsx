import { useEffect, useState, type FormEvent } from 'react';
import { getTodayState, startDay, submitCheckIn } from '../../../application/services/dayService';
import type { Recommendation } from '../../../domain/recommendation/types';

export function TodayScreen() {
  const [dayId, setDayId] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [status, setStatus] = useState('');

  useEffect(() => {
    void getTodayState().then((state) => {
      setDayId(state.day?.id ?? null);
      setRec(state.recommendation);
    });
  }, []);

  async function begin() {
    const day = await startDay('UNKNOWN');
    setDayId(day.id);
  }

  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!dayId) return;
    const form = new FormData(event.currentTarget);
    const number = (key: string) => Number(form.get(key));
    const result = await submitCheckIn(dayId, {
      energy: number('energy') as 1|2|3|4|5,
      stress: number('stress') as 1|2|3|4|5,
      mood: number('mood') as 1|2|3|4|5,
      soreness: number('soreness') as 0|1|2|3|4|5,
      alcoholUrge: number('alcoholUrge') as 0|1|2|3|4|5,
    });
    setRec(result.recommendation);
    setStatus('Check-in stored.');
  }

  return <section>
    <div className="eyebrow">BEYOND // TODAY</div><h1>Command</h1>
    {!dayId ? <div className="card"><h2>No active day</h2><p className="muted">A BEYOND Day starts when you start it.</p><button onClick={begin}>START DAY</button></div> : <>
      <div className="card"><h2>{rec?.title ?? 'State check-in required'}</h2><p>{rec?.rationale ?? 'Record current state to produce one deterministic recommendation.'}</p>{rec && <details><summary>WHY</summary><p>{rec.trace.selectionReason}</p><code>{rec.trace.engineVersion}</code></details>}</div>
      <form className="card" onSubmit={checkIn}><h2>State check-in</h2><div className="grid">{[['energy',1,5],['stress',1,5],['mood',1,5],['soreness',0,5],['alcoholUrge',0,5]].map(([key,min,max]) => <label key={String(key)}>{String(key)}<input name={String(key)} type="number" min={Number(min)} max={Number(max)} defaultValue={Number(min)} required/></label>)}</div><p><button type="submit">REASSESS</button></p><small className="muted">{status}</small></form>
      <div className="card"><button onClick={() => setStatus('RESET workflow is the next command-stage implementation.')}>I NEED A RESET</button> <button onClick={() => setStatus('SHIFT DOWN workflow is the next command-stage implementation.')}>SHIFT DOWN</button><p className="muted">{status}</p></div>
    </>}
  </section>;
}
