import { useEffect, useState, type ChangeEvent } from 'react';
import { downloadBackup, downloadCurrentSafetyBackup, previewBackup, replaceRestore, type BackupPreview } from '../../../persistence/backup/backup';
import { getDiagnosticsSummary } from '../../../diagnostics/diagnostics';

export function MoreScreen() {
  const [status, setStatus] = useState('');
  const [diagnostics, setDiagnostics] = useState<Awaited<ReturnType<typeof getDiagnosticsSummary>> | null>(null);
  const [candidate, setCandidate] = useState<{ raw: string; preview: BackupPreview } | null>(null);

  async function refreshDiagnostics() { setDiagnostics(await getDiagnosticsSummary()); }
  useEffect(() => { void getDiagnosticsSummary().then(setDiagnostics); }, []);

  async function backup() {
    try { await downloadBackup(); setStatus('Backup exported.'); await refreshDiagnostics(); }
    catch (error) { setStatus(error instanceof Error ? error.message : 'Backup failed.'); }
  }

  async function chooseImport(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const raw = await file.text();
      setCandidate({ raw, preview: previewBackup(raw) });
      setStatus('Backup validated. Review counts before restore.');
    } catch (error) { setCandidate(null); setStatus(error instanceof Error ? error.message : 'Backup rejected.'); }
  }

  async function restore() {
    if (!candidate) return;
    if (!window.confirm('Replace all current BEYOND data with this validated backup?')) return;
    try {
      await downloadCurrentSafetyBackup();
      await replaceRestore(candidate.raw, { confirmed: true, safetyExportSucceeded: true });
      setCandidate(null);
      setStatus('Restore completed. Current data was exported first.');
      await refreshDiagnostics();
    } catch (error) { setStatus(error instanceof Error ? error.message : 'Restore failed; current data was not intentionally cleared.'); }
  }

  return <section>
    <div className="eyebrow">MORE</div><h1>Foundation</h1>
    <div className="card"><h2>Backup</h2><button onClick={backup}>EXPORT BACKUP</button><p className="muted">Application-owned JSON. Local history only.</p></div>
    <div className="card"><h2>Restore</h2><input type="file" accept="application/json,.json" onChange={chooseImport}/>{candidate && <><p>Days {candidate.preview.beyondDays} · Events {candidate.preview.events} · Recommendations {candidate.preview.recommendations} · Outcomes {candidate.preview.outcomes}</p><button onClick={restore}>REPLACE RESTORE</button></>}</div>
    <div className="card"><h2>Diagnostics</h2>{diagnostics ? <dl><dt>App</dt><dd>{diagnostics.appVersion}</dd><dt>Engine</dt><dd>{diagnostics.engineVersion}</dd><dt>Data schema</dt><dd>{diagnostics.dataSchemaVersion}</dd><dt>Backup format</dt><dd>{diagnostics.backupFormatVersion}</dd><dt>Dexie</dt><dd>{diagnostics.dexieDatabaseVersion}</dd><dt>Active day</dt><dd>{diagnostics.activeBeyondDay ? 'YES' : 'NO'}</dd><dt>Records</dt><dd>{JSON.stringify(diagnostics.counts)}</dd><dt>Last backup</dt><dd>{String(diagnostics.lastBackupAt ?? 'NEVER')}</dd></dl> : <p>Loading…</p>}</div>
    <p className="muted">{status}</p>
  </section>;
}
