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
  chevronForwardOutline,
  flagOutline,
  fitnessOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  sparklesOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import './MorePage.css';

const plannedItems = [
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
    icon: statsChartOutline,
    title: 'Weekly Summary',
    summary: 'Review the last 7 days of training, sleep, and logged meals.',
    path: '/weekly-summary',
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
];

const MorePage: React.FC = () => {
  const history = useHistory();

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
          {plannedItems.map((item) => item.path ? (
            <button className="more-menu-row more-menu-button" type="button" onClick={() => history.push(item.path)} key={item.title}>
              <div className="more-menu-icon"><IonIcon icon={item.icon} /></div>
              <div className="more-menu-copy">
                <strong>{item.title}</strong>
                <span>{item.summary}</span>
              </div>
              <IonIcon className="more-chevron" icon={chevronForwardOutline} />
            </button>
          ) : (
            <div className="more-menu-row" key={item.title}>
              <div className="more-menu-icon"><IonIcon icon={item.icon} /></div>
              <div className="more-menu-copy"><strong>{item.title}</strong><span>{item.summary}</span></div>
              <span className="more-planned">Planned</span>
            </div>
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
