import { useState } from 'react';
import { IonBackButton, IonButton, IonButtons, IonContent, IonHeader, IonPage, IonSpinner, IonTitle, IonToolbar } from '@ionic/react';
import { Health } from '@capgo/capacitor-health';
import type { HealthDataType } from '@capgo/capacitor-health';
import './HealthTestPage.css';

type LogEntry = { label: string; result: unknown; error?: string; at: string };

const READ_TYPES: HealthDataType[] = ['steps', 'sleep', 'heartRate', 'restingHeartRate', 'heartRateVariability', 'respiratoryRate', 'oxygenSaturation', 'workouts'];

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

const HealthTestPage: React.FC = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

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

            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: steps (7d)', () => Health.readSamples({ dataType: 'steps', startDate: daysAgo(7), limit: 200 }))}>
              {busy === 'read: steps (7d)' ? <IonSpinner name="crescent" /> : 'Read Steps (7d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: sleep (7d)', () => Health.readSamples({ dataType: 'sleep', startDate: daysAgo(7), limit: 50 }))}>
              {busy === 'read: sleep (7d)' ? <IonSpinner name="crescent" /> : 'Read Sleep (7d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: heartRate (1d)', () => Health.readSamples({ dataType: 'heartRate', startDate: daysAgo(1), limit: 200 }))}>
              {busy === 'read: heartRate (1d)' ? <IonSpinner name="crescent" /> : 'Read Heart Rate (1d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: heartRateVariability (7d)', () => Health.readSamples({ dataType: 'heartRateVariability', startDate: daysAgo(7), limit: 50 }))}>
              {busy === 'read: heartRateVariability (7d)' ? <IonSpinner name="crescent" /> : 'Read HRV (7d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: restingHeartRate (7d)', () => Health.readSamples({ dataType: 'restingHeartRate', startDate: daysAgo(7), limit: 50 }))}>
              {busy === 'read: restingHeartRate (7d)' ? <IonSpinner name="crescent" /> : 'Read Resting HR (7d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('read: oxygenSaturation (7d)', () => Health.readSamples({ dataType: 'oxygenSaturation', startDate: daysAgo(7), limit: 50 }))}>
              {busy === 'read: oxygenSaturation (7d)' ? <IonSpinner name="crescent" /> : 'Read SpO2 (7d)'}
            </IonButton>
            <IonButton expand="block" fill="outline" disabled={busy !== null} onClick={() => void run('queryWorkouts (30d)', () => Health.queryWorkouts({ startDate: daysAgo(30), limit: 20 }))}>
              {busy === 'queryWorkouts (30d)' ? <IonSpinner name="crescent" /> : 'Query Workouts (30d)'}
            </IonButton>
          </section>

          <section className="health-test-log">
            {logs.length === 0 && <p className="health-test-empty">Results will appear here.</p>}
            {logs.map((entry, index) => (
              <article className="health-test-entry" key={`${entry.label}-${entry.at}-${index}`}>
                <header><strong>{entry.label}</strong><span>{entry.at}</span></header>
                {entry.error ? <p className="health-test-error">{entry.error}</p> : <pre>{JSON.stringify(entry.result, null, 2)}</pre>}
              </article>
            ))}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
};

export default HealthTestPage;
