import type { ISODateTime, UUID } from '../common/types';
export interface StateCheckIn { id: UUID; beyondDayId: UUID; recordedAt: ISODateTime; energy: 1|2|3|4|5; stress: 1|2|3|4|5; mood: 1|2|3|4|5; soreness: 0|1|2|3|4|5; alcoholUrge: 0|1|2|3|4|5; }
