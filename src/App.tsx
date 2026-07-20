import { lazy, Suspense, useEffect, useState } from 'react';
import { App as CapacitorApp, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonLoading, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { supabase } from '@/lib/supabaseClient';
import { completeNativeGoogleSignIn } from '@/lib/googleAuth';
import { LocalNotifications } from '@capacitor/local-notifications';
import { refreshNotifications } from '@/lib/notificationService';
import { invalidateCoachContextCache } from '@/lib/buildCoachContext';

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
const RaceGoalPage = lazy(() => import('@/pages/RaceGoalPage'));
const HealthTestPage = lazy(() => import('@/pages/HealthTestPage'));
const SleepWindowPage = lazy(() => import('@/pages/SleepWindowPage'));
const WeeklySummaryPage = lazy(() => import('@/pages/WeeklySummaryPage'));
const ProfileSettingsPage = lazy(() => import('@/pages/ProfileSettingsPage'));
const NotificationsPage = lazy(() => import('@/pages/NotificationsPage'));
const RecoveryTrendsPage = lazy(() => import('@/pages/RecoveryTrendsPage'));

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      invalidateCoachContextCache();
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
      if (isActive) void refreshNotifications().catch((error) => console.warn('[notifications] resume refresh failed', error));
    }).then((handle) => { stateListener = handle; });
    return () => { window.clearTimeout(refreshTimer); void listener?.remove(); void stateListener?.remove(); };
  }, [session]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let listener: PluginListenerHandle | null = null;
    const handleOpenUrl = async ({ url }: URLOpenListenerEvent) => {
      try {
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
      <IonLoading isOpen={checkingSession} message="Checking your account…" />
      {!checkingSession && (
        <IonReactRouter>
          <Suspense fallback={<IonLoading isOpen message="Loading RunMate..." />}>
            <IonRouterOutlet>
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
            <Route exact path="/health-test"><Redirect to="/health-connect" /></Route>
            <Route exact path="/history/workout/:id"><Redirect to="/tabs/activity" /></Route>
            <Route exact path="/">
              <Redirect to={session ? '/tabs/recovery' : '/login'} />
            </Route>
            </IonRouterOutlet>
          </Suspense>
        </IonReactRouter>
      )}
    </IonApp>
  );
};

export default App;
