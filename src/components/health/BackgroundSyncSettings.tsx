import React from 'react';
import { IonButton, IonIcon, IonSpinner } from '@ionic/react';
import { syncOutline } from 'ionicons/icons';
import { describeBackgroundHealthIssue, type BackgroundHealthStatus } from '@/lib/backgroundHealth';

type Props = {
  backgroundStatus: BackgroundHealthStatus | null;
  backgroundBusy: boolean;
  backgroundTesting: boolean;
  onToggle: () => void;
  onTest: () => void;
  formatLastSynced: (val: string | null) => string;
  formatNextExpected: (status: BackgroundHealthStatus) => string;
};

export const BackgroundSyncSettings: React.FC<Props> = ({
  backgroundStatus,
  backgroundBusy,
  backgroundTesting,
  onToggle,
  onTest,
  formatLastSynced,
  formatNextExpected,
}) => {
  if (!backgroundStatus) return null;

  return (
    <section className="health-background-card" aria-labelledby="background-health-heading">
      <header>
        <div><span>Automatic Preparation</span><h2 id="background-health-heading">Prepare Health Data In Background</h2></div>
        <strong className={backgroundStatus.enabled && backgroundStatus.authorized ? 'is-on' : ''}>
          {!backgroundStatus.available ? 'Unavailable' : backgroundStatus.enabled && backgroundStatus.authorized ? 'On' : 'Off'}
        </strong>
      </header>
      <p>Android prepares a small 36-hour Health Connect snapshot while RunMate is closed. Timing is approximate; account reconciliation still completes when RunMate opens.</p>
      <div className="health-background-schedule">
        <div><span>Last Prepared</span><b>{formatLastSynced(backgroundStatus.preparedAt)}</b></div>
        <div><span>Next Expected Run</span><b>{formatNextExpected(backgroundStatus)}</b></div>
      </div>
      <div className="health-background-counts" aria-label="Prepared Health Connect record counts">
        <BackgroundCount label="Sleep" value={backgroundStatus.recordCounts.sleep} />
        <BackgroundCount label="Workouts" value={backgroundStatus.recordCounts.workouts} />
        <BackgroundCount label="HR Samples" value={backgroundStatus.recordCounts.heartRate} />
      </div>
      {describeBackgroundHealthIssue(backgroundStatus) && <small role="status">{describeBackgroundHealthIssue(backgroundStatus)}</small>}
      {backgroundStatus.batteryOptimizationActive && backgroundStatus.enabled && !backgroundStatus.backgroundRestricted && (
        <small>Battery optimization is active. Android may run preparation later than the expected time.</small>
      )}
      <IonButton expand="block" fill={backgroundStatus.enabled ? 'outline' : 'solid'} disabled={backgroundBusy || !backgroundStatus.available} onClick={onToggle}>
        {backgroundBusy ? <IonSpinner name="crescent" /> : backgroundStatus.enabled ? 'Turn Off Background Preparation' : 'Enable Background Preparation'}
      </IonButton>
      {backgroundStatus.enabled && backgroundStatus.authorized && (
        <IonButton expand="block" fill="outline" disabled={backgroundBusy || backgroundTesting} onClick={onTest}>
          {backgroundTesting ? <IonSpinner name="crescent" /> : <><IonIcon slot="start" icon={syncOutline} />Run Background Test</>}
        </IonButton>
      )}
      <small>After a force-stop, Android will not restart background work until RunMate is opened again.</small>
    </section>
  );
};

function BackgroundCount({ label, value }: { label: string; value: number }) {
  return <div><strong>{value}</strong><span>{label}</span></div>;
}
