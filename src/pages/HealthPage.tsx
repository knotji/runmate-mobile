import { useState } from 'react';
import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar, useIonViewWillEnter } from '@ionic/react';
import {
  addOutline,
  bandageOutline,
  calendarOutline,
  chevronForwardOutline,
  heartOutline,
  fitnessOutline,
  moonOutline,
  nutritionOutline,
  pulseOutline,
  settingsOutline,
  scaleOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buildHealthHubSnapshot, type HealthHubSnapshot, type HealthHubStatus } from '@/lib/healthHubSnapshot';
import { loadFreshHealthDashboardData, selectVisibleHealthSignals, type HealthDashboardData, type HealthDataSourceRow } from '@/lib/healthDashboardData';
import { loadHealthDashboardStartupSnapshot, saveHealthDashboardStartupSnapshot } from '@/lib/healthDashboardStartupCache';
import { usePrimaryTabScroll } from '@/lib/usePrimaryTabScroll';
import './HealthPage.css';

const SOURCE_STATE_LABEL: Record<HealthDataSourceRow['state'], string> = {
  ok: 'Synced',
  stale: 'Stale',
  missing: 'Missing',
};

type HealthDestination = {
  icon: string;
  title: string;
  summary: string;
  path: string;
  tone: 'teal' | 'blue' | 'amber';
  statusKey: keyof HealthHubSnapshot;
};

// Was two separate lists (OVERVIEW, then TRENDS) with their own headings —
// merged into one so the page reads as a single compact list of 8
// destinations instead of two visually repeated sections. Same 8
// destinations, same order (overview items first, trend items after),
// nothing dropped.
const explore: HealthDestination[] = [
  { icon: calendarOutline, title: 'Health Calendar', summary: 'Sleep, training, meals, and check-ins by day.', path: '/health-calendar', tone: 'teal', statusKey: 'calendar' },
  { icon: moonOutline, title: 'Sleep', summary: 'Review last night and the signals behind your score.', path: '/sleep', tone: 'blue', statusKey: 'sleep' },
  { icon: pulseOutline, title: 'Strain', summary: "Understand today's load and heart-rate context.", path: '/strain', tone: 'amber', statusKey: 'strain' },
  { icon: statsChartOutline, title: 'Recovery Trends', summary: 'See how Recovery, Sleep, and Strain are changing.', path: '/recovery-trends', tone: 'blue', statusKey: 'recoveryTrends' },
  { icon: nutritionOutline, title: 'Nutrition', summary: 'Calories, protein, carbohydrates, and logged patterns.', path: '/nutrition-trends', tone: 'teal', statusKey: 'nutrition' },
  { icon: scaleOutline, title: 'Body Weight', summary: 'Review weigh-ins and body-weight changes over time.', path: '/body-weight-trend', tone: 'blue', statusKey: 'weight' },
  { icon: fitnessOutline, title: 'Fitness Age', summary: 'See the long-term estimate shaped by your available signals.', path: '/fitness-age', tone: 'teal', statusKey: 'fitnessAge' },
  { icon: bandageOutline, title: 'Pain & Injury', summary: 'Review changes in your logged pain reports.', path: '/pain-trends', tone: 'amber', statusKey: 'pain' },
];

