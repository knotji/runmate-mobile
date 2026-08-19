import { useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonIcon, IonPage } from '@ionic/react';
import { chevronForward, fitnessOutline, lockClosedOutline, notificationsOutline, personCircleOutline } from 'ionicons/icons';
import { loadRealYouData, type RealYouResult } from './realYou';
import { LabNav } from './LabNav';
import './tokens.css';
import './shared.css';
import './YouNextPage.css';

// Personal controls — a short, curated list of real destinations, not a
// reproduction of the shipped More page. Every path here is a route that
// already exists and works today.
const PERSONAL_CONTROLS = [
  { icon: personCircleOutline, label: 'Profile & Settings', path: '/profile-settings' },
  { icon: notificationsOutline, label: 'Notifications', path: '/notifications' },
  { icon: fitnessOutline, label: 'Health Connect', path: '/health-connect' },
  { icon: lockClosedOutline, label: 'Privacy & Data', path: '/privacy-data' },
];

const YouNextPage: React.FC = () => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<RealYouResult | null>(null);

  useEffect(() => {
    let alive = true;
    void loadRealYouData().then((next) => {
      if (!alive) return;
      setResult(next);
      setLoading(false);
    });
    return () => { alive = false; };
  }, []);

  const goTo = (path: string) => history.push(path, { from: '/labs/you-next' });

  return (
    <IonPage>
      <IonContent fullscreen scrollY className="wmn-content">
        <div className="wm-next wmn-you">
          <div className="wmn-lab-banner">
            <span>WholeMate Next — You prototype</span>
            <span className="wmn-lab-banner-tag">not shipped</span>
          </div>

          <header className="wmn-page-header">
            <span className="wmn-hero-eyebrow wmn-page-eyebrow-accent">Your Context</span>
            <h1 className="wmn-page-title">You</h1>
          </header>

          {loading && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">Loading</span>
              <p className="wmn-state-panel-title">Reading your goal, context, and check-in…</p>
            </div>
          )}

          {!loading && result?.status === 'unauthenticated' && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">Signed Out</span>
              <p className="wmn-state-panel-title">Log In To See Your Context</p>
              <p className="wmn-state-panel-detail">This device isn’t signed in, so there’s no personal goal, context, or check-in to show yet. Settings below still work.</p>
            </div>
          )}

          {!loading && result?.status === 'error' && (
            <div className="wmn-card wmn-state-panel">
              <span className="wmn-eyebrow">You</span>
              <p className="wmn-state-panel-title">Couldn’t Load Your Data</p>
              <p className="wmn-state-panel-detail">{result.message}</p>
            </div>
          )}

          {!loading && result?.status === 'ready' && (
            <>
              {/* Your Focus — one primary goal, not a grid */}
              <section className="wmn-card wmn-action-card">
                <span className="wmn-eyebrow">Your Focus</span>
                <p className="wmn-action-title">{result.focus.title}</p>
                <p className="wmn-action-detail">{result.focus.detail}</p>
                <button type="button" className="wmn-action-button" onClick={() => goTo(result.focus.ctaPath)}>
                  {result.focus.ctaLabel}
                  <IonIcon icon={chevronForward} />
                </button>
              </section>

              {/* Your Context — a few factors that actually change guidance */}
              <section className="wmn-card wmn-you-context-card">
                <span className="wmn-eyebrow">Your Context</span>
                <ul className="wmn-you-context-list">
                  {result.context.map((item) => {
                    const valueClass = `wmn-you-context-value${item.tone === 'caution' ? ' caution' : ''}`;
                    return (
                      <li key={item.label} className="wmn-you-context-row">
                        {item.path ? (
                          <button type="button" className="wmn-you-context-button" onClick={() => goTo(item.path!)}>
                            <span className="wmn-you-context-label">{item.label}</span>
                            <span className="wmn-you-context-right">
                              <span className={valueClass}>{item.value}</span>
                              <IonIcon icon={chevronForward} className="wmn-you-context-chevron" />
                            </span>
                          </button>
                        ) : (
                          <div className="wmn-you-context-static">
                            <span className="wmn-you-context-label">{item.label}</span>
                            <span className={valueClass}>{item.value}</span>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </section>

              {/* Reflection / check-in — only real, user-entered signals */}
              <section className="wmn-card wmn-you-checkin-card">
                <span className="wmn-eyebrow">Today’s Check-In</span>
                {result.checkIn.hasCheckIn ? (
                  <div className="wmn-you-checkin-body">
                    {result.checkIn.stress && (
                      <p className="wmn-you-checkin-line"><strong>Stress</strong><span>{result.checkIn.stress}</span></p>
                    )}
                    {result.checkIn.environment && (
                      <p className="wmn-you-checkin-line"><strong>Environment</strong><span>{result.checkIn.environment}</span></p>
                    )}
                  </div>
                ) : (
                  <p className="wmn-you-checkin-empty">No check-in logged yet today.</p>
                )}
              </section>
            </>
          )}

          {/* Personal controls — always available, independent of the account
              data above, since these are just navigation. */}
          <section className="wmn-card wmn-you-controls-card">
            <span className="wmn-eyebrow">Personal Controls</span>
            <ul className="wmn-you-controls-list">
              {PERSONAL_CONTROLS.map((control) => (
                <li key={control.path}>
                  <button type="button" className="wmn-you-controls-row" onClick={() => goTo(control.path)}>
                    <IonIcon icon={control.icon} className="wmn-you-controls-icon" />
                    <span className="wmn-you-controls-label">{control.label}</span>
                    <IonIcon icon={chevronForward} className="wmn-you-controls-chevron" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </IonContent>
      <LabNav active="you" />
    </IonPage>
  );
};

export default YouNextPage;
