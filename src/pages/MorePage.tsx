import {
  IonButton,
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonTitle,
  IonToolbar,
} from '@ionic/react';
import {
  bandageOutline,
  calendarOutline,
  chevronForwardOutline,
  flagOutline,
  fitnessOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  scaleOutline,
  sparklesOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { loadMorePage, preloadMorePages, type MorePagePath } from '@/lib/morePageLoaders';
import './MorePage.css';

const plannedItems: Array<{
  icon: string;
  title: string;
  summary: string;
  path: MorePagePath;
}> = [
  {
    icon: sparklesOutline,
    title: 'AI Coach',
    summary: 'Get a data-aware recommendation for training, Recovery, nutrition, or your Race Goal.',
    path: '/ai-coach',
  },
  {
    icon: flagOutline,
    title: 'Race Goal',
    summary: 'Race date, distance, target time, and training progress.',
    path: '/race-goal',
  },
  {
    icon: calendarOutline,
    title: 'Weekly Plan',
    summary: 'This week’s full training plan, with what actually happened.',
    path: '/weekly-plan',
  },
  {
    icon: statsChartOutline,
    title: 'Weekly Summary',
    summary: 'Review the last 7 days of training, sleep, and logged meals.',
    path: '/weekly-summary',
  },
  {
    icon: bandageOutline,
    title: 'Pain & Injury Trend',
    summary: 'See how logged Pain and Injury reports are changing over time.',
    path: '/pain-trends',
  },
  {
    icon: scaleOutline,
    title: 'Body Weight Trend',
    summary: 'Track weigh-ins synced from Health Connect over time.',
    path: '/body-weight-trend',
  },
  {
    icon: personCircleOutline,
    title: 'Profile & Settings',
    summary: 'Max HR, body weight, and essential training preferences.',
    path: '/profile-settings',
  },
  {
    icon: notificationsOutline,
    title: 'Notifications',
    summary: 'Bedtime, missing sleep, workout, and recovery reminders.',
    path: '/notifications',
  },
  {
    icon: fitnessOutline,
    title: 'Health Connect',
    summary: 'Connect Samsung Health and manage automatic health data sync.',
    path: '/health-connect',
  },
  {
    icon: lockClosedOutline,
    title: 'Privacy & Data',
    summary: 'What RunMate collects, and how to export or delete your data.',
    path: '/privacy-data',
  },
];

const MorePage: React.FC = () => {
  const history = useHistory();

  useEffect(() => {
    void preloadMorePages().catch(() => undefined);
  }, []);

  const openPage = (path: MorePagePath) => {
    void loadMorePage(path).catch(() => undefined).finally(() => history.push(path));
  };

  return (
  <IonPage>
    <IonHeader translucent className="more-header">
      <IonToolbar><IonTitle>More</IonTitle></IonToolbar>
    </IonHeader>
    <IonContent fullscreen className="more-content">
      <main className="more-shell">
        <header className="more-heading">
          <p>YOUR RUNMATE</p>
          <h1>Plan And Personalize</h1>
          <span>Manage goals, connected health data, summaries, and app preferences.</span>
        </header>

        <section className="more-menu" aria-label="More Features">
          {plannedItems.map((item) => (
            <button className="more-menu-row more-menu-button" type="button" onPointerDown={() => { void loadMorePage(item.path).catch(() => undefined); }} onClick={() => openPage(item.path)} key={item.title}>
              <div className="more-menu-icon"><IonIcon icon={item.icon} /></div>
              <div className="more-menu-copy">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </div>
              <IonIcon className="more-chevron" icon={chevronForwardOutline} />
            </button>
          ))}
        </section>

        <section className="more-account" aria-labelledby="account-heading">
          <p id="account-heading">ACCOUNT</p>
          <IonButton expand="block" fill="outline" color="danger" onClick={() => void supabase.auth.signOut()}>
            <IonIcon slot="start" icon={logOutOutline} />
            Sign Out
          </IonButton>
        </section>
      </main>
    </IonContent>
  </IonPage>
  );
};

export default MorePage;
