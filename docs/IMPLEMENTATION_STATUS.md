# BEYOND V0.1 Implementation Status

## Branch
`agent/v0.1-foundation-field-001`

## COMPLETE
- React/Vite/TypeScript phone-first PWA shell with HashRouter and TODAY / TRAIN / BODY / MORE navigation.
- Core BeyondDay, StateCheckIn, DomainEvent, Recommendation, Outcome, Command, DecisionTrace, WorkoutSession, and PerformedSet contracts.
- Deterministic capacity and Engine priority baseline with first-class NO ACTION REQUIRED.
- Explicit START DAY / END DAY wake-to-sleep lifecycle, active-day recovery, concurrent-close safety, and meaningful event history.
- Persisted REASSESS, RESET, SHIFT DOWN, LOG_WATER, PROTEIN_ACTION, LOG_SLEEP, MINIMUM DAY, and TRAIN domain operations with validation and duplicate-command protection where applicable.
- Recommendation ACCEPT / DISMISS / OVERRIDE / NO ACTION history and outcomes with deep WHY evidence.
- BODY essentials now include water, protein, primary-sleep duration, and recovery. Sleep records only whole-minute duration of the primary sleep period immediately preceding the active BeyondDay; recovery reuses the existing RECOVERY session truth. BODY history reconstructs from committed events/sessions and remains reload/offline-capable.
- TRAIN V0.1 product contract is locked and implemented for sequential A/B/C machine-oriented strength sessions, performed-set truth, previous-performance display, deterministic advisory progression, STANDARD / REDUCED / RECOVERY paths, session history, reload persistence, and offline operation.
- A/B/C rotation advances sequentially rather than resetting weekly. REDUCED uses the first two active-template exercises for two sets each; RECOVERY stores duration and does not advance the strength rotation.
- MINIMUM DAY product contract is locked and implemented as six BeyondDay-scoped minimums: HYDRATE, PROTEIN, MEDS, HYGIENE, MOVE, and RECOVER / CONNECT. Water/protein and qualifying recovery-session facts derive completion automatically; generic manual completion remains available without storing medication, hygiene, or relationship detail.
- Real additive Dexie V2 schema for `workoutSessions` and `performedSets`, with immutable V1 registration, a frozen V1 fixture, and tested V1→V2 migration preserving existing history.
- Sleep is event-first and therefore required no dedicated table or Dexie V3. Application-owned BEYOND_BACKUP round-trip coverage proves SLEEP_LOGGED history survives replace restoration.
- BEYOND_BACKUP format v1 remains application-owned; data schema v2 adds TRAIN arrays and in-memory migration for v1 backups rather than rejecting or dropping old history.
- Replace-only restoration still requires explicit confirmation and a pre-restore safety export; transaction rollback remains tested.
- Local diagnostics include application/data/Dexie/backup/Engine versions and TRAIN record counts.
- PWA manifest, near-black theme/background, 192/512/maskable icons, generateSW precache, and prompt update mode.
- Playwright production-preview acceptance covers FIELD, BODY water/protein/recovery/sleep, STANDARD TRAIN, REDUCED TRAIN, persistence, and offline core behavior.
- Read-only GitHub Actions validation; CI does not edit repository files.

## PARTIAL
- Actual OS/browser install-to-home-screen interaction remains a manual real-device acceptance check; manifest/icons/service-worker behavior is automated and validated.
- Backup download and replace-restore domain/browser behavior is automated/tested, but a real-device/browser user-gesture round trip should be manually smoke-tested before depending on backups operationally.
- MINIMUM DAY has unit/persistence coverage and TODAY UI, but does not yet have a dedicated focused Playwright workflow. A previous speculative browser assertion was removed after it proved brittle rather than weakening or masking the failure.

## NOT STARTED / INTENTIONALLY DEFERRED
- Post-V0.1 scope: AI/LLM, cloud sync, accounts/backend, MONEY, calendar/wearables, advanced analytics, voice, Mission Queue, broad household systems.
- Sleep quality ratings, sleep stages, bedtime/wake timestamps, naps, sleep scoring, goals/streaks, wearable sleep data, and advanced sleep analytics.
- Any Dexie V3 migration. V2 remains the current legitimate schema; do not invent V3 without a real storage requirement.

## BLOCKERS
- No current technical or product-contract blocker for FIELD, BODY essentials, TRAIN, or MINIMUM DAY.
- Manual real-device PWA install and real-browser backup/restore UX smoke testing remain before operational reliance / merge recommendation.

## VALIDATION
Current implementation head before this documentation-only status commit, `3fbe8457bee33526093968d270cabd5e657bc5a9`, is green under Node 24 in validate run 161:
- `npm ci`: PASS.
- ESLint: PASS.
- Vitest: PASS.
- TypeScript + Vite production PWA build: PASS.
- Playwright production-preview acceptance: PASS.

During sleep implementation, a test exposed that BODY reconstruction had relied on unspecified IndexedDB return order. BODY event reconstruction was hardened to use the existing `[beyondDayId+occurredAt]` chronological index. A same-millisecond synthetic correction assertion still could not establish a legitimate ordering guarantee, so the test was corrected to verify the actual doctrine: repeated sleep facts remain preserved history rather than being erased. No sequence field, mutable replacement record, or new schema was invented.

Automated coverage now proves:
- START DAY / END DAY lifecycle and concurrency safety.
- deterministic REASSESS, one recommendation, WHY, decision persistence, RESET / SHIFT DOWN.
- reload persistence and service-worker-backed offline operation.
- backup validation, v1→v2 compatibility migration, replace-restore safety, rollback behavior, and sleep-event preservation.
- BODY water/protein/sleep persistence plus BODY recovery duration, including sleep/recovery offline reload.
- TRAIN V1→V2 migration, A/B/C rotation, performed-set truth, progression derivation, STANDARD / REDUCED / RECOVERY semantics, STANDARD browser flow, REDUCED browser flow, reload persistence, and offline reload.
- MINIMUM DAY enablement, automatic water/protein derivation, generic manual completion privacy boundary, and recovery-duration derivation at unit/persistence level.

## APPLIED DECISIONS
Canonical Spec, Decision Register, Implementation Roadmap, and V0.1 Foundation Build Spec remain authority. The minimum sleep contract is now explicitly recorded in the Canonical Spec and Decision Register: one manual whole-minute duration for the primary sleep period immediately preceding the active BeyondDay, stored as meaningful event history. It is a historical fact only, not a score or medical interpretation. No dedicated sleep table, Dexie V3, quality/stage tracking, bedtime/wake timestamps, nap model, wearable integration, or advanced analytics were introduced. No other locked product decision changed.

## ENVIRONMENT
The interactive runtime is not the locked Node 24 execution environment, so executable dependency/build/browser validation is performed by read-only GitHub Actions on Node 24 using the committed lockfile.

## EXACT NEXT STEP
The highest-value remaining V0.1 work is acceptance rather than another feature layer: perform the real-device Android install/add-to-home-screen standalone smoke test and a real-browser backup export → validate → replace-restore round trip. Keep PR #1 draft and do not merge automatically. A focused MINIMUM DAY browser workflow can be added later only if it materially improves merge confidence without duplicating existing decision/persistence coverage.
