import { useEffect, useState } from 'react';
import { IonContent, IonHeader, IonIcon, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { arrowBackOutline, checkmarkCircleOutline, copyOutline, informationCircleOutline } from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { buildSupportDiagnostics, getRunMateBuildInfo, type RunMateBuildInfo } from '@/lib/aboutDiagnostics';
import { copyToClipboard } from '@/lib/clipboard';
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

  useEffect(() => { void getRunMateBuildInfo().then(setInfo); }, []);

  const copyDiagnostics = async () => {
    try {
      await copyToClipboard(buildSupportDiagnostics(info));
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2400);
    } catch {
      setCopyState('error');
    }
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
