import { useState } from 'react';
import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import {
  addOutline,
  bandageOutline,
  calendarOutline,
  chevronForwardOutline,
  fitnessOutline,
  heartOutline,
  moonOutline,
  nutritionOutline,
  pulseOutline,
  scaleOutline,
  settingsOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buildHealthHubSnapshot, type HealthHubSnapshot, type HealthHubStatus } from '@/lib/healthHubSnapshot';
import './HealthPage.css';

type HealthDestination = {
  icon: string;
  title: string;
  summary: string;
  path: string;
  tone: 'teal' | 'blue' | 'amber';
  statusKey: keyof HealthHubSnapshot;
};

const overview: HealthDestination[] = [
  { icon: calendarOutline, title: 'Health Calendar', summary: 'Sleep, training, meals, and check-ins by day.', path: '/health-calendar', tone: 'teal', statusKey: 'calendar' },
  { icon: moonOutline, title: 'Sleep', summary: 'Review last night and the signals behind your score.', path: '/sleep', tone: 'blue', statusKey: 'sleep' },
  { icon: pulseOutline, title: 'Strain', summary: "Understand today's load and heart-rate context.", path: '/strain', tone: 'amber', statusKey: 'strain' },
];

const trends: HealthDestination[] = [
  { icon: statsChartOutline, title: 'Recovery Trends', summary: 'See how Recovery, Sleep, and Strain are changing.', path: '/recovery-trends', tone: 'blue', statusKey: 'recoveryTrends' },
  { icon: nutritionOutline, title: 'Nutrition', summary: 'Calories, protein, carbohydrates, and logged patterns.', path: '/nutrition-trends', tone: 'teal', statusKey: 'nutrition' },
];

const body: HealthDestination[] = [
  { icon: scaleOutline, title: 'Body Weight', summary: 'Health Connect weigh-ins and longer-term direction.', path: '/body-weight-trend', tone: 'blue', statusKey: 'weight' },
  { icon: fitnessOutline, title: 'Fitness Age', summary: 'A transparent estimate from your available signals.', path: '/fitness-age', tone: 'teal', statusKey: 'fitnessAge' },
  { icon: bandageOutline, title: 'Pain & Injury', summary: 'Review changes in your logged pain reports.', path: '/pain-trends', tone: 'amber', statusKey: 'pain' },
];

const HealthPage: React.FC = () => {
  const history = useHistory();
  const [snapshot, setSnapshot] = useState(() => buildHealthHubSnapshot());

  useIonViewWillEnter(() => setSnapshot(buildHealthHubSnapshot()));

  return <IonPage>
    <IonHeader translucent className="health-hub-header">
      <IonToolbar>
        <IonTitle>Health</IonTitle>
        <div slot="end" className="health-hub-actions">
          <button type="button" aria-label="Log Health Data" onClick={() => history.push('/tabs/upload')}><IonIcon icon={addOutline} /></button>
          <button type="button" aria-label="Open Settings And Data" onClick={() => history.push('/tabs/more')}><IonIcon icon={settingsOutline} /></button>
        </div>
      </IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="health-hub-content">
      <main className="health-hub-shell">
        <header className="health-hub-heading">
          <p>YOUR HEALTH</p>
          <h1>See What Is Shaping You</h1>
          <span>Start with the signals that matter today, then explore changes over time.</span>
        </header>

        <HealthGroup label="OVERVIEW" title="Your Body At A Glance" items={overview} snapshot={snapshot} onOpen={(path) => history.push(path)} />
        <HealthGroup label="TRENDS" title="See What Is Changing" items={trends} snapshot={snapshot} onOpen={(path) => history.push(path)} />
        <HealthGroup label="BODY" title="Longer-Term Signals" items={body} snapshot={snapshot} onOpen={(path) => history.push(path)} />

        <section className="health-hub-group" aria-labelledby="health-data-sources">
          <div className="health-hub-section-heading"><p>DATA SOURCES</p><h2 id="health-data-sources">Connected Health Data</h2></div>
          <button type="button" className="health-connect-entry" onClick={() => history.push('/health-connect')}>
            <span><i><IonIcon icon={heartOutline} /></i><b>Health Connect</b><small>Sync and review connected health data</small><HealthStatus status={snapshot.healthConnect} /></span>
            <IonIcon icon={chevronForwardOutline} />
          </button>
        </section>
      </main>
    </IonContent>
  </IonPage>;
};

function HealthGroup({ label, title, items, snapshot, onOpen }: { label: string; title: string; items: HealthDestination[]; snapshot: HealthHubSnapshot; onOpen: (path: string) => void }) {
  return <section className="health-hub-group">
    <div className="health-hub-section-heading"><p>{label}</p><h2>{title}</h2></div>
    <div className="health-hub-grid">
      {items.map((item) => <button type="button" key={item.path} className={`health-hub-card is-${item.tone}`} onClick={() => onOpen(item.path)}>
        <span className="health-hub-card-icon"><IonIcon icon={item.icon} /></span>
        <span className="health-hub-card-copy"><b>{item.title}</b><small>{item.summary}</small><HealthStatus status={snapshot[item.statusKey]} /></span>
        <IonIcon className="health-hub-card-chevron" icon={chevronForwardOutline} />
      </button>)}
    </div>
  </section>;
}

function HealthStatus({ status }: { status: HealthHubStatus }) {
  return <span className={`health-hub-status is-${status.tone}`}><i aria-hidden="true" />{status.label}</span>;
}

export default HealthPage;
