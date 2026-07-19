import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { checkmarkOutline, copyOutline } from 'ionicons/icons';
import { Health } from '@capgo/capacitor-health';
import type { HealthDataType } from '@capgo/capacitor-health';
import './HealthTestPage.css';

type LogEntry = { label: string; result: unknown; error?: string; at: string };

const READ_TYPES: HealthDataType[] = ['steps', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'respiratoryRate', 'oxygenSaturation', 'workouts'];

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

const HealthTestPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [copiedEntry, setCopiedEntry] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

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
    { label: 'queryWorkouts (30d)', title: 'Query Workouts (30d)', action: () => Health.queryWorkouts({ startDate: daysAgo(30), limit: 20 }) },
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
          <IonTitle>Health Data Test</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="health-test-content">
        <main className="health-test-shell">
          <p className="health-test-note">
            Spike page only — reads raw samples from Health Connect (Android) / HealthKit (iOS) for inspection.
            Nothing here writes to Supabase or the app's Recovery data yet.
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
        </main>
      </IonContent>
    </IonPage>
  );
};

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
