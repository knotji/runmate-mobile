import { useEffect, useState } from 'react';
import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { alertCircleOutline, arrowBackOutline, checkmarkCircleOutline, copyOutline, informationCircleOutline, refreshOutline, timeOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buildSupportDiagnostics, getReleaseHealthSnapshot, getRunMateBuildInfo, type ReleaseHealthRow, type RunMateBuildInfo } from '@/lib/aboutDiagnostics';
import { copyToClipboard } from '@/lib/clipboard';
import { clearRunMateCachedData } from '@/lib/appCache';
import './AboutPage.css';

const releaseNotes = [
  'Adaptive Sleep Coach with wake-time and sleep-cycle planning.',
  'Transparent Month Share card with integrated RunMate branding.',
  'Consistent Health Connect workout duration across Activity, Recovery, and summaries.',
  'Faster interactions, performance budgets, and improved accessibility semantics.',
];

const AboutPage: React.FC = () => {
  const history = useHistory();
  const [info, setInfo] = useState<RunMateBuildInfo>({
    version: __RUNMATE_VERSION__,
    build: __RUNMATE_BUILD_CODE__,
    builtAt: __RUNMATE_BUILD_DATE__,
  });
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const [cacheCleared, setCacheCleared] = useState(false);
  const [releaseHealth, setReleaseHealth] = useState<ReleaseHealthRow[]>(() => getReleaseHealthSnapshot());

  useEffect(() => {
    void getRunMateBuildInfo().then(setInfo);
    setReleaseHealth(getReleaseHealthSnapshot());
  }, []);

  const copyDiagnostics = async () => {
    try {
      await copyToClipboard(buildSupportDiagnostics(info));
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2400);
    } catch {
      setCopyState('error');
    }
  };

  const clearCachedData = () => {
    clearRunMateCachedData();
    setReleaseHealth(getReleaseHealthSnapshot());
    setCacheCleared(true);
    window.setTimeout(() => setCacheCleared(false), 2400);
  };

  return <IonPage>
    <IonHeader translucent className="about-header"><IonToolbar>
      <button type="button" className="about-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>About RunMate</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="about-content">
      <main className="about-shell">
        <header className="about-heading">
          <p>Your RunMate</p>
          <h1>Built To Support Your Training</h1>
          <span>Version details, release highlights, and privacy-safe support diagnostics.</span>
        </header>

        <section className="about-version-card" aria-labelledby="about-version-heading">
          <IonIcon icon={informationCircleOutline} aria-hidden="true" />
          <div><p>Current Version</p><h2 id="about-version-heading">{info.version} ({info.build})</h2><span>Built {formatBuildDate(info.builtAt)}</span></div>
        </section>

        <section className="about-card" aria-labelledby="release-notes-heading">
          <header><p>Release Notes</p><h2 id="release-notes-heading">What’s New In This Build</h2></header>
          <ul>{releaseNotes.map((note) => <li key={note}><IonIcon icon={checkmarkCircleOutline} aria-hidden="true" /><span>{note}</span></li>)}</ul>
        </section>

        <section className="about-card about-health" aria-labelledby="release-health-heading">
          <header><p>Release Health</p><h2 id="release-health-heading">Device Readiness</h2></header>
          <span>Privacy-safe operational checks only. No health measurements or account records are shown.</span>
          <div className="about-health-list">
            {releaseHealth.map((row) => <div key={row.key} className={`status-${row.status}`}>
              <IonIcon icon={row.status === 'ready' ? checkmarkCircleOutline : row.status === 'attention' ? alertCircleOutline : timeOutline} aria-hidden="true" />
              <span><strong>{row.label}</strong><small>{row.detail}</small></span>
            </div>)}
          </div>
          <button type="button" onClick={() => setReleaseHealth(getReleaseHealthSnapshot())} aria-label="Refresh release health checks">
            <IonIcon icon={refreshOutline} aria-hidden="true" />Refresh Checks
          </button>
        </section>

        <section className="about-card about-support" aria-labelledby="support-heading">
          <header><p>Support</p><h2 id="support-heading">Copy Diagnostics</h2></header>
          <span>Copies app version, sync times, cache status, active plan version, and page timings. It does not include sleep, workout, meal, profile, or account data.</span>
          <button type="button" onClick={() => void copyDiagnostics()}>
            <IonIcon icon={copyState === 'copied' ? checkmarkCircleOutline : copyOutline} aria-hidden="true" />
            {copyState === 'copied' ? 'Diagnostics Copied' : 'Copy Diagnostics'}
          </button>
          {copyState === 'copied' && <p className="about-copy-status" role="status">Ready to paste into a bug report.</p>}
          {copyState === 'error' && <p className="about-copy-error" role="alert">Could not access the clipboard. Please try again.</p>}
        </section>

        <section className="about-card about-cache" aria-labelledby="cache-heading">
          <header><p>Troubleshooting</p><h2 id="cache-heading">Refresh Local Cache</h2></header>
          <span>Clears temporary startup snapshots and AI answers on this device. Your Supabase health records, plans, meals, and profile stay untouched.</span>
          <button type="button" onClick={clearCachedData}>
            <IonIcon icon={cacheCleared ? checkmarkCircleOutline : refreshOutline} aria-hidden="true" />
            {cacheCleared ? 'Cached Data Cleared' : 'Clear Cached Data'}
          </button>
          {cacheCleared && <p className="about-copy-status" role="status">RunMate will load fresh data the next time each page opens.</p>}
        </section>
      </main>
    </IonContent>
  </IonPage>;
};

function formatBuildDate(value: string): string {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

export default AboutPage;
