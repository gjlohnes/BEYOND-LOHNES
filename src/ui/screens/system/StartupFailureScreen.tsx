import type { DatabaseStartupState } from '../../../persistence/startup';

export function StartupFailureScreen({ state }: { state: Exclude<DatabaseStartupState, { status: 'READY' }> }) {
  return <main className="shell">
    <div className="eyebrow">BEYOND // DIAGNOSTIC</div>
    <h1>Local data unavailable</h1>
    <div className="card">
      <p>BEYOND could not open the local database safely.</p>
      <p className="muted">No automatic reset or deletion was attempted.</p>
      <dl><dt>Status</dt><dd>{state.status}</dd><dt>Error</dt><dd>{state.errorName}</dd></dl>
      <p>Close and reopen the app. If the problem persists, preserve browser data and use a known-good backup or recovery workflow before making destructive changes.</p>
    </div>
  </main>;
}
