import React from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { barbellOutline, checkmarkCircleOutline, cloudOfflineOutline, heartOutline, moonOutline, scaleOutline, settingsOutline, syncOutline } from 'ionicons/icons';
import type { HealthSyncCounts } from '@/lib/healthSyncSummary';

export type ConnectionState = {
  available: boolean;
  sleepAuthorized: boolean;
  workoutsAuthorized: boolean;
  recoverySignalsAuthorized: boolean;
  weightAuthorized: boolean;
  lastSyncedAt: string | null;
};

export type SyncSummary = HealthSyncCounts & { reconciled: number; completedAt: string };

type Props = {
  connection: ConnectionState | null;
  connectionBusy: 'status' | 'connect' | 'sync' | 'repair' | 'settings' | null;
  connectionMessage: string | null;
  syncSummary: SyncSummary | null;
  onConnect: () => void;
  onSyncNow: () => void;
  onManagePermissions: () => void;
  onRepairWorkouts: () => void;
  formatLastSynced: (val: string | null) => string;
  formatSyncTime: (val: string) => string;
};

export const HealthSyncStatusCard: React.FC<Props> = ({
  connection,
  connectionBusy,
  connectionMessage,
  syncSummary,
  onConnect,
  onSyncNow,
  onManagePermissions,
  onRepairWorkouts,
  formatLastSynced,
  formatSyncTime,
}) => {
  return (
    <>
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
          <IonButton expand="block" disabled={connectionBusy !== null || connection?.available === false} onClick={onConnect}>
            {connectionBusy === 'connect' ? <IonSpinner name="crescent" /> : connection?.sleepAuthorized ? 'Update Access' : 'Connect'}
          </IonButton>
        )}
        <IonButton expand="block" disabled={connectionBusy !== null || !connection?.sleepAuthorized} onClick={onSyncNow}>
          {connectionBusy === 'sync' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Sync Now</>}
        </IonButton>
        <IonButton expand="block" fill="outline" disabled={connectionBusy !== null || connection?.available === false} onClick={onManagePermissions}>
          {connectionBusy === 'settings' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={settingsOutline} />Manage Permissions</>}
        </IonButton>
      </section>

      <details className="health-sync-tools">
        <summary>Sync Tools</summary>
        <div className="health-repair-action">
          <IonButton expand="block" fill="outline" disabled={connectionBusy !== null || !connection?.workoutsAuthorized} onClick={onRepairWorkouts}>
            {connectionBusy === 'repair' ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Repair Last 30 Days</>}
          </IonButton>
          <p>Re-read workout sessions and heart rate samples when older details are incomplete.</p>
        </div>
      </details>
    </>
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
