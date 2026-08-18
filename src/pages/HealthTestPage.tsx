import { useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { arrowBackOutline, syncOutline } from 'ionicons/icons';
import { Health } from '@capgo/capacitor-health';
import type { HealthDataType } from '@capgo/capacitor-health';
import { getSamsungSleepLastSyncedAt } from '@/lib/samsungSleepSync';
import { getSamsungWorkoutLastSyncedAt, queryAllHealthConnectWorkouts } from '@/lib/samsungWorkoutSync';
import { repairWorkoutHistory, syncHealthHistory } from '@/lib/healthSyncService';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import type { HealthSyncCounts } from '@/lib/healthSyncSummary';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { getHealthSyncPerformanceComparison, getPerformanceDiagnosticSummaries, type HealthSyncPerformanceComparison, type PerformanceDiagnosticSummary } from '@/lib/performanceDiagnostics';
import {
  READ_TYPES,
  PRODUCT_READ_TYPES,
  daysAgo,
  bangkokMidnightDaysAgo,
  buildIntegrationSnapshot,
  buildVitalsDiagnostic,
} from '@/lib/healthDiagnosticsQueries';
import { copyToClipboard } from '@/lib/clipboard';
import { readLatestRunningRoute } from '@/lib/exerciseRoute';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import {
  getBackgroundHealthStatus,
  describeBackgroundHealthIssue,
  requestBackgroundHealthAccess,
  runBackgroundHealthNow,
  runBackgroundHealthTest,
  setBackgroundHealthEnabled,
  type BackgroundHealthStatus,
} from '@/lib/backgroundHealth';
import { HealthSyncStatusCard, type ConnectionState, type SyncSummary } from '@/components/health/HealthSyncStatusCard';
import { BackgroundSyncSettings } from '@/components/health/BackgroundSyncSettings';
import { NutritionSyncSettings } from '@/components/health/NutritionSyncSettings';
import { HealthSyncPerformanceCard } from '@/components/health/HealthSyncPerformanceCard';
import { HealthDiagnosticsPanel, type LogEntry } from '@/components/health/HealthDiagnosticsPanel';
import { navigateBackOr } from '@/lib/navigationBack';
import './HealthTestPage.css';

const HealthTestPage: React.FC = () => {
  const history = useHistory();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedEntry, setCopiedEntry] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);
  const [connection, setConnection] = useState<ConnectionState | null>(null);
  const [connectionBusy, setConnectionBusy] = useState<'status' | 'connect' | 'sync' | 'repair' | 'settings' | null>('status');
  const [connectionMessage, setConnectionMessage] = useState<string | null>(null);
  const [syncSummary, setSyncSummary] = useState<SyncSummary | null>(null);
  const [backgroundStatus, setBackgroundStatus] = useState<BackgroundHealthStatus | null>(null);
  const [backgroundBusy, setBackgroundBusy] = useState(false);
  const [backgroundTesting, setBackgroundTesting] = useState(false);
  const [performanceSummaries, setPerformanceSummaries] = useState<PerformanceDiagnosticSummary[]>(() => getPerformanceDiagnosticSummaries());
  const [healthSyncComparison, setHealthSyncComparison] = useState<HealthSyncPerformanceComparison[]>(() => getHealthSyncPerformanceComparison());

  const refreshConnection = useCallback(async () => {
    try {
      const background = await getBackgroundHealthStatus();
      setBackgroundStatus(background);
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

  const toggleBackgroundSync = async () => {
    setBackgroundBusy(true);
    setConnectionMessage(null);
    try {
      if (backgroundStatus?.enabled) {
        setBackgroundStatus(await setBackgroundHealthEnabled(false));
        setConnectionMessage('Automatic Background Preparation is off. Foreground Sync remains available.');
      } else {
        let status = backgroundStatus;
        if (!status?.authorized) status = await requestBackgroundHealthAccess();
        if (!status.authorized) {
          setBackgroundStatus(status);
          setConnectionMessage('Background Health access was not granted. You can enable it later.');
          return;
        }
        status = await setBackgroundHealthEnabled(true);
        setBackgroundStatus(status);
        await runBackgroundHealthNow();
        setConnectionMessage('Automatic Background Preparation is on. Android will prepare new Health Connect data when conditions allow.');
      }
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Could Not Update Background Health Sync.');
    } finally {
      setBackgroundBusy(false);
    }
  };

  const testBackgroundPreparation = async () => {
    if (!backgroundStatus?.enabled || !backgroundStatus.authorized) return;
    setBackgroundTesting(true);
    setConnectionMessage('Running a real Background Health read. Keep this page open for the result.');
    try {
      const result = await runBackgroundHealthTest();
      setBackgroundStatus(result.status);
      if (result.outcome === 'success') {
        const count = result.status.recordCounts.sleep + result.status.recordCounts.workouts;
        setConnectionMessage(`Background test passed in ${formatDiagnosticDuration(result.durationMs)}. Prepared ${count} Sleep and Workout records.`);
      } else if (result.outcome === 'failed') {
        setConnectionMessage(describeBackgroundHealthIssue(result.status) ?? 'Background test could not prepare Health Connect data.');
      } else {
        setConnectionMessage('The test was queued, but Android did not finish it within 45 seconds. Battery restrictions may be delaying background work.');
      }
    } catch (error) {
      setConnectionMessage(error instanceof Error ? error.message : 'Could Not Run Background Health Test.');
    } finally {
      setBackgroundTesting(false);
    }
  };

  useIonViewWillEnter(() => {
    setPerformanceSummaries(getPerformanceDiagnosticSummaries());
    setHealthSyncComparison(getHealthSyncPerformanceComparison());
    void refreshConnection();
  });

  const connect = async () => {
    setConnectionBusy('connect');
    setConnectionMessage(null);
    try {
      const authorization = await Health.requestAuthorization({ read: PRODUCT_READ_TYPES, requestHistoryAccess: true });
      if (authorization.readAuthorized.includes('sleep')) {
        const { sleep, workout: workouts, weight } = await syncHealthHistory();
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
    const { sleep, workout: workouts, weight } = await syncHealthHistory();
    await showSyncResult(sleep, workouts, setSyncSummary);
    if (sleep.status === 'permission_required' || workouts.status === 'permission_required') setConnectionMessage('Update Health Connect access before syncing.');
    else if (sleep.error || workouts.error || weight.error) setConnectionMessage(sleep.error ?? workouts.error ?? weight.error ?? 'Could Not Sync Health Connect.');
    else if (weight.status === 'manual_override') setConnectionMessage(`Health Connect found ${weight.weightKg} kg. Your manually entered Body Weight was kept.`);
    await refreshConnection();
  };

  const repairWorkouts = async () => {
    setConnectionBusy('repair');
    setConnectionMessage(null);
    const workouts = await repairWorkoutHistory();
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
    { label: 'isAvailable', title: 'Check Availability', action: () => Health.isAvailable() },
    { label: 'requestAuthorization', title: 'Request Authorization', action: () => Health.requestAuthorization({ read: READ_TYPES, requestHistoryAccess: true }) },
    { label: 'checkAuthorization', title: 'Check Authorization', action: () => Health.checkAuthorization({ read: READ_TYPES }) },
    { label: 'queryVitals (latest sleep HR + 7d recovery signals)', title: 'Query Vitals', action: () => buildVitalsDiagnostic() },
    { label: 'aggregated: steps (7d, daily, Bangkok-aligned)', title: 'Read Steps Aggregated (7d, Bangkok-aligned)', action: () => Health.queryAggregated({ dataType: 'steps', startDate: bangkokMidnightDaysAgo(7), bucket: 'day', aggregation: 'sum' }) },
    { label: 'read: sleep (7d)', title: 'Read Sleep (7d)', action: () => Health.readSamples({ dataType: 'sleep', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: heartRate (1d)', title: 'Read Heart Rate (1d)', action: () => Health.readSamples({ dataType: 'heartRate', startDate: daysAgo(1), limit: 200 }) },
    { label: 'read: heartRateVariability (7d)', title: 'Read HRV (7d)', action: () => Health.readSamples({ dataType: 'heartRateVariability', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: restingHeartRate (7d)', title: 'Read Resting HR (7d)', action: () => Health.readSamples({ dataType: 'restingHeartRate', startDate: daysAgo(7), limit: 50 }) },
    { label: 'read: oxygenSaturation (7d)', title: 'Read SpO2 (7d)', action: () => Health.readSamples({ dataType: 'oxygenSaturation', startDate: daysAgo(7), limit: 50 }) },
    { label: 'queryWorkouts (30d, all pages)', title: 'Query Workouts (30d, All Pages)', action: async () => ({ workouts: await queryAllHealthConnectWorkouts({ startDate: daysAgo(30), ascending: false }) }) },
    { label: 'queryWorkouts (today, Bangkok-aligned)', title: 'Query Workouts (Today Only)', action: () => Health.queryWorkouts({ startDate: bangkokMidnightDaysAgo(0), ascending: false, limit: 20 }) },
    { label: 'exerciseRoute (latest run, 30d)', title: 'Read Route For Latest Run (30d)', action: () => readLatestRunningRoute() },
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

  const copyPerformanceDiagnostics = async () => {
    try {
      await copyToClipboard(JSON.stringify(performanceSummaries, null, 2));
      setCopyError(null);
      setCopiedEntry('__performance__');
      window.setTimeout(() => setCopiedEntry((current) => current === '__performance__' ? null : current), 1800);
    } catch {
      setCopiedEntry(null);
      setCopyError('Could Not Copy Performance Diagnostics. Please Try Again.');
    }
  };

  return (
    <IonPage>
      <IonHeader translucent className="health-connect-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Back" onClick={() => navigateBackOr(history, '/tabs/you')}>
            <IonIcon slot="icon-only" icon={arrowBackOutline} />
          </IonButton>
          <IonTitle>Health Connect</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="health-test-content">
        <main className="health-test-shell">
          <header className="health-connect-heading">
            <p>Connected Health</p>
            <h1>Samsung Health Sync</h1>
            <span>Bring trusted Sleep, Workout, and Body Weight data into WholeMate through Health Connect.</span>
          </header>

          {connectionBusy === 'status' && !connection ? <PageDataSkeleton variant="health" label="Checking Health Connect" /> : <>
            <HealthSyncStatusCard
              connection={connection}
              connectionBusy={connectionBusy}
              connectionMessage={connectionMessage}
              syncSummary={syncSummary}
              onConnect={() => void connect()}
              onSyncNow={() => void syncNow()}
              onManagePermissions={() => void managePermissions()}
              formatLastSynced={formatLastSynced}
              formatSyncTime={formatSyncTime}
            />

            <BackgroundSyncSettings
              backgroundStatus={backgroundStatus}
              backgroundBusy={backgroundBusy}
              backgroundTesting={backgroundTesting}
              onToggle={() => void toggleBackgroundSync()}
              onTest={() => void testBackgroundPreparation()}
              formatLastSynced={formatLastSynced}
              formatNextExpected={formatNextExpected}
            />

            <NutritionSyncSettings />

            <p className="health-connect-source-note">
              WholeMate imports records shared by Samsung Health through Health Connect. A workout visible in Samsung Health may not appear here if Samsung Health has not shared that record.
            </p>

            <details className="health-developer-details">
              <summary>Developer Details</summary>
              <div className="health-developer-body">
                <details className="health-sync-tools">
                  <summary>Sync Tools</summary>
                  <div className="health-repair-action">
                    <IonButton expand="block" fill="outline" disabled={connectionBusy !== null || !connection?.workoutsAuthorized} onClick={() => void repairWorkouts()}>
                      {connectionBusy === 'repair' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Repair Last 30 Days</>}
                    </IonButton>
                    <p>Re-read workout sessions and heart rate samples when older details are incomplete.</p>
                  </div>
                </details>

                <HealthSyncPerformanceCard
                  performanceSummaries={performanceSummaries}
                  healthSyncComparison={healthSyncComparison}
                  copiedEntry={copiedEntry}
                  onCopyPerformanceDiagnostics={() => void copyPerformanceDiagnostics()}
                  formatDiagnosticDuration={formatDiagnosticDuration}
                />

                <HealthDiagnosticsPanel
                  busy={busy}
                  logs={logs}
                  readChecks={readChecks}
                  copiedEntry={copiedEntry}
                  copyError={copyError}
                  onRun={(label, action) => void run(label, action)}
                  onRunAll={() => void runAll()}
                  onCopyResult={(entry, key) => void copyResult(entry, key)}
                  onCopyAllResults={() => void copyAllResults()}
                />
              </div>
            </details>
          </>}
        </main>
      </IonContent>
    </IonPage>
  );
};

function formatDiagnosticDuration(milliseconds: number): string {
  return milliseconds < 1000 ? `${milliseconds} ms` : `${(milliseconds / 1000).toFixed(milliseconds < 10_000 ? 1 : 0)} s`;
}

async function showSyncResult(
  sleep: HealthSyncCounts & { error?: string },
  workouts: HealthSyncCounts & { error?: string; vo2MaxAuthorized?: boolean; vo2MaxSamplesRead?: number; workoutsWithVo2Max?: number },
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
    vo2MaxAuthorized: workouts.vo2MaxAuthorized,
    vo2MaxSamplesRead: workouts.vo2MaxSamplesRead,
    workoutsWithVo2Max: workouts.workoutsWithVo2Max,
    completedAt: new Date().toISOString(),
  });
}

function countReconciled(items: LocalHistoryItem[]): number {
  const sleep = dedupeSleepItems(items.filter((item) => item.type === 'sleep'));
  const workouts = dedupeWorkoutItems(items.filter((item) => item.type === 'workout' || item.type === 'strength'));
  return [...sleep, ...workouts].filter((item) => {
    const sources = item.reconciledSources ?? [];
    return sources.includes('Samsung Health') && (sources.includes('Manual Upload') || sources.includes('Upload'));
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

function formatNextExpected(status: BackgroundHealthStatus): string {
  if (!status.enabled) return 'Turned Off';
  if (!status.authorized) return 'Permission Needed';
  if (!status.nextExpectedAt) return status.workerState === 'ENQUEUED' ? 'Android Scheduled' : 'Waiting For Android';
  return formatLastSynced(status.nextExpectedAt);
}

function latestSyncTime(...values: Array<string | null>): string | null {
  return values.filter((value): value is string => Boolean(value)).sort((a, b) => Date.parse(b) - Date.parse(a))[0] ?? null;
}

export default HealthTestPage;
