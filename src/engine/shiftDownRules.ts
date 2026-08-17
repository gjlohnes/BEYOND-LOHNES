export interface ShiftDownStep {
  id: 'END_WORK_MODE' | 'BODY_NEEDS' | 'RETURN_ATTENTION';
  label: string;
}

export function getShiftDownSteps(): ShiftDownStep[] {
  return [
    { id: 'END_WORK_MODE', label: 'Close work mode.' },
    { id: 'BODY_NEEDS', label: 'Handle basic body needs.' },
    { id: 'RETURN_ATTENTION', label: 'Return attention to off-duty life.' },
  ];
}
