import type { StateCheckIn } from '../domain/checkin/types';
import type { DomainEvent } from '../domain/common/events';
import type { ISODateTime } from '../domain/common/types';
import type { BeyondDay } from '../domain/day/types';
import type { DecisionTrace, CommandName } from '../domain/recommendation/types';
import { deriveCapacity } from './capacity';

export const ENGINE_VERSION = '0.1.0';
export interface DerivedContext { hasPlannedWork?: boolean; }
export interface EngineInput { beyondDay: BeyondDay; latestCheckIn?: StateCheckIn; recentEvents: DomainEvent[]; context: DerivedContext; now: ISODateTime; }
export interface RecommendationDraft { kind: string; priority: number; title: string; rationale: string; suggestedCommand?: CommandName; statusAtIssue: 'ACTION'|'NO_ACTION_REQUIRED'; }
export interface EngineResult { derived: { capacity: 'GREEN'|'YELLOW'|'RED'|'UNKNOWN'; capacityReasons: string[] }; interpretations: string[]; primary: RecommendationDraft; trace: DecisionTrace; }

export function evaluate(input: EngineInput): EngineResult {
  const cap = input.latestCheckIn ? deriveCapacity(input.latestCheckIn) : { capacity: 'UNKNOWN' as const, reasons: ['CHECK_IN_REQUIRED'] };
  const stabilize = cap.capacity === 'RED';
  const recover = cap.capacity === 'YELLOW';
  const execute = cap.capacity === 'GREEN' && input.context.hasPlannedWork === true;
  let primary: RecommendationDraft;
  let selectionReason: string;

  if (!input.latestCheckIn) {
    primary = { kind:'CHECK_IN', priority:1, title:'Check in', rationale:'Current capacity is unknown.', statusAtIssue:'ACTION' };
    selectionReason='Current state is required before higher-order recommendations.';
  } else if (stabilize) {
    primary = { kind:'STABILIZE', priority:1, title:'Start a reset', rationale:'A severe capacity condition is present.', suggestedCommand:'START_RESET', statusAtIssue:'ACTION' };
    selectionReason='STABILIZE matched first.';
  } else if (recover) {
    primary = { kind:'RECOVER', priority:2, title:'Protect recovery', rationale:'Capacity is constrained.', suggestedCommand:'RECOVERY_SESSION', statusAtIssue:'ACTION' };
    selectionReason='RECOVER matched after STABILIZE did not.';
  } else if (execute) {
    primary = { kind:'EXECUTE_PLANNED_WORK', priority:3, title:'Execute planned work', rationale:'Capacity is green and planned work exists.', statusAtIssue:'ACTION' };
    selectionReason='EXECUTE_PLANNED_WORK matched.';
  } else {
    primary = { kind:'NO_ACTION_REQUIRED', priority:4, title:'No action required', rationale:'No higher-priority rule currently requires action.', statusAtIssue:'NO_ACTION_REQUIRED' };
    selectionReason='No higher-priority rule matched.';
  }

  const trace: DecisionTrace = {
    engineVersion:ENGINE_VERSION,
    evaluatedAt:input.now,
    inputs:[{key:'hasCheckIn',value:Boolean(input.latestCheckIn)},{key:'hasPlannedWork',value:Boolean(input.context.hasPlannedWork)}],
    derived:[{key:'capacity',value:cap.capacity}],
    matchedRules:[
      {ruleId:'STABILIZE',result:stabilize,reason:'RED capacity'},
      {ruleId:'RECOVER',result:recover,reason:'YELLOW capacity'},
      {ruleId:'EXECUTE_PLANNED_WORK',result:execute,reason:'GREEN capacity with planned work'}
    ],
    selectedRecommendation:primary.kind,
    selectionReason
  };

  return {
    derived:{capacity:cap.capacity,capacityReasons:cap.reasons},
    interpretations:[stabilize?'LOW_CAPACITY':recover?'RECOVERY_NEEDED':execute?'PLAN_CLEAR':'NO_CURRENT_ACTION'],
    primary,
    trace
  };
}
