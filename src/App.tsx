import { lazy, Suspense, useEffect, useState } from 'react';
import { App as CapacitorApp, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { supabase } from '@/lib/supabaseClient';
import { completeNativeGoogleSignIn } from '@/lib/googleAuth';
import { LocalNotifications } from '@capacitor/local-notifications';
import { refreshNotifications } from '@/lib/notificationService';
import { invalidateCoachContextCache } from '@/lib/coachContextService';
import { clearAiCoachAnswerCache } from '@/lib/aiCoach';
import { reportCrash } from '@/lib/crashReporting';
import { syncTodayHealth } from '@/lib/healthSyncService';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { AppBootScreen } from '@/components/AppBootScreen';
import { RouteLoadingScreen } from '@/components/RouteLoadingScreen';
import { NetworkStatusToast } from '@/components/NetworkStatusToast';
import { loadMorePage } from '@/lib/morePageLoaders';
import { notificationRouteFromUrl } from '@/lib/nativeNavigation';
import { clearRecoveryStartupSnapshot } from '@/lib/recoveryStartupCache';

import '@ionic/react/css/core.css';
import '@ionic/react/css/normalize.css';
import '@ionic/react/css/structure.css';
import '@ionic/react/css/typography.css';
import '@ionic/react/css/padding.css';
import '@ionic/react/css/float-elements.css';
import '@ionic/react/css/text-alignment.css';
import '@ionic/react/css/text-transformation.css';
import '@ionic/react/css/flex-utils.css';
import '@ionic/react/css/display.css';
import './theme/variables.css';

setupIonicReact();

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const MainTabs = lazy(() => import('@/components/MainTabs'));
const SleepDetailPage = lazy(() => import('@/pages/SleepDetailPage'));
const WorkoutDetailPage = lazy(() => import('@/pages/WorkoutDetailPage'));
const MealDetailPage = lazy(() => import('@/pages/MealDetailPage'));
const HealthDetailPage = lazy(() => import('@/pages/HealthDetailPage'));
const RaceGoalPage = lazy(() => loadMorePage('/race-goal'));
const HealthTestPage = lazy(() => loadMorePage('/health-connect'));
const SleepWindowPage = lazy(() => import('@/pages/SleepWindowPage'));
const WeeklySummaryPage = lazy(() => loadMorePage('/weekly-summary'));
const ProfileSettingsPage = lazy(() => loadMorePage('/profile-settings'));
const NotificationsPage = lazy(() => loadMorePage('/notifications'));
const RecoveryTrendsPage = lazy(() => import('@/pages/RecoveryTrendsPage'));
const AiCoachPage = lazy(() => loadMorePage('/ai-coach'));
const NutritionTrendsPage = lazy(() => import('@/pages/NutritionTrendsPage'));
const PrivacyDataPage = lazy(() => loadMorePage('/privacy-data'));

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // React error boundaries only catch render-phase errors. Most real
    // failures in this app happen in async code (Supabase calls, native
    // plugin calls) or event handlers, so report those to Crashlytics too.
    const handleError = (event: ErrorEvent) => {
      void reportCrash(event.error instanceof Error ? event.error : new Error(event.message), 'Unhandled window error');
    };
    const handleRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      void reportCrash(reason instanceof Error ? reason : new Error(String(reason)), 'Unhandled promise rejection');
    };
    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleRejection);
    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
    };
  }, []);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      invalidateCoachContextCache();
      clearAiCoachAnswerCache();
      if (_event === 'SIGNED_OUT') clearRecoveryStartupSnapshot();
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!session || !Capacitor.isNativePlatform()) return;
    const refreshTimer = window.setTimeout(() => {
      void refreshNotifications().catch((error) => console.warn('[notifications] refresh failed', error));
    }, 2500);
    let listener: PluginListenerHandle | null = null;
    let stateListener: PluginListenerHandle | null = null;
    void LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
      const route = action.notification.extra?.route;
      if (typeof route === 'string' && route.startsWith('/')) window.location.assign(route);
    }).then((handle) => { listener = handle; });
    void CapacitorApp.addListener('appStateChange', ({ isActive }) => {
      if (isActive) {
        void refreshNotifications().catch((error) => console.warn('[notifications] resume refresh failed', error));
        void syncTodayHealth(true).then((result) => {
          if (result.changed) {
            invalidateCoachContextCache();
            window.dispatchEvent(new CustomEvent('runmate:health-synced'));
          }
        }).catch((syncError) => console.warn('[health-sync] resume sync failed', syncError));
      }
    }).then((handle) => { stateListener = handle; });
    return () => { window.clearTimeout(refreshTimer); void listener?.remove(); void stateListener?.remove(); };
  }, [session]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener: PluginListenerHandle | null = null;
    const handleOpenUrl = async ({ url }: URLOpenListenerEvent) => {
      try {
        const notificationRoute = notificationRouteFromUrl(url);
        if (notificationRoute) {
          window.location.assign(notificationRoute);
          return;
        }
        const completed = await completeNativeGoogleSignIn(url);
        if (completed) await Browser.close();
      } catch (authError) {
        console.error('[auth] native Google callback failed', authError);
        await Browser.close().catch(() => undefined);
      }
    };
    void CapacitorApp.addListener('appUrlOpen', handleOpenUrl).then((handle) => { listener = handle; });
    void CapacitorApp.getLaunchUrl().then((result) => {
      if (result?.url) void handleOpenUrl({ url: result.url });
    });
    return () => { void listener?.remove(); };
  }, []);

  return (
    <IonApp>
      <AppErrorBoundary>
      <NetworkStatusToast />
      {checkingSession && <AppBootScreen message="Checking Your Account" />}
      {!checkingSession && (
        <IonReactRouter>
          <Suspense fallback={<RouteLoadingScreen />}>
            {/* The root outlet swaps the complete tab shell for standalone pages.
                Animating that swap also moves/resizes the tab bar, which causes a
                visible jump when opening or closing a detail page. */}
            <IonRouterOutlet animated={false}>
            <Route exact path="/login">
              {session ? <Redirect to="/tabs/recovery" /> : <LoginPage />}
            </Route>
            <Route path="/tabs">
              {session ? <MainTabs /> : <Redirect to="/login" />}
            </Route>
            <Route exact path="/recovery"><Redirect to="/tabs/recovery" /></Route>
            <Route exact path="/sleep">
              {session ? <SleepDetailPage /> : <Redirect to="/login" />}
            </Route>
            <Route exact path="/sleep-window">{session ? <SleepWindowPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/recovery-trends">{session ? <RecoveryTrendsPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/activity/workout/:id">
              {session ? <WorkoutDetailPage /> : <Redirect to="/login" />}
            </Route>
            <Route exact path="/activity/meal/:id">{session ? <MealDetailPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/activity/health/:id">{session ? <HealthDetailPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/race-goal">{session ? <RaceGoalPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/health-connect">{session ? <HealthTestPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/weekly-summary">{session ? <WeeklySummaryPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/profile-settings">{session ? <ProfileSettingsPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/notifications">{session ? <NotificationsPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/ai-coach">{session ? <AiCoachPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/nutrition-trends">{session ? <NutritionTrendsPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/privacy-data">{session ? <PrivacyDataPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/health-test"><Redirect to="/health-connect" /></Route>
            <Route exact path="/history/workout/:id"><Redirect to="/tabs/activity" /></Route>
            <Route exact path="/">
              <Redirect to={session ? '/tabs/recovery' : '/login'} />
            </Route>
            </IonRouterOutlet>
          </Suspense>
        </IonReactRouter>
      )}
      </AppErrorBoundary>
    </IonApp>
  );
};

export default App;
