import { lazy, Suspense, useEffect } from 'react';
import { Redirect, Route, useLocation } from 'react-router-dom';
import { IonIcon, IonLabel, IonRouterOutlet, IonTabBar, IonTabButton, IonTabs } from '@ionic/react';
import { fitnessOutline, heartOutline, homeOutline, personCircleOutline } from 'ionicons/icons';
import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { hapticSelection } from '@/lib/haptics';
import { beginTabNavigation, completeTabNavigation } from '@/lib/tabNavigationPerformance';

const loadRecoveryPage = () => import('@/pages/RecoveryPage');
const loadActivityPage = () => import('@/pages/ActivityPage');
const loadHealthPage = () => import('@/pages/HealthPage');
const loadCoachPage = () => import('@/pages/AiCoachPage');
const loadUploadPage = () => import('@/pages/UploadPage');
const loadYouPage = () => import('@/pages/MorePage');

const RecoveryPage = lazy(loadRecoveryPage);
const ActivityPage = lazy(loadActivityPage);
const HealthPage = lazy(loadHealthPage);
const CoachPage = lazy(loadCoachPage);
const UploadPage = lazy(loadUploadPage);
const YouPage = lazy(loadYouPage);

const tabPageLoaders = [
  { path: '/tabs/today', load: loadRecoveryPage },
  { path: '/tabs/health', load: loadHealthPage },
  { path: '/tabs/move', load: loadActivityPage },
  { path: '/tabs/you', load: loadYouPage },
];

// Not a tab-bar destination, so it's outside tabPageLoaders' active-tab
// filtering — but Today/Health/Move all link to it via a "+" button with no
// warm-on-hover of their own, so without this it's the one route in the tab
// shell that's never prefetched: the first tap anywhere always pays for a
// real lazy-chunk fetch, and the Suspense fallback swapping to real content
// mid-transition reads as a layout jump.
const alwaysPrefetchLoaders = [loadUploadPage];

const MainTabs: React.FC = () => {
  const location = useLocation();

  useEffect(() => { completeTabNavigation(location.pathname); }, [location.pathname]);

  const startTabNavigation = (path: string) => {
    beginTabNavigation(path, location.pathname);
    void hapticSelection();
  };

  useEffect(() => {
    const prefetchInactiveTabs = () => {
      const connection = Reflect.get(navigator, 'connection') as { effectiveType?: string; saveData?: boolean } | undefined;
      if (connection?.saveData || connection?.effectiveType === 'slow-2g' || connection?.effectiveType === '2g') return;
      const activePath = window.location.pathname;
      const loaders = [
        ...tabPageLoaders.filter(({ path }) => path !== activePath).map(({ load }) => load()),
        ...alwaysPrefetchLoaders.map((load) => load()),
      ];
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
        <Route exact path="/tabs/you"><Suspense fallback={<RouteLoadingScreen />}><YouPage /></Suspense></Route>
        <Route exact path="/tabs/coach"><Suspense fallback={<RouteLoadingScreen />}><CoachPage /></Suspense></Route>
        <Route exact path="/tabs/log"><Suspense fallback={<RouteLoadingScreen />}><UploadPage /></Suspense></Route>
        <Route exact path="/tabs/upload"><Suspense fallback={<RouteLoadingScreen />}><UploadPage /></Suspense></Route>
        <Route exact path="/tabs/settings"><Redirect to="/tabs/you" /></Route>
        <Route exact path="/tabs/more"><Redirect to="/tabs/you" /></Route>
        <Route exact path="/tabs/recovery"><Redirect to="/tabs/today" /></Route>
        <Route exact path="/tabs/activity"><Redirect to="/tabs/move" /></Route>
        <Route exact path="/tabs/history"><Redirect to="/tabs/move" /></Route>
        <Route exact path="/tabs"><Redirect to="/tabs/today" /></Route>
      </IonRouterOutlet>
      <IonTabBar slot="bottom" className="main-tab-bar">
        <IonTabButton tab="today" href="/tabs/today" onClick={() => startTabNavigation('/tabs/today')}><IonIcon icon={homeOutline} /><IonLabel>Today</IonLabel></IonTabButton>
        <IonTabButton tab="health" href="/tabs/health" onClick={() => startTabNavigation('/tabs/health')}><IonIcon icon={heartOutline} /><IonLabel>Health</IonLabel></IonTabButton>
        <IonTabButton tab="move" href="/tabs/move" onClick={() => startTabNavigation('/tabs/move')}><IonIcon icon={fitnessOutline} /><IonLabel>Move</IonLabel></IonTabButton>
        <IonTabButton tab="you" href="/tabs/you" onClick={() => startTabNavigation('/tabs/you')}><IonIcon icon={personCircleOutline} /><IonLabel>You</IonLabel></IonTabButton>
      </IonTabBar>
    </IonTabs>
  );
};

export default MainTabs;
