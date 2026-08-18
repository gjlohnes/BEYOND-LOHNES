# BEYOND

BEYOND is a phone-first, local-first, offline-first personal operating system. V0.1 is a client-only PWA with no backend or account requirement.

## V0.1

Primary navigation is TODAY / TRAIN / BODY / MORE. The deterministic Engine follows the product flow:

`INFORM → INTERPRET → RECOMMEND → USER DECIDES`

V0.1 includes explicit wake-to-sleep BeyondDay lifecycle, state check-ins and capacity, one primary deterministic recommendation including NO ACTION REQUIRED, RESET and SHIFT DOWN flows, MINIMUM DAY, TRAIN A/B/C strength sessions with reduced/recovery modes, BODY essentials, event/history explainability, Dexie/IndexedDB persistence, schema migration, application-owned backup/restore, and offline PWA operation.

## Development

Requires Node.js 24 and npm.

```bash
npm ci
npm run lint
npm run test
npm run build
npm run e2e
```

The repository uses React, TypeScript, Vite, Dexie, Zod, Vitest, and Playwright. GitHub Actions validates pull requests and `main`; deployment to GitHub Pages occurs from `main`.

## Product authority

The authoritative product decisions and specifications are maintained in the BEYOND Google Drive workspace. Repository implementation notes are recorded in `docs/IMPLEMENTATION_STATUS.md`.

## Data and privacy

V0.1 stores application data locally in IndexedDB and provides application-owned JSON export/import. It does not require cloud sync, an account, analytics telemetry, or an AI provider.

## License

No open-source license is granted by this repository at V0.1. A future licensing decision should be deliberate and documented with a LICENSE file before reuse rights are granted.
