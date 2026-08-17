import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { endDay, getTodayState, startDay, submitCheckIn } from '../../../application/services/dayService';
import { decideRecommendation } from '../../../application/services/recommendationService';
import { completeShiftDown, startShiftDown } from '../../../application/services/ritualService';
import type { Recommendation } from '../../../domain/recommendation/types';
import { getShiftDownSteps } from '../../../engine/shiftDownRules';

export function TodayScreen() {
  const navigate = useNavigate();
  const [dayId, setDayId] = useState<string | null>(null);
  const [rec, setRec] = useState<Recommendation | null>(null);
  const [status, setStatus] = useState('');
  const [shiftDownCommandId, setShiftDownCommandId] = useState<string | null>(null);
  useEffect(() => { void getTodayState().then((state) => { setDayId(state.day?.id ?? null); setRec(state.recommendation); }); }, []);

  async function begin() { const day = await startDay('UNKNOWN'); setDayId(day.id); setStatus('BEYOND Day started.'); }
  async function finishDay() { if (!dayId) return; await endDay(dayId); setDayId(null); setRec(null); setStatus('BEYOND Day ended.'); }
  async function checkIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!dayId) return; const form = new FormData(event.currentTarget); const number = (key: string) => Number(form.get(key));
    try { const result = await submitCheckIn(dayId, { energy:number('energy') as 1|2|3|4|5, stress:number('stress') as 1|2|3|4|5, mood:number('mood') as 1|2|3|4|5, soreness:number('soreness') as 0|1|2|3|4|5, alcoholUrge:number('alcoholUrge') as 0|1|2|3|4|5 }); setRec(result.recommendation); setStatus('REASSESS completed.'); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Check-in rejected.'); }
  }
  async function decide(decision:'ACCEPT'|'DISMISS'|'NO_ACTION') { if(!rec)return; try { await decideRecommendation(rec.id,decision); setStatus(`${decision} stored.`); if(decision==='ACCEPT'&&rec.suggestedCommand==='START_RESET') navigate(`/reset?recommendationId=${rec.id}`); else if(decision==='ACCEPT'&&rec.suggestedCommand==='START_SHIFT_DOWN'&&dayId){const result=await startShiftDown(dayId,rec.id);if(result.status==='COMPLETED')setShiftDownCommandId(result.commandId);} } catch(error){setStatus(error instanceof Error?error.message:'Decision not stored.');} }
  async function override(command:'START_RESET'|'START_SHIFT_DOWN'){if(!rec)return;try{await decideRecommendation(rec.id,'OVERRIDE',command);setStatus(`OVERRIDE stored. ${command} selected.`);}catch(error){setStatus(error instanceof Error?error.message:'Override not stored.');}}
  async function beginShiftDown(){if(!dayId)return;const result=await startShiftDown(dayId);if(result.status==='COMPLETED'){setShiftDownCommandId(result.commandId);setStatus('SHIFT DOWN started and stored.');}else setStatus(result.errorCode??'SHIFT DOWN not started.');}
  async function finishShiftDown(){if(!dayId||!shiftDownCommandId)return;await completeShiftDown(dayId,shiftDownCommandId);setShiftDownCommandId(null);setStatus('SHIFT DOWN completed and stored.');}

  return <section><div className="eyebrow">BEYOND // TODAY</div><h1>Command</h1>{!dayId?<div className="card"><h2>No active day</h2><p className="muted">A BEYOND Day starts when you start it.</p><button onClick={begin}>START DAY</button></div>:<>
    <div className="card"><h2>{rec?.title??'State check-in required'}</h2><p>{rec?.rationale??'Record current state to produce one deterministic recommendation.'}</p>{rec&&<><p><Link to={`/why/${rec.id}`}>WHY</Link></p>{rec.statusAtIssue==='NO_ACTION_REQUIRED'?<button onClick={()=>decide('NO_ACTION')}>RECORD NO ACTION</button>:<><button onClick={()=>decide('ACCEPT')}>ACCEPT</button>{' '}<button onClick={()=>decide('DISMISS')}>DISMISS</button></>}<p className="muted">Override:</p><button onClick={()=>override('START_RESET')}>RESET</button>{' '}<button onClick={()=>override('START_SHIFT_DOWN')}>SHIFT DOWN</button></>}</div>
    <form className="card" onSubmit={checkIn}><h2>State check-in</h2><div className="grid">{[['energy',1,5],['stress',1,5],['mood',1,5],['soreness',0,5],['alcoholUrge',0,5]].map(([key,min,max])=><label key={String(key)}>{String(key)}<input name={String(key)} type="number" min={Number(min)} max={Number(max)} defaultValue={Number(min)} required/></label>)}</div><p><button type="submit">REASSESS</button></p></form>
    <div className="card"><h2>Context actions</h2><p><Link to="/reset">I NEED A RESET</Link></p>{!shiftDownCommandId?<button onClick={beginShiftDown}>SHIFT DOWN</button>:<><ol>{getShiftDownSteps().map((step)=><li key={step.id}>{step.label}</li>)}</ol><button onClick={finishShiftDown}>COMPLETE SHIFT DOWN</button></>}<p><Link to={`/history/${dayId}`}>VIEW HISTORY</Link></p></div>
    <div className="card"><h2>Day lifecycle</h2><button onClick={finishDay}>END DAY</button><p className="muted">Explicit wake-to-sleep boundary. Never midnight rollover.</p></div><p className="muted">{status}</p></>}</section>;
}
