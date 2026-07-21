import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { PageDataSkeleton } from './PageDataSkeleton';
import './RouteLoadingScreen.css';

const routeDetails: Record<string, { title: string; variant: 'coach' | 'race' | 'summary' | 'profile' }> = {
  '/ai-coach': { title: 'AI Coach', variant: 'coach' },
  '/race-goal': { title: 'Race Goal', variant: 'race' },
  '/weekly-summary': { title: 'Weekly Summary', variant: 'summary' },
  '/profile-settings': { title: 'Profile & Settings', variant: 'profile' },
  '/notifications': { title: 'Notifications', variant: 'profile' },
  '/health-connect': { title: 'Health Connect', variant: 'profile' },
};

export function RouteLoadingScreen() {
  const details = routeDetails[window.location.pathname] ?? { title: 'RunMate', variant: 'profile' as const };
  return <IonPage className="route-loading-page">
    <IonHeader translucent><IonToolbar><IonTitle>{details.title}</IonTitle></IonToolbar></IonHeader>
    <IonContent fullscreen className="route-loading-content">
      <main className="route-loading-shell">
        <PageDataSkeleton variant={details.variant} label={`Loading ${details.title}`} />
      </main>
    </IonContent>
  </IonPage>;
}
