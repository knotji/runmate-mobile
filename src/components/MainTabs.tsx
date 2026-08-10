import { lazy, Suspense, useEffect } from 'react';
import { Redirect, Route } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { fitnessOutline, heartOutline, homeOutline, sparklesOutline } from 'ionicons/icons';
import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { hapticSelection } from '@/lib/haptics';

const loadRecoveryPage = () => import('@/pages/RecoveryPage');
const loadActivityPage = () => import('@/pages/ActivityPage');
const loadHealthPage = () => import('@/pages/HealthPage');
const loadCoachPage = () => import('@/pages/AiCoachPage');
const loadUploadPage = () => import('@/pages/UploadPage');
const loadMorePage = () => import('@/pages/MorePage');

const RecoveryPage = lazy(loadRecoveryPage);
const ActivityPage = lazy(loadActivityPage);
const HealthPage = lazy(loadHealthPage);
const CoachPage = lazy(loadCoachPage);
const UploadPage = lazy(loadUploadPage);
const MorePage = lazy(loadMorePage);

const tabPageLoaders = [
  { path: '/tabs/today', load: loadRecoveryPage },
  { path: '/tabs/health', load: loadHealthPage },
  { path: '/tabs/move', load: loadActivityPage },
  { path: '/tabs/coach', load: loadCoachPage },
];

const MainTabs: React.FC = () => {
  useEffect(() => {
    const prefetchInactiveTabs = () => {
      const connection = Reflect.get(navigator, 'connection') as { effectiveType?: string; saveData?: boolean } | undefined;
      if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;
      const activePath = window.location.pathname;
      const loaders = tabPageLoaders
        .filter(({ path }) => path !== activePath)
        .map(({ load }) => load());
      void Promise.allSettled(loaders);
    };

    const requestIdle = Reflect.get(window, 'requestIdleCallback') as typeof window.requestIdleCallback | undefined;
    const cancelIdle = Reflect.get(window, 'cancelIdleCallback') as typeof window.cancelIdleCallback | undefined;
    if (typeof requestIdle === 'function' && typeof cancelIdle === 'function') {
      const idleId = requestIdle(prefetchInactiveTabs, { timeout: 4000 });
      return () => cancelIdle(idleId);
    }
    const timerId = window.setTimeout(prefetchInactiveTabs, 3500);
    return () => window.clearTimeout(timerId);
  }, []);

  return (
    <IonTabs>
      <IonRouterOutlet>
        <Route exact path="/tabs/today"><Suspense fallback={<RouteLoadingScreen />}><RecoveryPage /></Suspense></Route>
        <Route exact path="/tabs/health"><Suspense fallback={<RouteLoadingScreen />}><HealthPage /></Suspense></Route>
        <Route exact path="/tabs/move"><Suspense fallback={<RouteLoadingScreen />}><ActivityPage /></Suspense></Route>
        <Route exact path="/tabs/coach"><Suspense fallback={<RouteLoadingScreen />}><CoachPage /></Suspense></Route>
        <Route exact path="/tabs/log"><Suspense fallback={<RouteLoadingScreen />}><UploadPage /></Suspense></Route>
        <Route exact path="/tabs/upload"><Suspense fallback={<RouteLoadingScreen />}><UploadPage /></Suspense></Route>
        <Route exact path="/tabs/more"><Suspense fallback={<RouteLoadingScreen />}><MorePage /></Suspense></Route>
        <Route exact path="/tabs/recovery"><Redirect to="/tabs/today" /></Route>
        <Route exact path="/tabs/activity"><Redirect to="/tabs/move" /></Route>
        <Route exact path="/tabs/history"><Redirect to="/tabs/move" /></Route>
        <Route exact path="/tabs"><Redirect to="/tabs/today" /></Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="main-tab-bar">
        <IonTabButton tab="today" href="/tabs/today" onClick={() => void hapticSelection()}><IonIcon icon={homeOutline} /><IonLabel>Today</IonLabel></IonTabButton>
        <IonTabButton tab="health" href="/tabs/health" onClick={() => void hapticSelection()}><IonIcon icon={heartOutline} /><IonLabel>Health</IonLabel></IonTabButton>
        <IonTabButton tab="move" href="/tabs/move" onClick={() => void hapticSelection()}><IonIcon icon={fitnessOutline} /><IonLabel>Move</IonLabel></IonTabButton>
        <IonTabButton tab="coach" href="/tabs/coach" onClick={() => void hapticSelection()}><IonIcon icon={sparklesOutline} /><IonLabel>Coach</IonLabel></IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default MainTabs;
