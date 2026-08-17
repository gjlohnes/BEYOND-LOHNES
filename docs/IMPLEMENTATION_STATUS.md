# BEYOND V0.1 Implementation Status

## Branch
`agent/v0.1-foundation-field-001`

## Complete
- React/Vite/TypeScript PWA shell with HashRouter and TODAY / TRAIN / BODY / MORE navigation.
- Core BeyondDay, StateCheckIn, DomainEvent, Recommendation, Outcome, Command, and DecisionTrace contracts.
- Deterministic capacity and Engine priority baseline with first-class NO ACTION REQUIRED.
- Dexie V1 schema and reproducible package lockfile.
- Explicit START DAY and active-day recovery after reload/repository reads.
- Persisted REASSESS command lifecycle, validated state check-in, deterministic recommendation issue history.
- Persisted START_RESET and START_SHIFT_DOWN command lifecycles with duplicate-command rejection.
- Minimum deterministic RESET intensity guidance and SHIFT DOWN steps.
- Recommendation ACCEPT / DISMISS / OVERRIDE / NO ACTION history and outcomes.
- RESET completion and SHIFT DOWN completion outcomes.
- Recommendation-linked RESET preserves user-selected intensity instead of inventing a value.
- Minimal history route and deep WHY route showing inputs, derived state, rules, decision evidence, and outcomes.
- Zod validation at the implemented check-in/event persistence boundary.
- IndexedDB-backed persistence tests using fake-indexeddb.

## Validation
Node 24 GitHub Actions validation runs lint, Vitest, and production PWA build. The prior feature run passed lint, all tests, and build; final read-only npm-ci validation is required after this status commit.

## Tests added in this milestone
- RESET deterministic rule coverage.
- SHIFT DOWN deterministic rule coverage.
- REASSESS/check-in/recommendation persistence.
- active BeyondDay recovery.
- duplicate command rejection.
- RESET/SHIFT DOWN lifecycle history.
- recommendation dismiss/override/no-action outcomes.
- recommendation-linked RESET acceptance without hidden intensity defaults.
- Zod rejection of invalid check-ins.
- Dexie V1 schema opening/table contract.

## Partial / remaining V0.1 foundation work
- Full Zod schemas for every persisted/imported record, not only current boundaries.
- Application-owned JSON backup/export.
- Safe replace-restoration import with validation and recovery export.
- Explicit named migration module and previous-version fixtures when V2 exists; V1 currently opens without destructive upgrade logic.
- PWA icon assets and installed/offline E2E acceptance coverage.
- END DAY/debrief lifecycle and broader FIELD acceptance flow verification.
- TRAIN and BODY V0.1 implementation remain intentionally incomplete.

## Applied decisions
Canonical product doctrine and V0.1 Foundation Build Spec remain authority. No backend, accounts, AI, cloud sync, MONEY, analytics SDK, speculative state library, or visual redesign was added.

## Environment
The interactive runtime has Node 22 and no outbound npm registry DNS. The locked baseline requires Node 24 LTS, so executable validation runs through GitHub Actions on Node 24.

## Exact next step
Implement application-owned backup/export plus validated safe replace-restoration import and explicit migration/version scaffolding, then add offline E2E coverage for the complete FIELD loop.
