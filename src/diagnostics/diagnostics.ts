import { APP_VERSION, BACKUP_FORMAT_VERSION, DATA_SCHEMA_VERSION, DEXIE_DB_VERSION } from '../app/versions';
import { ENGINE_VERSION } from '../engine/evaluate';
import { db } from '../persistence/db';

export async function getDiagnosticsSummary(){const[activeDay,meta,beyondDays,events,recommendations,outcomes,workoutSessions,performedSets]=await Promise.all([db.beyondDays.where('status').equals('ACTIVE').first(),db.meta.toArray(),db.beyondDays.count(),db.events.count(),db.recommendations.count(),db.outcomes.count(),db.workoutSessions.count(),db.performedSets.count()]);return{appVersion:APP_VERSION,engineVersion:ENGINE_VERSION,backupFormatVersion:BACKUP_FORMAT_VERSION,dataSchemaVersion:DATA_SCHEMA_VERSION,dexieDatabaseVersion:DEXIE_DB_VERSION,activeBeyondDay:Boolean(activeDay),counts:{beyondDays,events,recommendations,outcomes,workoutSessions,performedSets},lastBackupAt:meta.find((record)=>record.key==='lastBackupAt')?.value??null};}
