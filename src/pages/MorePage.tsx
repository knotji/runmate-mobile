import { useRef, useState } from 'react';
import {
  IonAlert,
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
  useIonViewWillEnter,
} from '@ionic/react';
import {
  chevronForwardOutline,
  fitnessOutline,
  informationCircleOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  sparklesOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { loadMorePage, type MorePagePath } from '@/lib/morePageLoaders';
import { usePrimaryTabScroll } from '@/lib/usePrimaryTabScroll';
import { loadFreshYouContextData, type YouContextData } from '@/lib/youContextData';
import { loadYouContextStartupSnapshot, saveYouContextStartupSnapshot } from '@/lib/youContextStartupCache';
import './MorePage.css';

type SettingsMenuItem = {
  icon: string;
  title: string;
  summary: string;
  path: MorePagePath;
};

// Flattened — every destination production already ships (Coach History,
// Profile & Settings, Notifications, Health Connect, Privacy/Export/Account,
// About WholeMate), just no longer split into 4 sub-groups.
const PERSONAL_CONTROLS: SettingsMenuItem[] = [
  { icon: sparklesOutline, title: 'Coach History', summary: 'Continue your conversation or ask about a decision using your latest context.', path: '/ai-coach' },
  { icon: personCircleOutline, title: 'Profile & Settings', summary: 'Body metrics, heart-rate zones, sleep schedule, and training preferences.', path: '/profile-settings' },
  { icon: notificationsOutline, title: 'Notifications', summary: 'Bedtime, missing sleep, workout, and Recovery reminders.', path: '/notifications' },
  { icon: fitnessOutline, title: 'Health Connect', summary: 'Connect Samsung Health and manage automatic health data sync.', path: '/health-connect' },
  { icon: lockClosedOutline, title: 'Privacy, Export & Account', summary: 'Review stored data, export a copy, or delete your WholeMate account.', path: '/privacy-data' },
  { icon: informationCircleOutline, title: 'About WholeMate', summary: 'App version, release notes, and Copy Diagnostics for support.', path: '/about' },
];

const MorePage: React.FC = () => {
  const history = useHistory();
  const contentRef = usePrimaryTabScroll('you');
  const [youContext, setYouContext] = useState<YouContextData | null>(() => loadYouContextStartupSnapshot());
  const [signOutOpen, setSignOutOpen] = useState(false);
  const requestIdRef = useRef(0);

  const warmPage = (path: MorePagePath) => {
    void loadMorePage(path).catch(() => undefined);
  };

  const goTo = (path: string) => history.push(path, { from: '/tabs/you' });

  useIonViewWillEnter(() => {
    // Instant-paint from cache above, then a background refresh — same
    // pattern as Health/Move/Today. `useIonViewWillEnter` fires every time
    // this tab is re-entered, so rapid tab-hopping can leave more than one
    // refresh in flight; only the response matching the latest request id
    // is committed, so an older response can never overwrite a newer one.
    const requestId = ++requestIdRef.current;
    void loadFreshYouContextData().then((result) => {
      if (requestIdRef.current !== requestId || result.status !== 'ready') return;
      setYouContext(result.data);
      saveYouContextStartupSnapshot(result.data);
    });
  });

  return (
    <IonPage className="you-page">
      <IonHeader translucent className="more-header">
        <IonToolbar><IonTitle>You</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} fullscreen className="more-content">
        <main className="more-shell">
          <header className="more-heading">
            <p>YOUR CONTEXT</p>
            <h1>What WholeMate Knows About You</h1>
          </header>

          {youContext && <>
            <section className="you-focus-card" aria-labelledby="you-focus-heading">
              <p className="you-eyebrow" id="you-focus-heading">Your Focus</p>
              <p className="you-focus-title">{youContext.focus.title}</p>
              <p className="you-focus-detail">{youContext.focus.detail}</p>
              <button type="button" className="you-focus-cta" onClick={() => goTo(youContext.focus.ctaPath)}>
                {youContext.focus.ctaLabel}
                <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
              </button>
            </section>

            <section className="you-context-card" aria-labelledby="you-context-heading">
              <p className="you-eyebrow" id="you-context-heading">Your Context</p>
              <ul className="you-context-list">
                {youContext.context.map((item) => (
                  <li key={item.label} className="you-context-row">
                    {item.path ? (
                      <button type="button" className="you-context-button" onClick={() => goTo(item.path!)}>
                        <span className="you-context-label">{item.label}</span>
                        <span className="you-context-right">
                          <span className={`you-context-value${item.tone === 'caution' ? ' is-caution' : ''}`}>{item.value}</span>
                          <IonIcon icon={chevronForwardOutline} className="you-context-chevron" aria-hidden="true" />
                        </span>
                      </button>
                    ) : (
                      <div className="you-context-static">
                        <span className="you-context-label">{item.label}</span>
                        <span className={`you-context-value${item.tone === 'caution' ? ' is-caution' : ''}`}>{item.value}</span>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>

            <section className="you-checkin-card" aria-labelledby="you-checkin-heading">
              <p className="you-eyebrow" id="you-checkin-heading">Today&apos;s Check-In</p>
              {youContext.checkIn.hasCheckIn ? (
                <div className="you-checkin-body">
                  {youContext.checkIn.stress && <p className="you-checkin-line"><strong>Stress</strong><span>{youContext.checkIn.stress}</span></p>}
                  {youContext.checkIn.environment && <p className="you-checkin-line"><strong>Environment</strong><span>{youContext.checkIn.environment}</span></p>}
                </div>
              ) : (
                <p className="you-checkin-empty">No check-in logged yet today.</p>
              )}
            </section>
          </>}

          <section className="more-group" aria-labelledby="personal-controls-heading">
            <header className="more-group-heading">
              <p>Settings</p>
              <h2 id="personal-controls-heading">Personal Controls</h2>
            </header>
            <div className="more-menu">
              {PERSONAL_CONTROLS.map((item) => (
                <button className="more-menu-row more-menu-button" type="button" onPointerEnter={() => warmPage(item.path)} onPointerDown={() => warmPage(item.path)} onFocus={() => warmPage(item.path)} onClick={() => goTo(item.path)} key={item.title}>
                  <div className="more-menu-icon"><IonIcon icon={item.icon} aria-hidden="true" /></div>
                  <div className="more-menu-copy">
                    <strong>{item.title}</strong>
                    <span>{item.summary}</span>
                  </div>
                  <IonIcon className="more-chevron" icon={chevronForwardOutline} aria-hidden="true" />
                </button>
              ))}
            </div>
          </section>

          <section className="more-account" aria-labelledby="account-heading">
            <p id="account-heading">ACCOUNT</p>
            <IonButton expand="block" fill="outline" color="danger" onClick={() => setSignOutOpen(true)}>
              <IonIcon slot="start" icon={logOutOutline} />
              Sign Out
            </IonButton>
          </section>
        </main>
      </IonContent>
      <IonAlert
        isOpen={signOutOpen}
        onDidDismiss={() => setSignOutOpen(false)}
        header="Sign Out?"
        message="You will need to sign back in to see your WholeMate data on this device."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Sign Out', role: 'destructive', handler: () => void supabase.auth.signOut() },
        ]}
      />
    </IonPage>
  );
};

export default MorePage;
