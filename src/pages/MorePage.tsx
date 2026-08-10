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
  informationCircleOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
  scaleOutline,
  sparklesOutline,
  statsChartOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { loadMorePage, type MorePagePath } from '@/lib/morePageLoaders';
import './MorePage.css';

type MoreMenuItem = {
  icon: string;
  title: string;
  summary: string;
  path: MorePagePath;
};

const menuGroups: Array<{ label: string; title: string; items: MoreMenuItem[] }> = [
  {
    label: 'Plan',
    title: 'Training & Goals',
    items: [
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
    ],
  },
  {
    label: 'Insights',
    title: 'Trends & Summaries',
    items: [
  {
    icon: statsChartOutline,
    title: 'Training Summary',
    summary: 'Review workouts, sleep, and logged meals by calendar week or month.',
    path: '/weekly-summary',
  },
  {
    icon: calendarOutline,
    title: 'Health Calendar',
    summary: 'See daily health records and evidence-labeled habit patterns in one place.',
    path: '/health-calendar',
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
    icon: fitnessOutline,
    title: 'Fitness Age',
    summary: 'See how cardio fitness, sleep, recovery, and consistency shape your long-term estimate.',
    path: '/fitness-age',
  },
    ],
  },
  {
    label: 'RunMate',
    title: 'Settings & Data',
    items: [
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
  {
    icon: informationCircleOutline,
    title: 'About RunMate',
    summary: 'App version, release notes, and support diagnostics.',
    path: '/about',
  },
    ],
  },
];

const MorePage: React.FC = () => {
  const history = useHistory();

  const openPage = (path: MorePagePath) => {
    history.push(path === '/ai-coach' ? '/tabs/coach' : path);
  };

  const warmPage = (path: MorePagePath) => {
    void loadMorePage(path).catch(() => undefined);
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

        <div className="more-groups">
          {menuGroups.map((group) => (
            <section className="more-group" aria-labelledby={`more-${group.label.toLowerCase()}`} key={group.label}>
              <header className="more-group-heading">
                <p>{group.label}</p>
                <h2 id={`more-${group.label.toLowerCase()}`}>{group.title}</h2>
              </header>
              <div className="more-menu">
                {group.items.map((item) => (
                  <button className="more-menu-row more-menu-button" type="button" onPointerEnter={() => warmPage(item.path)} onPointerDown={() => warmPage(item.path)} onFocus={() => warmPage(item.path)} onClick={() => openPage(item.path)} key={item.title}>
                    <div className="more-menu-icon"><IonIcon icon={item.icon} /></div>
                    <div className="more-menu-copy">
                      <strong>{item.title}</strong>
                      <span>{item.summary}</span>
                    </div>
                    <IonIcon className="more-chevron" icon={chevronForwardOutline} />
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>

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
