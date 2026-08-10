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
  fitnessOutline,
  informationCircleOutline,
  lockClosedOutline,
  logOutOutline,
  notificationsOutline,
  personCircleOutline,
} from 'ionicons/icons';
import { useHistory } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { loadMorePage, type MorePagePath } from '@/lib/morePageLoaders';
import './MorePage.css';

type SettingsMenuItem = {
  icon: string;
  title: string;
  summary: string;
  path: MorePagePath;
};

const menuGroups: Array<{ label: string; title: string; items: SettingsMenuItem[] }> = [
  {
    label: 'Personalize',
    title: 'Profile & Preferences',
    items: [
      {
        icon: personCircleOutline,
        title: 'Profile & Settings',
        summary: 'Body metrics, heart-rate zones, sleep schedule, and training preferences.',
        path: '/profile-settings',
      },
      {
        icon: notificationsOutline,
        title: 'Notifications',
        summary: 'Bedtime, missing sleep, workout, and Recovery reminders.',
        path: '/notifications',
      },
    ],
  },
  {
    label: 'Your Data',
    title: 'Connections & Control',
    items: [
      {
        icon: fitnessOutline,
        title: 'Health Connect',
        summary: 'Connect Samsung Health and manage automatic health data sync.',
        path: '/health-connect',
      },
      {
        icon: lockClosedOutline,
        title: 'Privacy, Export & Account',
        summary: 'Review stored data, export a copy, or delete your RunMate account.',
        path: '/privacy-data',
      },
    ],
  },
  {
    label: 'Support',
    title: 'App & Diagnostics',
    items: [
      {
        icon: informationCircleOutline,
        title: 'About RunMate',
        summary: 'App version, release notes, and Copy Diagnostics for support.',
        path: '/about',
      },
    ],
  },
];

const MorePage: React.FC = () => {
  const history = useHistory();

  const warmPage = (path: MorePagePath) => {
    void loadMorePage(path).catch(() => undefined);
  };

  return (
    <IonPage>
      <IonHeader translucent className="more-header">
        <IonToolbar><IonTitle>Settings & Data</IonTitle></IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="more-content">
        <main className="more-shell">
          <header className="more-heading">
            <p>YOUR RUNMATE</p>
            <h1>Your App, Your Data</h1>
            <span>Manage your profile, connected health sources, privacy, exports, and support details.</span>
          </header>

          <div className="more-groups">
            {menuGroups.map((group) => (
              <section className="more-group" aria-labelledby={`settings-${group.label.toLowerCase().replace(' ', '-')}`} key={group.label}>
                <header className="more-group-heading">
                  <p>{group.label}</p>
                  <h2 id={`settings-${group.label.toLowerCase().replace(' ', '-')}`}>{group.title}</h2>
                </header>
                <div className="more-menu">
                  {group.items.map((item) => (
                    <button className="more-menu-row more-menu-button" type="button" onPointerEnter={() => warmPage(item.path)} onPointerDown={() => warmPage(item.path)} onFocus={() => warmPage(item.path)} onClick={() => history.push(item.path, { from: '/tabs/settings' })} key={item.title}>
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
