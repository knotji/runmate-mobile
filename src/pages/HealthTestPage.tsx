import { useCallback, useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { barbellOutline, checkmarkCircleOutline, checkmarkOutline, cloudOfflineOutline, copyOutline, heartOutline, moonOutline, scaleOutline, settingsOutline, syncOutline } from 'ionicons/icons';
import { Health } from '@capgo/capacitor-health';
import type { HealthDataType, HealthSample, Workout } from '@capgo/capacitor-health';
import { getSamsungSleepLastSyncedAt, syncSamsungSleep } from '@/lib/samsungSleepSync';
import { getSamsungWorkoutLastSyncedAt, queryAllHealthConnectWorkouts, syncSamsungWorkouts } from '@/lib/samsungWorkoutSync';
import { syncSamsungWeight } from '@/lib/samsungProfileSync';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import type { HealthSyncCounts } from '@/lib/healthSyncSummary';
import type { LocalHistoryItem } from '@/lib/localHistory';
import './HealthTestPage.css';

type LogEntry = { label: string; result: unknown; error?: string; at: string };

const READ_TYPES: HealthDataType[] = ['steps', 'distance', 'calories', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'respiratoryRate', 'oxygenSaturation', 'vo2Max', 'weight', 'workouts'];
const PRODUCT_READ_TYPES: HealthDataType[] = ['sleep', 'heartRateVariability', 'restingHeartRate', 'respiratoryRate', 'workouts', 'heartRate', 'distance', 'calories', 'vo2Max', 'weight'];

type ConnectionState = {
  available: boolean;
  sleepAuthorized: boolean;
  workoutsAuthorized: boolean;
  recoverySignalsAuthorized: boolean;
  weightAuthorized: boolean;
  lastSyncedAt: string | null;
};

type SyncSummary = HealthSyncCounts & { reconciled: number; completedAt: string };

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * Midnight in Bangkok (UTC+7, no DST) N days ago, as a UTC ISO instant.
 * queryAggregated's 'day' buckets are 24h windows starting exactly at the given
 * startDate — they are NOT snapped to local midnight. Using daysAgo() (now - N days)
 * offsets every bucket by the current time-of-day, mixing two calendar days per
 * bucket and producing totals that don't match what Samsung Health / RunMate's
 * Bangkok-dateKey model consider "one day".
 */
function bangkokMidnightDaysAgo(days: number): string {
  const bangkokNow = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const bangkokMidnightAsUtcFields = Date.UTC(bangkokNow.getUTCFullYear(), bangkokNow.getUTCMonth(), bangkokNow.getUTCDate() - days);
  return new Date(bangkokMidnightAsUtcFields - 7 * 60 * 60 * 1000).toISOString();
}

type DerivedWorkout = Workout & {
  derived: {
    avgHR: number | null;
    maxHR: number | null;
    minHR: number | null;
    hrSampleCount: number;
    distanceM: number | null;
    caloriesKcal: number | null;
  };
};

/** True when a sample's start falls within [workoutStart, workoutEnd] (inclusive). */
function sampleWithinWorkout(sampleStartIso: string, workoutStartIso: string, workoutEndIso: string): boolean {
  const sampleMs = Date.parse(sampleStartIso);
  return sampleMs >= Date.parse(workoutStartIso) && sampleMs <= Date.parse(workoutEndIso);
}

function deriveWorkoutMetrics(workout: Workout, heartRate: HealthSample[], distance: HealthSample[], calories: HealthSample[]): DerivedWorkout {
  const hrValues = heartRate.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).map((sample) => sample.value);
  const distanceTotal = distance.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).reduce((sum, sample) => sum + sample.value, 0);
  const caloriesTotal = calories.filter((sample) => sampleWithinWorkout(sample.startDate, workout.startDate, workout.endDate)).reduce((sum, sample) => sum + sample.value, 0);

  return {
    ...workout,
    derived: {
      avgHR: hrValues.length ? Math.round(hrValues.reduce((sum, value) => sum + value, 0) / hrValues.length) : null,
      maxHR: hrValues.length ? Math.max(...hrValues) : null,
      minHR: hrValues.length ? Math.min(...hrValues) : null,
      hrSampleCount: hrValues.length,
      distanceM: distanceTotal || null,
      caloriesKcal: caloriesTotal || null,
    },
  };
}

