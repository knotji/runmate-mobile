import { useCallback, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonButton, IonContent, IonHeader, IonIcon, IonPage, IonSpinner, IonTitle, IonToggle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import { arrowBackOutline, barbellOutline, checkmarkCircleOutline, moonOutline, notificationsOutline, pulseOutline, refreshOutline } from 'ionicons/icons';
import { loadNotificationPreferences, saveNotificationPreferences, type NotificationPreferences } from '@/lib/notificationPreferences';
import { getNotificationDiagnostics, getNotificationPermission, refreshNotifications, requestExactReminderPermission, requestNotificationPermission, sendTestNotification, type NotificationDiagnostics } from '@/lib/notificationService';
import type { PermissionState } from '@capacitor/core';
import './NotificationsPage.css';
import './NotificationsPage.actions.css';

const rows: Array<{ key: keyof NotificationPreferences; icon: string; title: string; detail: string; timing: string }> = [
  { key: 'bedtime', icon: moonOutline, title: 'Bedtime Reminder', detail: 'Uses your Sleep Window and Default Wake Time.', timing: '1 hour before your in-bed target' },
  { key: 'missingSleep', icon: notificationsOutline, title: 'Missing Sleep Alert', detail: 'Checks after the morning Health Connect refresh.', timing: 'After 8:00 AM · once per day' },
  { key: 'plannedWorkout', icon: barbellOutline, title: 'Planned Workout', detail: 'Uses today’s Race Plan and Preferred Training Time.', timing: 'Only while the session is pending' },
  { key: 'recoveryChange', icon: pulseOutline, title: 'Recovery Change', detail: 'Alerts only after a meaningful score movement.', timing: '15+ points · once per day' },
];

const NotificationsPage: React.FC = () => {
  const history = useHistory();
  const [prefs, setPrefs] = useState(loadNotificationPreferences);
  const [permission, setPermission] = useState<PermissionState>('prompt');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [diagnostics, setDiagnostics] = useState<NotificationDiagnostics | null>(null);
  const load = useCallback(async () => {
    const [nextPermission, nextDiagnostics] = await Promise.all([getNotificationPermission(), getNotificationDiagnostics()]);
    setPermission(nextPermission); setDiagnostics(nextDiagnostics);
  }, []);
  useIonViewWillEnter(() => { void load(); });

  const enable = async () => {
    setBusy(true); setMessage(null);
    const next = await requestNotificationPermission();
    setPermission(next);
    if (next === 'granted') {
      const result = await refreshNotifications();
      setMessage(result.scheduled.length ? `Ready: ${result.scheduled.join(', ')}.` : 'Notifications are enabled. RunMate will schedule guidance when matching data is available.');
      await load();
    } else setMessage('Notification permission was not granted. You can enable it in Android App Settings.');
    setBusy(false);
  };
  const update = async (key: keyof NotificationPreferences, enabled: boolean) => {
    const next = { ...prefs, [key]: enabled };
    setPrefs(next); saveNotificationPreferences(next); setMessage(null);
    if (permission === 'granted') {
      setBusy(true); const result = await refreshNotifications(); setBusy(false);
      setMessage(result.scheduled.length ? `Updated: ${result.scheduled.join(', ')}.` : 'Preferences saved. No reminder currently needs scheduling.');
      await load();
    }
  };
  const testNotification = async () => {
    setBusy(true); setMessage(null);
    const sent = await sendTestNotification();
    setMessage(sent ? 'Test notification scheduled. It should appear in a moment.' : 'Allow notification access before sending a test.');
    setBusy(false);
  };
  const refreshSchedule = async () => {
    setBusy(true);
    try {
      const result = await refreshNotifications();
      setMessage(result.scheduled.length ? `Ready: ${result.scheduled.join(', ')}.` : 'No reminder currently needs scheduling.');
      await load();
    } finally { setBusy(false); }
  };
  const allowExactReminders = async () => {
    setBusy(true); setMessage(null);
    const exact = await requestExactReminderPermission();
    if (exact === 'granted') {
      const result = await refreshNotifications();
      setMessage(result.scheduled.includes('Bedtime') ? 'Bedtime Reminder is scheduled.' : 'Exact Reminders are allowed. Set a wake time to schedule Bedtime guidance.');
    } else setMessage('Exact Reminders are still disabled in Android settings.');
    await load(); setBusy(false);
  };

  return <IonPage>
    <IonHeader translucent className="notifications-header"><IonToolbar><IonButton slot="start" fill="clear" aria-label="Back To More" onClick={() => history.push('/tabs/more')}><IonIcon slot="icon-only" icon={arrowBackOutline} /></IonButton><IonTitle>Notifications</IonTitle></IonToolbar></IonHeader>
    <IonContent fullscreen className="notifications-content"><main className="notifications-shell">
      <header className="notifications-intro"><p>Personal Guidance</p><h1>Helpful, Not Noisy</h1><span>RunMate sends only timely reminders based on your sleep, profile, and training plan.</span></header>
      <section className={`notifications-permission ${permission === 'granted' ? 'allowed' : ''}`}><IonIcon icon={permission === 'granted' ? checkmarkCircleOutline : notificationsOutline} /><div><span>Notification Access</span><h2>{permission === 'granted' ? 'Allowed' : 'Permission Needed'}</h2><p>{permission === 'granted' ? 'Your preferences below are active on this device.' : 'Allow notifications before RunMate can deliver reminders.'}</p></div>{permission !== 'granted' && <IonButton disabled={busy} onClick={() => void enable()}>{busy ? <IonSpinner name="crescent" /> : 'Allow'}</IonButton>}</section>
      {permission === 'granted' && diagnostics?.exactAlarm !== 'granted' && <section className="notifications-exact-warning"><IonIcon icon={moonOutline} /><div><strong>Allow Exact Reminders</strong><p>Android may delay or remove your Bedtime Reminder until this setting is allowed.</p></div><button type="button" disabled={busy} onClick={() => void allowExactReminders()}>Open Settings</button></section>}
      <section className="notification-list" aria-label="Notification Preferences">{rows.map((row) => <article key={row.key}><IonIcon icon={row.icon} /><div><h2>{row.title}</h2><p>{row.detail}</p><span>{row.timing}</span></div><IonToggle aria-label={row.title} checked={prefs[row.key]} disabled={busy} onIonChange={(event) => void update(row.key, event.detail.checked)} /></article>)}</section>
      {message && <p className="notifications-message" role="status">{message}</p>}
      <details className="notification-diagnostics">
        <summary><div><span>Developer Details</span><strong>Notification Diagnostics</strong></div><small>{diagnostics?.pendingCount ?? 0} Scheduled</small></summary>
        <div className="notification-diagnostics-body">
          <p className="notification-diagnostics-meta">Checked {diagnostics ? formatDiagnosticTime(diagnostics.checkedAt) : 'Not Yet'} · Notifications {permission} · Exact {diagnostics?.exactAlarm ?? 'unknown'}</p>
          {diagnostics?.rows.map((row) => <article key={row.key}><span className={`diagnostic-state diagnostic-state-${row.state}`}>{row.state}</span><div><strong>{row.label}</strong><p>{row.scheduledAt ? `Next: ${formatDiagnosticTime(row.scheduledAt)}` : row.detail}</p>{row.scheduledAt && <small>{row.detail}</small>}</div></article>)}
          {permission === 'granted' && <div className="notification-diagnostics-actions">
            <button className="notifications-test" type="button" disabled={busy} onClick={() => void testNotification()}><IonIcon icon={notificationsOutline} />Send Test</button>
            <button className="notifications-refresh" type="button" disabled={busy} onClick={() => void refreshSchedule()}><IonIcon icon={refreshOutline} />{busy ? 'Refreshing…' : 'Refresh Schedule'}</button>
          </div>}
          <button type="button" disabled={busy} onClick={() => void load()}><IonIcon icon={refreshOutline} />Check Again</button>
        </div>
      </details>
      <p className="notifications-privacy">Preferences are device-specific. Health details stay in RunMate and are not included in notification text.</p>
    </main></IonContent>
  </IonPage>;
};

function formatDiagnosticTime(value: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}
export default NotificationsPage;
