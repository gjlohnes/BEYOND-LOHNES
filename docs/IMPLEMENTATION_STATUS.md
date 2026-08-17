# BEYOND V0.1 Implementation Status

## Branch
`agent/v0.1-foundation-field-001`

## COMPLETE
- React/Vite/TypeScript phone-first PWA shell with HashRouter and TODAY / TRAIN / BODY / MORE navigation.
- Core BeyondDay, StateCheckIn, DomainEvent, Recommendation, Outcome, Command, DecisionTrace, WorkoutSession, and PerformedSet contracts.
- Deterministic capacity and Engine priority baseline with first-class NO ACTION REQUIRED.
- Explicit START DAY / END DAY wake-to-sleep lifecycle, active-day recovery, concurrent-close safety, and meaningful event history.
- Persisted REASSESS, RESET, SHIFT DOWN, LOG_WATER, PROTEIN_ACTION, MINIMUM DAY, and TRAIN domain operations with validation and duplicate-command protection where applicable.
- Recommendation ACCEPT / DISMISS / OVERRIDE / NO ACTION history and outcomes with deep WHY evidence.
- BODY quick logging for water and protein; active-day totals reconstruct from meaningful events and remain offline-capable.
- TRAIN V0.1 product contract is locked and implemented for sequential A/B/C machine-oriented strength sessions, performed-set truth, previous-performance display, deterministic advisory progression, STANDARD / REDUCED / RECOVERY paths, session history, reload persistence, and offline operation.
- A/B/C rotation advances sequentially rather than resetting weekly. REDUCED uses the first two active-template exercises for two sets each; RECOVERY stores duration and does not advance the strength rotation.
- MINIMUM DAY product contract is locked and implemented as six BeyondDay-scoped minimums: HYDRATE, PROTEIN, MEDS, HYGIENE, MOVE, and RECOVER / CONNECT. Water/protein and qualifying recovery-session facts derive completion automatically; generic manual completion remains available without storing medication, hygiene, or relationship detail.
- Real additive Dexie V2 schema for `workoutSessions` and `performedSets`, with immutable V1 registration, a frozen V1 fixture, and tested V1→V2 migration preserving existing history.
- BEYOND_BACKUP format v1 remains application-owned; data schema v2 adds TRAIN arrays and in-memory migration for v1 backups rather than rejecting or dropping old history.
- Replace-only restoration still requires explicit confirmation and a pre-restore safety export; transaction rollback remains tested.
- Local diagnostics include application/data/Dexie/backup/Engine versions and TRAIN record counts.
- PWA manifest, near-black theme/background, 192/512/maskable icons, generateSW precache, and prompt update mode.
- Playwright production-preview FIELD/BODY/TRAIN acceptance covers persistence and offline core behavior.
- Read-only GitHub Actions validation; CI does not edit repository files.

## PARTIAL
- Actual OS/browser install-to-home-screen interaction remains a manual real-device acceptance check; manifest/icons/service-worker behavior is automated and validated.
- Backup download and replace-restore domain behavior is automated/tested, but a real-device/browser user-gesture round trip should be manually smoke-tested before depending on backups operationally.
- BODY V0.1 still lacks its dedicated sleep/recovery input path.
- MINIMUM DAY has unit/persistence coverage and TODAY UI, but does not yet have a dedicated Playwright workflow beyond the broader FIELD regression suite.
- TRAIN reduced/recovery domain paths are tested, while browser E2E currently exercises the STANDARD performed-set flow.

## NOT STARTED / INTENTIONALLY DEFERRED
- Post-V0.1 scope: AI/LLM, cloud sync, accounts/backend, MONEY, calendar/wearables, advanced analytics, voice, Mission Queue, broad household systems.
- Any Dexie V3 migration. V2 is the current legitimate TRAIN schema; do not invent V3 until a real schema requirement exists.

## BLOCKERS
- No current technical or product-contract blocker for TRAIN or MINIMUM DAY.
- Manual real-device PWA install and backup/restore UX smoke testing remain before operational reliance / merge recommendation.

## VALIDATION
Latest green Node 24 GitHub Actions validation on implementation head `8cd568381bf871135f789dd988aa249cc280ea63` (validate run 117):
- `npm ci`: PASS; 486 packages audited, 0 vulnerabilities reported.
- ESLint: PASS.
- Vitest: 17 files / 42 tests PASS.
- TypeScript + Vite production PWA build: PASS; 141 modules transformed.
- PWA generateSW: PASS; 7 precache entries; service worker generated.
- Playwright production-preview acceptance: 6/6 PASS.

Automated coverage now proves:
- START DAY / END DAY lifecycle and concurrency safety.
- deterministic REASSESS, one recommendation, WHY, decision persistence, RESET / SHIFT DOWN.
- reload persistence and service-worker-backed offline operation.
- backup validation, v1→v2 compatibility migration, replace-restore safety, and rollback behavior.
- BODY water/protein persistence including additional offline logging.
- TRAIN V1→V2 migration, A/B/C rotation, performed-set truth, progression derivation, reduced/recovery semantics, STANDARD browser flow, reload persistence, and offline reload.
- MINIMUM DAY enablement, automatic water/protein derivation, generic manual completion privacy boundary, and recovery-duration derivation.

## APPLIED DECISIONS
Canonical Spec, Decision Register, Implementation Roadmap, and V0.1 Foundation Build Spec remain authority. TRAIN and MINIMUM DAY contracts were consolidated into those existing documents instead of creating parallel specs. No backend, accounts, AI, cloud sync, MONEY, analytics SDK, broad exercise database, RPE/RIR collection, streaks, gamification, or task-manager behavior was added. Reduced capacity remains a legitimate path rather than failure.

## ENVIRONMENT
The interactive runtime is not the locked Node 24 execution environment, so executable dependency/build/browser validation is performed by read-only GitHub Actions on Node 24 using the committed lockfile.

## EXACT NEXT STEP
Keep the real-device acceptance queue open. The next highest-value V0.1 implementation gap is BODY sleep/recovery input, followed by focused browser acceptance for REDUCED / RECOVERY / MINIMUM DAY if needed for merge confidence. Do not merge automatically.