const HealthPage: React.FC = () => {
  const history = useHistory();
  const contentRef = usePrimaryTabScroll('health');
  const [snapshot, setSnapshot] = useState(() => buildHealthHubSnapshot());
  const [dashboard, setDashboard] = useState<HealthDashboardData | null>(() => loadHealthDashboardStartupSnapshot());

  useIonViewWillEnter(() => {
    setSnapshot(buildHealthHubSnapshot());
    // Instant-paint from cache above, then a background refresh — same
    // pattern as RecoveryPage (Today) and ActivityPage (Move). Silent: this
    // section only ever gains data or updates it, never shows its own
    // loading spinner over already-visible content.
    void loadFreshHealthDashboardData().then((result) => {
      if (result.status !== 'ready') return;
      setDashboard(result.data);
      saveHealthDashboardStartupSnapshot(result.data);
    });
  });

  return <IonPage>
    <IonHeader translucent className="health-hub-header">
      <IonToolbar>
        <IonTitle>Health</IonTitle>
        <div slot="end" className="health-hub-actions">
          <button type="button" aria-label="Log Health Data" onClick={() => history.push('/tabs/log')}><IonIcon icon={addOutline} /></button>
          <button type="button" aria-label="Open You" onClick={() => history.push('/tabs/you')}><IonIcon icon={settingsOutline} /></button>
        </div>
      </IonToolbar>
    </IonHeader>
    <IonContent ref={contentRef} fullscreen className="health-hub-content">
      <main className="health-hub-shell">
        <header className="health-hub-heading">
          <p>YOUR HEALTH</p>
          <h1>See What Is Shaping You</h1>
          <span>Start with the signals that matter today, then explore changes over time.</span>
        </header>

        {dashboard && <HealthSignalsSection dashboard={dashboard} />}

        <HealthGroup label="EXPLORE" title="More About Your Health" items={explore} snapshot={snapshot} onOpen={(path) => history.push(path, { from: '/tabs/health' })} />

        <section className="health-hub-group" aria-labelledby="health-data-sources">
          <div className="health-hub-section-heading"><p>DATA SOURCES</p><h2 id="health-data-sources">Connected Health Data</h2></div>
          <button type="button" className="health-connect-entry" onClick={() => history.push('/health-connect', { from: '/tabs/health' })}>
            <span><i><IonIcon icon={heartOutline} /></i><b>Health Connect</b><small>Sync and review connected health data</small><HealthStatus status={snapshot.healthConnect} /></span>
            <IonIcon icon={chevronForwardOutline} />
          </button>
        </section>
      </main>
    </IonContent>
  </IonPage>;
};

// "This Week's Signals" — one tracked trend (Recovery) plus a handful of
// stat tiles, framed as a family of signals rather than the page's identity.
// Same design language validated in src/labs/wholemate-next/HealthNextPage.tsx.
function HealthSignalsSection({ dashboard }: { dashboard: HealthDashboardData }) {
  const visibleTiles = selectVisibleHealthSignals(dashboard.tiles);
  return <section className="health-signals-section" aria-label="This week's signals">
    <p className="health-signals-label">THIS WEEK&apos;S SIGNALS</p>

    <div className="health-card health-trend-card">
      <span className="health-card-eyebrow">Recovery</span>
      <p className="health-trend-value">{dashboard.anchorValue}<small>/100 today</small></p>
      <div className="health-trend-bars" role="img" aria-label="Recovery over the last 7 days">
        {dashboard.trend.map((day, index) => <div key={`${day.label}-${index}`} className="health-trend-bar-col">
          <div className="health-trend-bar-track"><div className={`health-trend-bar-fill is-${day.status}`} style={{ height: `${day.value}%` }} /></div>
          <span className="health-trend-bar-label">{day.label}</span>
        </div>)}
      </div>
    </div>

    {visibleTiles.length > 0 ? (
      <div className={`health-stat-grid count-${visibleTiles.length}`}>
        {visibleTiles.map((tile) => {
          const positive = tile.deltaDirection === 'flat' ? true : tile.deltaDirection === tile.goodDirection;
          return <div key={tile.key} className="health-card health-stat-tile">
            <span className="health-card-eyebrow health-stat-eyebrow">{tile.eyebrow}</span>
            <p className="health-stat-value">{tile.value}{tile.unit && <small>{tile.unit}</small>}</p>
            <span className={`health-stat-delta${positive ? ' is-positive' : ''}`}>
              {tile.deltaDirection !== 'flat' && <i className={`health-stat-delta-arrow is-${tile.deltaDirection}`} aria-hidden="true" />}
              {tile.deltaLabel}
            </span>
          </div>;
        })}
      </div>
    ) : (
      <p className="health-signals-empty">No current signals to summarize yet — check back after your next sync.</p>
    )}

    <div className="health-card health-sources-card">
      <span className="health-card-eyebrow">Data Sources &amp; Freshness</span>
      <ul className="health-sources-list">
        {dashboard.sources.map((source) => <li key={source.label} className="health-sources-row">
          <div><p className="health-sources-label">{source.label}</p><p className="health-sources-detail">{source.detail}</p></div>
          <span className={`health-sources-tag is-${source.state}`}>{SOURCE_STATE_LABEL[source.state]}</span>
        </li>)}
      </ul>
    </div>
  </section>;
}

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
