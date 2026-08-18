import { describe, expect, it } from 'vitest';
import { deriveCapacity } from '../../src/engine/capacity';
const base={id:'1',beyondDayId:'d',recordedAt:'2026-01-01T00:00:00Z',energy:3 as const,stress:3 as const,mood:3 as const,soreness:2 as const,alcoholUrge:0 as const};
describe('deriveCapacity',()=>{it('returns RED for severe conditions',()=>expect(deriveCapacity({...base,stress:5})).toMatchObject({capacity:'RED'}));it('returns YELLOW for constrained conditions',()=>expect(deriveCapacity({...base,soreness:4})).toMatchObject({capacity:'YELLOW'}));it('returns GREEN otherwise',()=>expect(deriveCapacity(base)).toEqual({capacity:'GREEN',reasons:['BASELINE_CLEAR']}));});
