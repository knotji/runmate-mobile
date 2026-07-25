import { lazy, Suspense } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { addCircleOutline, ellipsisHorizontalCircleOutline, pulseOutline, todayOutline } from 'ionicons/icons';
import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { hapticSelection } from '@/lib/haptics';

const RecoveryPage = lazy(() => import('@/pages/RecoveryPage'));
const ActivityPage = lazy(() => import('@/pages/ActivityPage'));
const UploadPage = lazy(() => import('@/pages/UploadPage'));
const MorePage = lazy(() => import('@/pages/MorePage'));

const MainTabs: React.FC = () => (
  <IonTabs>
    <Suspense fallback={<RouteLoadingScreen />}>
      <IonRouterOutlet>
        <Route exact path="/tabs/recovery" component={RecoveryPage} />
        <Route exact path="/tabs/activity" component={ActivityPage} />
        <Route exact path="/tabs/upload" component={UploadPage} />
        <Route exact path="/tabs/more" component={MorePage} />
        <Route exact path="/tabs/history"><Redirect to="/tabs/activity" /></Route>
        <Route exact path="/tabs"><Redirect to="/tabs/recovery" /></Route>
      </IonRouterOutlet>
    </Suspense>
    <IonTabBar slot="bottom" className="main-tab-bar">
      <IonTabButton tab="recovery" href="/tabs/recovery" onClick={() => void hapticSelection()}><IonIcon icon={pulseOutline} /><IonLabel>Recovery</IonLabel></IonTabButton>
      <IonTabButton tab="upload" href="/tabs/upload" onClick={() => void hapticSelection()}><IonIcon icon={addCircleOutline} /><IonLabel>Upload</IonLabel></IonTabButton>
      <IonTabButton tab="activity" href="/tabs/activity" onClick={() => void hapticSelection()}><IonIcon icon={todayOutline} /><IonLabel>Activity</IonLabel></IonTabButton>
      <IonTabButton tab="more" href="/tabs/more" onClick={() => void hapticSelection()}><IonIcon icon={ellipsisHorizontalCircleOutline} /><IonLabel>More</IonLabel></IonTabButton>
    </IonTabBar>
  </IonTabs>
);

export default MainTabs;
