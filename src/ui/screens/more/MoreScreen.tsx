import { useEffect, useState, type ChangeEvent } from 'react';
import {
  downloadBackup,
  downloadCurrentSafetyBackup,
  previewBackup,
  replaceRestore,
  type BackupPreview,
} from '../../../persistence/backup/backup';
import { getDiagnosticsSummary } from '../../../diagnostics/diagnostics';

function backupErrorMessage(error: unknown) {
  const code = error instanceof Error ? error.message : '';
  switch (code) {
    case 'INVALID_BACKUP_JSON':
      return 'That file is not valid JSON.';
    case 'INVALID_BACKUP_DOCUMENT':
      return 'That file is not a valid BEYOND backup.';
    case 'UNSUPPORTED_BACKUP_FORMAT_VERSION':
      return 'That backup format is not supported by this version of BEYOND.';
    case 'UNSUPPORTED_FUTURE_DATA_SCHEMA_VERSION':
      return 'That backup was created by a newer BEYOND data version.';
    case 'BACKUP_MIGRATION_NOT_AVAILABLE':
      return 'That backup is too old to restore with this version of BEYOND.';
    default:
      return 'The backup could not be processed safely.';
  }
}

export function MoreScreen() {
  const [status, setStatus] = useState('');
  const [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<typeof getDiagnosticsSummary>> | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [candidate, setCandidate] = useState<{ raw: string; preview: BackupPreview } | null>(null);

  async function refreshDiagnostics() {
    setDiagnostics(await getDiagnosticsSummary());
  }

  useEffect(() => {
    void getDiagnosticsSummary().then(setDiagnostics);
  }, []);

  async function backup() {
    try {
      await downloadBackup();
      setStatus('Backup exported.');
      await refreshDiagnostics();
    } catch {
      setStatus('Backup could not be exported. Your local data was not changed.');
    }
  }

  function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    setSelectedFile(file);
    setCandidate(null);
    setStatus(file ? `Selected ${file.name}. Validate it before restore.` : '');
  }

  async function validateSelectedBackup() {
    if (!selectedFile) return;
    try {
      const raw = await selectedFile.text();
      const preview = previewBackup(raw);
      setCandidate({ raw, preview });
      setStatus('Backup validated. Review counts before restore.');
    } catch (error) {
      setCandidate(null);
      setStatus(backupErrorMessage(error));
    }
  }

  async function restore() {
    if (!candidate) return;
    if (!window.confirm('Replace all current BEYOND data with this validated backup?')) return;
    try {
      await downloadCurrentSafetyBackup();
      await replaceRestore(candidate.raw, { confirmed: true, safetyExportSucceeded: true });
      setSelectedFile(null);
      setCandidate(null);
      setStatus('Restore completed. Current data was exported first.');
      await refreshDiagnostics();
    } catch (error) {
      setStatus(`Restore failed. ${backupErrorMessage(error)} Current data was not intentionally cleared.`);
    }
  }

  return (
    <section>
      <div className="eyebrow">MORE</div>
      <h1>Foundation</h1>
      <div className="card">
        <h2>Backup</h2>
        <button onClick={backup}>EXPORT BACKUP</button>
        <p className="muted">Application-owned JSON. Local history only.</p>
      </div>
      <div className="card">
        <h2>Restore</h2>
        <p className="muted">Replace-only restoration. BEYOND validates the file and shows a preview before any data can be replaced.</p>
        <input aria-label="Backup file" type="file" accept="application/json,.json" onChange={chooseImport} />
        {selectedFile && (
          <>
            <p><strong>Selected:</strong> {selectedFile.name}</p>
            {!candidate && <button onClick={validateSelectedBackup}>VALIDATE BACKUP</button>}
          </>
        )}
        {candidate && (
          <div role="status">
            <p><strong>Backup valid.</strong></p>
            <p>Days {candidate.preview.beyondDays} · Events {candidate.preview.events} · Recommendations {candidate.preview.recommendations} · Outcomes {candidate.preview.outcomes}</p>
            <p>Workout sessions {candidate.preview.workoutSessions} · Performed sets {candidate.preview.performedSets}</p>
            <button onClick={restore}>REPLACE RESTORE</button>
          </div>
        )}
        {status && <p role="status">{status}</p>}
      </div>
      <div className="card">
        <h2>Diagnostics</h2>
        {diagnostics ? (
          <dl>
            <dt>App</dt><dd>{diagnostics.appVersion}</dd>
            <dt>Engine</dt><dd>{diagnostics.engineVersion}</dd>
            <dt>Data schema</dt><dd>{diagnostics.dataSchemaVersion}</dd>
            <dt>Backup format</dt><dd>{diagnostics.backupFormatVersion}</dd>
            <dt>Dexie</dt><dd>{diagnostics.dexieDatabaseVersion}</dd>
            <dt>Active day</dt><dd>{diagnostics.activeBeyondDay ? 'YES' : 'NO'}</dd>
            <dt>Records</dt><dd>{JSON.stringify(diagnostics.counts)}</dd>
            <dt>Last backup</dt><dd>{String(diagnostics.lastBackupAt ?? 'NEVER')}</dd>
          </dl>
        ) : <p>Loading…</p>}
      </div>
    </section>
  );
}
