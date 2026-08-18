# BEYOND V0.2 Implementation Status

## Release baseline
V0.1 is merged to `main` at `a0bebc90f74f591cb4a0630eb9093ee73e447c32` and remains the stable architectural baseline.

V0.2 work is isolated on branch `agent/v0.2-trust-feel-001` in draft PR #2. It is **not merged** and requires Android real-device acceptance plus explicit user approval before merge.

## TRUST & FEEL 001 objective
The first V0.2 vertical slice addresses evidence from real use rather than adding a new product module:
- safely correct a mistaken BODY hydration entry without silently mutating historical truth;
- make meaningful TODAY/BODY actions visibly respond while work is pending and after success/failure;
- begin the sharper tactical visual refinement using reusable BEYOND-owned interaction and style primitives;
- preserve deterministic Engine authority, offline behavior, backup safety, and the released V0.1 architecture.

## Correction contract
Hydration correction is append-only domain history:
- `WATER_LOGGED` remains the immutable original fact.
- `CORRECT_WATER_LOG` emits `WATER_LOG_CORRECTED` with the original/root event identity, the currently effective event being superseded, and the replacement amount.
- Effective hydration is derived deterministically by following the correction chain rather than by deleting or rewriting prior events.
- Repeated corrections form one linear chain.
- Competing corrections against the same current fact cannot fork history: the stale attempt is rejected with `STALE_CORRECTION_TARGET`.
- A correction that supplies the already-effective amount is rejected with `NO_CORRECTION_CHANGE`; it earns no event storage.
- BODY totals and MINIMUM DAY HYDRATE derive from the same effective-water truth.
- HISTORY exposes correction events as legible correction evidence.

## Data/version contract
- Application version: `0.2.0`.
- Application data schema: **v3** because a new persisted domain event/command semantic now exists.
- Dexie database version: **V2 remains current**. No table, index, or storage-layout change exists; Dexie V3 would be artificial.
- Backup format: **BEYOND_BACKUP v1 remains current**.
- Existing data-schema-v2 backups migrate in memory to v3 without inventing correction events.
- Startup updates the application schema metadata from 2 to 3 while leaving Dexie V2 intact.
- Backup validation rejects orphaned, forked, gapped, or otherwise ambiguous water-correction chains before restore.
- Replace restore remains validation-first, explicit-confirmation, pre-restore-safety-export, transactional replacement.

## Interaction certainty
A small BEYOND-owned `ActionButton` primitive now provides reusable:
- pressed/touch feedback;
- pending/working state and visible working label;
- `aria-busy` state;
- disabled state and duplicate-submit protection;
- primary / secondary / quiet / danger hierarchy;
- keyboard focus visibility.

TODAY applies the pattern to START DAY, START WORK DAY, REASSESS, recommendation decisions/overrides, SHIFT ENDED, SHIFT DOWN, and END DAY. BODY applies it to hydration, correction, protein, sleep, and recovery actions. Both surfaces use explicit live-region success/error feedback so an action does not silently disappear after a tap.

## Focused visual foundation
TODAY and BODY now establish the V0.2 visual direction without a wholesale redesign:
- near-black layered canvas and sharper panel surfaces;
- restrained BEYOND red as primary identity/action color;
- stronger tactical eyebrow/card-kicker hierarchy;
- clearer primary/secondary/quiet action distinction;
- compact BODY metric grid;
- stronger focus, pressed, disabled, success, error, and warning states;
- narrow-phone and safe-area behavior preserved;
- reduced-motion support preserved.

The Legacy Prototype Design & Product Reference remains inspiration only. TODAY / TRAIN / BODY / MORE and the released architecture remain unchanged.

## Open-source reuse outcome
Trust & Feel 001 added **zero new runtime dependencies** and made no package-lock dependency change.

The approved candidates were tested against an actual implementation need before installation:
- Sonner: eligible, not adopted yet. Local live-region feedback currently solves the problem with less dependency cost.
- Lucide React: eligible, not adopted yet. Text-first correction/action affordances remain clearer in this slice.
- Radix Primitives: selectively eligible, not adopted yet. Inline progressive disclosure avoids a modal/focus-layer dependency for hydration correction.
- Recharts: still deferred until a concrete History & Insight question earns charting infrastructure.

This is an evidence-driven application of the dependency gate, not a reversal of the reuse audit.

## Automated coverage added/updated
Domain/persistence coverage now proves:
- original hydration facts remain stored after correction;
- effective totals use replacement truth;
- repeated corrections remain deterministic;
- concurrent stale correction attempts cannot branch history;
- no-op corrections do not earn event storage;
- MINIMUM DAY hydration follows effective corrected truth;
- invalid corrections fail safely;
- application schema metadata upgrades from 2→3 without Dexie V3;
- v2 backup migration to v3 preserves existing V0.1 data without inventing corrections;
- corrected history exports and replace-restores to the same effective truth;
- malformed correction relationships are rejected before restore.

Playwright coverage includes the complete user correction workflow: log a mistaken hydration value, correct it, see the effective total update, reload, verify legible correction history, then cold-reload offline with the corrected truth intact. Existing V0.1 FIELD, BODY, TRAIN, MINIMUM DAY, recommendation, work-transition, backup/restore, and narrow-mobile tests remain in the suite.

## Validation
Code-bearing head `811c5c243598a6b7ad8e79ffe65da580599d5176` passed the complete Node 24 GitHub Actions suite:
- `npm ci`: PASS — 486 packages audited, 0 vulnerabilities reported.
- ESLint: PASS.
- Vitest: **19 files / 70 tests PASS**.
- TypeScript strict project build: PASS.
- Vite production PWA build: PASS.
- Production app bundle: 482.24 kB JS / 144.04 kB gzip; 6.84 kB CSS / 2.31 kB gzip.
- PWA `generateSW`: PASS — 7 application-shell entries precached.
- Playwright: **17/17 PASS**.

The GitHub Actions runtime continues to emit the pre-existing non-blocking warning for action implementations targeting an older Node runtime while the project itself executes on Node 24. No action-major upgrade was introduced without a separate compatibility review.

## Scope deliberately not added
Trust & Feel 001 does not add Mission Queue, MONEY, AI/LLM, accounts/backend, cloud sync, calendar, wearables, broad HOME/LIFE systems, Recharts/trend dashboards, or unrelated feature expansion.

Correction is intentionally implemented for hydration first. Protein, sleep, workout-set, and other correction workflows remain candidates only after this first contract passes real-device use and proves the interaction model.

## Documentation decisions
The Decision Register now records the V0.2 correction/supersession doctrine. The Research & Reuse Register records the zero-dependency implementation evidence and preserves Sonner/Lucide/Radix as eligible rather than mandatory. The Implementation Roadmap now identifies V0.1 as the merged baseline and Trust & Feel 001 as the active V0.2 slice.

## Current gate
Automated validation is green. The remaining gate is real-device Android acceptance of the V0.2 candidate, including existing V0.1 data survival, correction interaction, offline reconstruction, and correction-aware backup/restore.

**Do not merge PR #2 before that acceptance passes and the user explicitly approves the merge.**

## Android acceptance target
Deploy the candidate branch through the existing manual GitHub Pages workflow, verify the installed PWA upgrades with V0.1 local data intact, exercise a deliberate 160 oz → 16 oz hydration correction, confirm history and effective totals, cold-open offline, then export/validate/replace-restore a v0.2 backup and confirm the correction survives reconstruction. If the candidate is not merged after testing, redeploy `main` to return Pages to the V0.1 baseline.
