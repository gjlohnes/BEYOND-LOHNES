export const MINIMUM_DAY_ITEMS = [
  { key: 'HYDRATE', label: 'Hydrate', requirement: '40 oz water' },
  { key: 'PROTEIN', label: 'Protein', requirement: '25 g protein' },
  { key: 'MEDS', label: 'Meds', requirement: 'Scheduled medications handled' },
  { key: 'HYGIENE', label: 'Hygiene', requirement: 'Basic hygiene completed' },
  { key: 'MOVE', label: 'Move', requirement: '5 minutes intentional movement' },
  {
    key: 'RECOVER_CONNECT',
    label: 'Recover / Connect',
    requirement: '10 minutes intentional recovery, presence, or connection',
  },
] as const;

export type MinimumDayItemKey = (typeof MINIMUM_DAY_ITEMS)[number]['key'];

export interface MinimumDayItemState {
  key: MinimumDayItemKey;
  label: string;
  requirement: string;
  complete: boolean;
  source: 'AUTO' | 'MANUAL' | null;
}

export interface MinimumDayState {
  enabled: boolean;
  items: MinimumDayItemState[];
}
