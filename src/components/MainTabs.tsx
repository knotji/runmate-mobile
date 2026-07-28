import { lazy, Suspense, useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { addCircleOutline, ellipsisHorizontalCircleOutline, pulseOutline, todayOutline } from 'ionicons/icons';
import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { hapticSelection } from '@/lib/haptics';

const loadRecoveryPage = () => import('@/pages/RecoveryPage');
const loadActivityPage = () => import('@/pages/ActivityPage');
const loadUploadPage = () => import('@/pages/UploadPage');
const loadMorePage = () => import('@/pages/MorePage');

const RecoveryPage = lazy(loadRecoveryPage);
const ActivityPage = lazy(loadActivityPage);
const UploadPage = lazy(loadUploadPage);
const MorePage = lazy(loadMorePage);

const tabPageLoaders = [
  { path: '/tabs/recovery', load: loadRecoveryPage },
  { path: '/tabs/upload', load: loadUploadPage },
  { path: '/tabs/activity', load: loadActivityPage },
  { path: '/tabs/more', load: loadMorePage },
];

const MainTabs: React.FC = () => {
  useEffect(() => {
    const prefetchInactiveTabs = () => {
      const activePath = window.location.pathname;
      const loaders = tabPageLoaders
        .filter(({ path }) => path !== activePath)
        .map(({ load }) => load());
      void Promise.allSettled(loaders);
    };

    const requestIdle = Reflect.get(window, 'requestIdleCallback') as typeof window.requestIdleCallback | undefined;
    const cancelIdle = Reflect.get(window, 'cancelIdleCallback') as typeof window.cancelIdleCallback | undefined;
    if (typeof requestIdle === 'function' && typeof cancelIdle === 'function') {
      const idleId = requestIdle(prefetchInactiveTabs, { timeout: 2500 });
      return () => cancelIdle(idleId);
    }
    const timerId = window.setTimeout(prefetchInactiveTabs, 1500);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/recovery"><Suspense fallback={<RouteLoadingScreen />}><RecoveryPage /></Suspense></Route>
        <Route exact path="/tabs/activity"><Suspense fallback={<RouteLoadingScreen />}><ActivityPage /></Suspense></Route>
        <Route exact path="/tabs/upload"><Suspense fallback={<RouteLoadingScreen />}><UploadPage /></Suspense></Route>
        <Route exact path="/tabs/more"><Suspense fallback={<RouteLoadingScreen />}><MorePage /></Suspense></Route>
        <Route exact path="/tabs/history"><Redirect to="/tabs/activity" /></Route>
        <Route exact path="/tabs"><Redirect to="/tabs/recovery" /></Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="main-tab-bar">
        <IonTabButton tab="recovery" href="/tabs/recovery" onClick={() => void hapticSelection()}><IonIcon icon={pulseOutline} /><IonLabel>Recovery</IonLabel></IonTabButton>
        <IonTabButton tab="upload" href="/tabs/upload" onClick={() => void hapticSelection()}><IonIcon icon={addCircleOutline} /><IonLabel>Upload</IonLabel></IonTabButton>
        <IonTabButton tab="activity" href="/tabs/activity" onClick={() => void hapticSelection()}><IonIcon icon={todayOutline} /><IonLabel>Activity</IonLabel></IonTabButton>
        <IonTabButton tab="more" href="/tabs/more" onClick={() => void hapticSelection()}><IonIcon icon={ellipsisHorizontalCircleOutline} /><IonLabel>More</IonLabel></IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default MainTabs;
