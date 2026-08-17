export const V1_DATABASE_FIXTURE = {
  meta: [{ key: 'schemaVersion', value: 1 }],
  beyondDay: {
    id: '11111111-1111-4111-8111-111111111111',
    schemaVersion: 1,
    startedAt: '2026-08-17T12:00:00.000Z',
    timezoneId: 'America/Chicago',
    workContext: 'OFF_DUTY' as const,
    status: 'ACTIVE' as const,
    createdAt: '2026-08-17T12:00:00.000Z',
    updatedAt: '2026-08-17T12:00:00.000Z',
  },
  event: {
    id: '22222222-2222-4222-8222-222222222222',
    schemaVersion: 1,
    type: 'DAY_STARTED' as const,
    beyondDayId: '11111111-1111-4111-8111-111111111111',
    occurredAt: '2026-08-17T12:00:00.000Z',
    recordedAt: '2026-08-17T12:00:00.000Z',
    payload: { workContext: 'OFF_DUTY' },
    source: 'USER' as const,
  },
};
