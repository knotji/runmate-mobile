import { IonContent, IonHeader, IonPage, IonTitle, IonToolbar } from '@ionic/react';
import { PageDataSkeleton } from './PageDataSkeleton';
import { loadingDetailsForPath } from './routeLoadingDetails';
import './RouteLoadingScreen.css';

export function RouteLoadingScreen() {
  const details = loadingDetailsForPath(window.location.pathname);
  return <IonPage className="route-loading-page">
    <IonHeader translucent><IonToolbar><IonTitle>{details.title}</IonTitle></IonToolbar></IonHeader>
    <IonContent fullscreen className="route-loading-content">
      <main className="route-loading-shell">
        <PageDataSkeleton variant={details.variant} label={`Loading ${details.title}`} />
      </main>
    </IonContent>
  </IonPage>;
}