/**
 * One-shot snapshot combining everything the mapping-into-history_items work will need,
 * so the app doesn't need a rebuild per data type while iterating on the integration design:
 * - 7d Bangkok-aligned steps totals, sleep, restingHR/HRV/SpO2 baselines
 * - Today's workouts, each enriched with maxHR/avgHR/minHR (derived from heartRate samples
 *   overlapping the workout's time range, since queryWorkouts() doesn't return HR itself)
 *   and distance/calories summed the same way.
 */
async function buildIntegrationSnapshot() {
  const weekAgo = bangkokMidnightDaysAgo(7);
  const todayStart = bangkokMidnightDaysAgo(0);
  const now = new Date().toISOString();

  const [stepsAggregated, sleep, restingHeartRate, heartRateVariability, oxygenSaturation, workoutsToday, heartRateToday, distanceToday, caloriesToday] = await Promise.all([
    Health.queryAggregated({ dataType: 'steps', startDate: weekAgo, bucket: 'day', aggregation: 'sum' }),
    Health.readSamples({ dataType: 'sleep', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'restingHeartRate', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'heartRateVariability', startDate: weekAgo, limit: 50 }),
    Health.readSamples({ dataType: 'oxygenSaturation', startDate: weekAgo, limit: 50 }),
    Health.queryWorkouts({ startDate: todayStart, ascending: false, limit: 20 }),
    Health.readSamples({ dataType: 'heartRate', startDate: todayStart, endDate: now, limit: 1000 }),
    Health.readSamples({ dataType: 'distance', startDate: todayStart, endDate: now, limit: 500 }),
    Health.readSamples({ dataType: 'calories', startDate: todayStart, endDate: now, limit: 500 }),
  ]);

  const workoutsWithDerivedMetrics: DerivedWorkout[] = workoutsToday.workouts.map((workout) =>
    deriveWorkoutMetrics(workout, heartRateToday.samples, distanceToday.samples, caloriesToday.samples),
  );

  // sleep7d's per-minute `stages` arrays were already verified in an earlier round and are
  // large enough to blow past the clipboard/paste size this gets copied into, crowding out
  // workoutsToday (the thing this snapshot exists to check). Keep only night-level summary
  // fields here; drop stage-by-stage detail from this particular output.
  const sleep7dSummary = sleep.samples.map((sample) => ({
    startDate: sample.startDate,
    endDate: sample.endDate,
    value: sample.value,
    unit: sample.unit,
    sourceId: sample.sourceId,
    sourceName: sample.sourceName,
    hasStageData: sample.hasStageData,
  }));

  return {
    // workoutsToday first: if this payload gets truncated when copy-pasted, the part we're
    // actually iterating on survives instead of getting cut off by the bulkier 7d sections.
    workoutsToday: workoutsWithDerivedMetrics,
    stepsAggregated7d: stepsAggregated.samples,
    restingHeartRate7d: restingHeartRate.samples,
    heartRateVariability7d: heartRateVariability.samples,
    oxygenSaturation7d: oxygenSaturation.samples,
    sleep7dSummary,
  };
}

const HealthTestPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedEntry, setCopiedEntry] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [connectionBusy, setConnectionBusy] = useState<'status' | 'connect' | 'sync' | 'repair' | 'settings' | null>('status');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);

  const refreshConnection = useCallback(async () => {
    try {
      const availability = await Health.isAvailable();
      if (!availability.available) {
        setConnection({ available: false, sleepAuthorized: false, workoutsAuthorized: false, recoverySignalsAuthorized: false, weightAuthorized: false, lastSyncedAt: latestSyncTime(getSamsungSleepLastSyncedAt(), getSamsungWorkoutLastSyncedAt()) });
        return;
      }
      const authorization = await Health.checkAuthorization({ read: PRODUCT_READ_TYPES });
      setConnection({
        available: true,
        sleepAuthorized: authorization.readAuthorized.includes('sleep'),
        workoutsAuthorized: ['workouts', 'heartRate', 'distance', 'calories', 'vo2Max'].every((type) => authorization.readAuthorized.includes(type as HealthDataType)),
        recoverySignalsAuthorized: ['heartRateVariability', 'restingHeartRate', 'respiratoryRate'].every((type) => authorization.readAuthorized.includes(type as HealthDataType)),
        weightAuthorized: authorization.readAuthorized.includes('weight'),
        lastSyncedAt: latestSyncTime(getSamsungSleepLastSyncedAt(), getSamsungWorkoutLastSyncedAt()),
      });
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Could Not Check Health Connect.');
      setConnection({ available: false, sleepAuthorized: false, workoutsAuthorized: false, recoverySignalsAuthorized: false, weightAuthorized: false, lastSyncedAt: latestSyncTime(getSamsungSleepLastSyncedAt(), getSamsungWorkoutLastSyncedAt()) });
    } finally {
      setConnectionBusy(null);
    }
  }, []);

  useIonViewWillEnter(() => { void refreshConnection(); });

  const connect = async () => {
    setConnectionBusy('connect');
    setConnectionMessage(null);
    try {
      const authorization = await Health.requestAuthorization({ read: PRODUCT_READ_TYPES, requestHistoryAccess: true });
      if (authorization.readAuthorized.includes('sleep')) {
        const [sleep, workouts, weight] = await Promise.all([syncSamsungSleep(), syncSamsungWorkouts(), syncSamsungWeight()]);
        await showSyncResult(sleep, workouts, setSyncSummary);
        if (sleep.error || workouts.error || weight.error) setConnectionMessage(sleep.error ?? workouts.error ?? weight.error ?? 'Could Not Sync Health Connect.');
      } else {
        setConnectionMessage('Sleep permission was not granted. You can change it in Health Connect settings.');
      }
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Could Not Connect Health Connect.');
    }
    await refreshConnection();
  };

  const syncNow = async () => {
    setConnectionBusy('sync');
    setConnectionMessage(null);
    const [sleep, workouts, weight] = await Promise.all([syncSamsungSleep(), syncSamsungWorkouts(), syncSamsungWeight()]);
    await showSyncResult(sleep, workouts, setSyncSummary);
    if (sleep.status === 'permission_required' || workouts.status === 'permission_required') setConnectionMessage('Update Health Connect access before syncing.');
    else if (sleep.error || workouts.error || weight.error) setConnectionMessage(sleep.error ?? workouts.error ?? weight.error ?? 'Could Not Sync Health Connect.');
    else if (weight.status === 'manual_override') setConnectionMessage(`Health Connect found ${weight.weightKg} kg. Your manually entered Body Weight was kept.`);
    await refreshConnection();
  };

  const repairWorkouts = async () => {
    setConnectionBusy('repair');
    setConnectionMessage(null);
    const workouts = await syncSamsungWorkouts(30);
    await showSyncResult({ added: 0, updated: 0, unchanged: 0, failed: 0 }, workouts, setSyncSummary);
    if (workouts.status === 'permission_required') {
      setConnectionMessage('Allow Workout and Heart Rate access before repairing your history.');
    } else if (workouts.error) {
      setConnectionMessage(workouts.error);
    } else {
      setConnectionMessage(`Workout repair complete. Checked ${workouts.imported} records from the last 30 days.`);
    }
    await refreshConnection();
  };

  const managePermissions = async () => {
    setConnectionBusy('settings');
    setConnectionMessage(null);
    try {
      await Health.openHealthConnectSettings();
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Could Not Open Health Connect Settings.');
    } finally {
      setConnectionBusy(null);
    }
  };

  const run = async (label: string, action: () => Promise<unknown>) => {
    setBusy(label);
    try {
      const result = await action();
      setLogs((current) => [{ label, result, at: new Date().toLocaleTimeString() }, ...current]);
    } catch (error) {
      setLogs((current) => [{ label, result: null, error: error instanceof Error ? error.message : String(error), at: new Date().toLocaleTimeString() }, ...current]);
    } finally {
      setBusy(null);
    }
  };

  const readChecks: Array<{ label: string; title: string; action: () => Promise<unknown> }> = [
    { label: 'aggregated: steps (7d, daily, Bangkok-aligned)', title: 'Read Steps Aggregated (7d, Bangkok-aligned)', action: () => Health.queryAggregated({ dataType: 'steps', startDate: bangkokMidnightDaysAgo(7), bucket: 'day', aggregation: 'sum' }) },
    { label: 'read: sleep (7d)', title: 'Read Sleep (7d)', action: () => Health.readSamples({ dataType: 'sleep', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: heartRate (1d)', title: 'Read Heart Rate (1d)', action: () => Health.readSamples({ dataType: 'heartRate', startDate: daysAgo(1), limit: 200 }) },
    { label: 'read: heartRateVariability (7d)', title: 'Read HRV (7d)', action: () => Health.readSamples({ dataType: 'heartRateVariability', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: restingHeartRate (7d)', title: 'Read Resting HR (7d)', action: () => Health.readSamples({ dataType: 'restingHeartRate', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: oxygenSaturation (7d)', title: 'Read SpO2 (7d)', action: () => Health.readSamples({ dataType: 'oxygenSaturation', startDate: daysAgo(7), limit: 50 }) },
    { label: 'queryWorkouts (30d, all pages)', title: 'Query Workouts (30d, All Pages)', action: async () => ({ workouts: await queryAllHealthConnectWorkouts({ startDate: daysAgo(30), ascending: false }) }) },
    { label: 'queryWorkouts (today, Bangkok-aligned)', title: 'Query Workouts (Today Only)', action: () => Health.queryWorkouts({ startDate: bangkokMidnightDaysAgo(0), ascending: false, limit: 20 }) },
    {
      label: 'workout window: distance/calories/heartRate (today)',
      title: "Read Distance/Calories/HR For Today's Workouts",
      action: async () => {
        const startDate = bangkokMidnightDaysAgo(0);
        const endDate = new Date().toISOString();
        const [distance, calories, heartRate] = await Promise.all([
          Health.readSamples({ dataType: 'distance', startDate, endDate, limit: 200 }),
          Health.readSamples({ dataType: 'calories', startDate, endDate, limit: 200 }),
          Health.readSamples({ dataType: 'heartRate', startDate, endDate, limit: 500 }),
        ]);
        return { distance, calories, heartRate };
      },
    },
    {
      label: 'integration snapshot (7d steps/sleep/HR-baseline, today workouts+HR/maxHR/distance/calories)',
      title: 'Full Integration Snapshot (One Shot)',
      action: () => buildIntegrationSnapshot(),
    },
  ];

  const runAll = async () => {
    for (const check of readChecks) await run(check.label, check.action);
  };

  const copyResult = async (entry: LogEntry, entryKey: string) => {
    const text = entry.error ?? JSON.stringify(entry.result, null, 2);
    try {
      await copyToClipboard(text);
      setCopyError(null);
      setCopiedEntry(entryKey);
      window.setTimeout(() => setCopiedEntry((current) => current === entryKey ? null : current), 1800);
    } catch {
      setCopiedEntry(null);
      setCopyError('Could Not Copy This Result. Please Try Again.');
    }
  };

  const copyAllResults = async () => {
    const combined = logs.map((entry) => `## ${entry.label} (${entry.at})\n${entry.error ?? JSON.stringify(entry.result, null, 2)}`).join('\n\n');
    try {
      await copyToClipboard(combined);
      setCopyError(null);
      setCopiedEntry('__all__');
      window.setTimeout(() => setCopiedEntry((current) => current === '__all__' ? null : current), 1800);
    } catch {
      setCopiedEntry(null);
      setCopyError('Could Not Copy All Results. Please Try Again.');
    }
  };

  return (
    <IonPage>
      <IonHeader translucent>
        <IonToolbar>
          <IonButtons slot="start"><IonBackButton defaultHref="/tabs/more" /></IonButtons>
          <IonTitle>Health Connect</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="health-test-content">
        <main className="health-test-shell">
          <header className="health-connect-heading">
            <p>Connected Health</p>
            <h1>Samsung Health Sync</h1>
            <span>Bring trusted Sleep, Workout, and Body Weight data into RunMate through Health Connect.</span>
          </header>

          <section className={`health-connect-status ${connection?.sleepAuthorized ? 'is-connected' : ''}`}>
            <div className="health-connect-status-icon">
              {connectionBusy === 'status' ? <IonSpinner name="crescent" /> : <IonIcon icon={connection?.sleepAuthorized ? checkmarkCircleOutline : cloudOfflineOutline} />}
            </div>
            <div>
              <span>Connection Status</span>
              <h2>{connectionBusy === 'status' ? 'Checking Health Connect…' : connection?.sleepAuthorized ? 'Connected' : connection?.available ? 'Ready To Connect' : 'Unavailable'}</h2>
              <p>{connection?.sleepAuthorized ? 'Samsung Health Sleep and Workouts can sync securely to RunMate.' : connection?.available ? 'Connect to start importing Samsung Health data.' : 'Health Connect is available on supported Android devices.'}</p>
            </div>
          </section>

          <section className="health-connect-section" aria-labelledby="health-access-heading">
            <div className="health-connect-section-heading"><p>Data Access</p><h2 id="health-access-heading">Permissions</h2></div>
            <div className="health-permission-list">
              <PermissionRow icon={moonOutline} title="Sleep" detail="Duration, schedule, and Sleep Stages" authorized={connection?.sleepAuthorized === true} note="Automatic Sync" />
              <PermissionRow icon={heartOutline} title="Recovery Signals" detail="HRV, Resting HR, and Respiratory Rate" authorized={connection?.recoverySignalsAuthorized === true} note="Matched To Your Sleep Window" />
              <PermissionRow icon={barbellOutline} title="Workout" detail="Sessions, Pace, Heart Rate, and VO2 Max" authorized={connection?.workoutsAuthorized === true} note="Automatic Sync" />
              <PermissionRow icon={scaleOutline} title="Body Weight" detail="Latest Samsung Health measurement" authorized={connection?.weightAuthorized === true} note="Profile Sync" />
            </div>
          </section>

          <section className="health-connect-sync-card">
            <div><span>Last Synced</span><strong>{formatLastSynced(connection?.lastSyncedAt ?? null)}</strong></div>
            <p>Recovery and Activity check today automatically. Sync Now checks the last 30 days.</p>
          </section>

          {connectionMessage && <p className="health-connect-message" role="status">{connectionMessage}</p>}

          {syncSummary && (
            <section className="health-sync-summary" aria-labelledby="health-sync-summary-heading" role="status">
              <header>
                <div><span>Latest Sync</span><h2 id="health-sync-summary-heading">Your Health Data Is Up To Date</h2></div>
                <small>{formatSyncTime(syncSummary.completedAt)}</small>
              </header>
              <div className="health-sync-summary-grid">
                <SyncMetric label="Added" value={syncSummary.added} tone="added" />
                <SyncMetric label="Updated" value={syncSummary.updated} tone="updated" />
                <SyncMetric label="Reconciled" value={syncSummary.reconciled} tone="reconciled" />
                <SyncMetric label="Unchanged" value={syncSummary.unchanged} />
                <SyncMetric label="Failed" value={syncSummary.failed} tone={syncSummary.failed ? 'failed' : undefined} />
              </div>
              <p>Reconciled records combine Samsung Health measurements with details from an existing upload.</p>
            </section>
          )}

          <section className="health-connect-primary-actions">
            {(!connection?.sleepAuthorized || !connection?.recoverySignalsAuthorized || !connection?.workoutsAuthorized || !connection?.weightAuthorized) && (
              <IonButton expand="block" disabled={connectionBusy !== null || connection?.available === false} onClick={() => void connect()}>
                {connectionBusy === 'connect' ? <IonSpinner name="crescent" /> : connection?.sleepAuthorized ? 'Update Access' : 'Connect'}
              </IonButton>
            )}
            <IonButton expand="block" disabled={connectionBusy !== null || !connection?.sleepAuthorized} onClick={() => void syncNow()}>
              {connectionBusy === 'sync' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Sync Now</>}
            </IonButton>
            <div className="health-repair-action">
              <IonButton expand="block" fill="outline" disabled={connectionBusy !== null || !connection?.workoutsAuthorized} onClick={() => void repairWorkouts()}>
                {connectionBusy === 'repair' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Repair Last 30 Days</>}
              </IonButton>
              <p>Re-read Workout sessions and Heart Rate samples when older details are incomplete.</p>
            </div>
            <IonButton expand="block" fill="outline" disabled={connectionBusy !== null || connection?.available === false} onClick={() => void managePermissions()}>
              {connectionBusy === 'settings' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={settingsOutline} />Manage Permissions</>}
            </IonButton>
          </section>

          <details className="health-developer-details">
            <summary>Developer Details</summary>
            <div className="health-developer-body">
          <p className="health-test-note">
            Raw Health Connect inspection tools. These results are for diagnostics and are not shown in the normal RunMate experience.
          </p>

          <section className="health-test-actions">
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('isAvailable', () => Health.isAvailable())}>
              {busy === 'isAvailable' ? <IonSpinner name="crescent" /> : 'Check Availability'}
            </IonButton>
            <IonButton expand="block" disabled={busy !== null} onClick={() => void run('requestAuthorization', () => Health.requestAuthorization({ read: READ_TYPES, requestHistoryAccess: true }))}>
              {busy === 'requestAuthorization' ? <IonSpinner name="crescent" /> : 'Request Authorization'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('checkAuthorization', () => Health.checkAuthorization({ read: READ_TYPES }))}>
              {busy === 'checkAuthorization' ? <IonSpinner name="crescent" /> : 'Check Authorization'}
            </IonButton>

            <div className="health-test-divider" />

            <IonButton expand="block" color="success" disabled={busy !== null} onClick={() => void runAll()}>
              {busy !== null && readChecks.some((check) => check.label === busy) ? <IonSpinner name="crescent" /> : 'Run All Checks'}
            </IonButton>

            <div className="health-test-divider" />

            {readChecks.map((check) => (
              <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run(check.label, check.action)} key={check.label}>
                {busy === check.label ? <IonSpinner name="crescent" /> : check.title}
              </IonButton>
            ))}
          </section>

          <section className="health-test-log">
            {logs.length === 0 && <p className="health-test-empty">Results will appear here.</p>}
            {logs.length > 0 && (
              <button type="button" className={copiedEntry === '__all__' ? 'health-copy-button copied' : 'health-copy-button'} onClick={() => void copyAllResults()}>
                <IonIcon icon={copiedEntry === '__all__' ? checkmarkOutline : copyOutline} />{copiedEntry === '__all__' ? 'Copied All' : 'Copy All Results'}
              </button>
            )}
            {copyError && <p className="health-test-copy-error" role="alert">{copyError}</p>}
            {logs.map((entry, index) => {
              const entryKey = `${entry.label}-${entry.at}-${index}`;
              const copied = copiedEntry === entryKey;
              return (
              <article className="health-test-entry" key={entryKey}>
                <header>
                  <div><strong>{entry.label}</strong><span>{entry.at}</span></div>
                  <button type="button" className={copied ? 'health-copy-button copied' : 'health-copy-button'} onClick={() => void copyResult(entry, entryKey)} aria-label={`Copy ${entry.label} Result`}>
                    <IonIcon icon={copied ? checkmarkOutline : copyOutline} />{copied ? 'Copied' : 'Copy'}
                  </button>
                </header>
                {entry.error ? <p className="health-test-error">{entry.error}</p> : <pre>{JSON.stringify(entry.result, null, 2)}</pre>}
              </article>
              );
            })}
          </section>
            </div>
          </details>
        </main>
      </IonContent>
    </IonPage>
  );
};

function PermissionRow({ icon, title, detail, authorized, note }: { icon: string; title: string; detail: string; authorized: boolean; note: string }) {
  return (
    <div className="health-permission-row">
      <div className="health-permission-icon"><IonIcon icon={icon} /></div>
      <div><strong>{title}</strong><span>{detail}</span><small>{note}</small></div>
      <span className={authorized ? 'health-permission-badge granted' : 'health-permission-badge'}>{authorized ? 'Allowed' : 'Not Allowed'}</span>
    </div>
  );
}

function SyncMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return <div className={`health-sync-metric${tone ? ` health-sync-metric-${tone}` : ''}`}><strong>{value}</strong><span>{label}</span></div>;
}

async function showSyncResult(
  sleep: HealthSyncCounts & { error?: string },
  workouts: HealthSyncCounts & { error?: string },
  setSummary: (summary: SyncSummary) => void,
): Promise<void> {
  const history = await loadHistoryItems(['sleep', 'workout', 'strength']);
  const reconciled = history.ok ? countReconciled(history.items) : 0;
  setSummary({
    added: sleep.added + workouts.added,
    updated: sleep.updated + workouts.updated,
    unchanged: sleep.unchanged + workouts.unchanged,
    failed: sleep.failed + workouts.failed,
    reconciled,
    completedAt: new Date().toISOString(),
  });
}

function countReconciled(items: LocalHistoryItem[]): number {
  const sleep = dedupeSleepItems(items.filter((item) => item.type === 'sleep'));
  const workouts = dedupeWorkoutItems(items.filter((item) => item.type === 'workout' || item.type === 'strength'));
  return [...sleep, ...workouts].filter((item) => {
    const sources = item.reconciledSources ?? [];
    return (sources.includes('Samsung Health') || sources.includes('Strava')) && (sources.includes('Manual Upload') || sources.includes('Upload'));
  }).length;
}

function formatSyncTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function formatLastSynced(value: string | null): string {
  if (!value) return 'Not Yet Synced';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not Yet Synced';
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Bangkok',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function latestSyncTime(...values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

async function copyToClipboard(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  textarea.remove();
  if (!copied) throw new Error('Clipboard unavailable');
}

export default HealthTestPage;
