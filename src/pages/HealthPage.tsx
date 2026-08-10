import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
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
import './HealthPage.css';

type HealthDestination = {
  icon: string;
  title: string;
  summary: string;
  path: string;
  tone: 'teal' | 'blue' | 'amber';
};

const overview: HealthDestination[] = [
  { icon: calendarOutline, title: 'Health Calendar', summary: 'Sleep, training, meals, and check-ins by day.', path: '/health-calendar', tone: 'teal' },
  { icon: statsChartOutline, title: 'Recovery Trends', summary: 'See how Recovery, Sleep, and Strain are changing.', path: '/recovery-trends', tone: 'blue' },
  { icon: moonOutline, title: 'Sleep', summary: 'Review last night and the signals behind your score.', path: '/sleep', tone: 'blue' },
  { icon: pulseOutline, title: 'Strain', summary: 'Understand today’s load and heart-rate context.', path: '/strain', tone: 'amber' },
];

const bodyAndFuel: HealthDestination[] = [
  { icon: nutritionOutline, title: 'Nutrition', summary: 'Calories, protein, carbohydrates, and logged patterns.', path: '/nutrition-trends', tone: 'teal' },
  { icon: scaleOutline, title: 'Body Weight', summary: 'Health Connect weigh-ins and longer-term direction.', path: '/body-weight-trend', tone: 'blue' },
  { icon: fitnessOutline, title: 'Fitness Age', summary: 'A transparent estimate from your available signals.', path: '/fitness-age', tone: 'teal' },
  { icon: bandageOutline, title: 'Pain & Injury', summary: 'Review changes in your logged pain reports.', path: '/pain-trends', tone: 'amber' },
];

const HealthPage: React.FC = () => {
  const history = useHistory();

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

        <HealthGroup label="OVERVIEW" title="Your Body At A Glance" items={overview} onOpen={(path) => history.push(path)} />
        <HealthGroup label="BODY & FUEL" title="Longer-Term Signals" items={bodyAndFuel} onOpen={(path) => history.push(path)} />

        <button type="button" className="health-connect-entry" onClick={() => history.push('/health-connect')}>
          <span><i><IonIcon icon={heartOutline} /></i><b>Health Connect</b><small>Sync and review connected health data</small></span>
          <IonIcon icon={chevronForwardOutline} />
        </button>
      </main>
    </IonContent>
  </IonPage>;
};

function HealthGroup({ label, title, items, onOpen }: { label: string; title: string; items: HealthDestination[]; onOpen: (path: string) => void }) {
  return <section className="health-hub-group">
    <div className="health-hub-section-heading"><p>{label}</p><h2>{title}</h2></div>
    <div className="health-hub-grid">
      {items.map((item) => <button type="button" key={item.path} className={`health-hub-card is-${item.tone}`} onClick={() => onOpen(item.path)}>
        <span className="health-hub-card-icon"><IonIcon icon={item.icon} /></span>
        <span className="health-hub-card-copy"><b>{item.title}</b><small>{item.summary}</small></span>
        <IonIcon className="health-hub-card-chevron" icon={chevronForwardOutline} />
      </button>)}
    </div>
  </section>;
}

export default HealthPage;
