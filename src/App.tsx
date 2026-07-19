import { useEffect, useState } from 'react';
import { App as CapacitorApp, type URLOpenListenerEvent } from '@capacitor/app';
import { Browser } from '@capacitor/browser';
import { Capacitor, type PluginListenerHandle } from '@capacitor/core';
import type { Session } from '@supabase/supabase-js';
import { Redirect, Route } from 'react-router-dom';
import { IonApp, IonLoading, IonRouterOutlet, setupIonicReact } from '@ionic/react';
import { IonReactRouter } from '@ionic/react-router';
import { supabase } from '@/lib/supabaseClient';
import { completeNativeGoogleSignIn } from '@/lib/googleAuth';
import LoginPage from '@/pages/LoginPage';
import SleepDetailPage from '@/pages/SleepDetailPage';
import MainTabs from '@/components/MainTabs';
import WorkoutDetailPage from '@/pages/WorkoutDetailPage';
import MealDetailPage from '@/pages/MealDetailPage';
import HealthDetailPage from '@/pages/HealthDetailPage';
import RaceGoalPage from '@/pages/RaceGoalPage';
import HealthTestPage from '@/pages/HealthTestPage';
import SleepWindowPage from '@/pages/SleepWindowPage';
import WeeklySummaryPage from '@/pages/WeeklySummaryPage';

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

const App: React.FC = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCheckingSession(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setCheckingSession(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

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
            <Route exact path="/activity/workout/:id">
              {session ? <WorkoutDetailPage /> : <Redirect to="/login" />}
            </Route>
            <Route exact path="/activity/meal/:id">{session ? <MealDetailPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/activity/health/:id">{session ? <HealthDetailPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/race-goal">{session ? <RaceGoalPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/health-connect">{session ? <HealthTestPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/weekly-summary">{session ? <WeeklySummaryPage /> : <Redirect to="/login" />}</Route>
            <Route exact path="/health-test"><Redirect to="/health-connect" /></Route>
            <Route exact path="/history/workout/:id"><Redirect to="/tabs/activity" /></Route>
            <Route exact path="/">
              <Redirect to={session ? '/tabs/recovery' : '/login'} />
            </Route>
          </IonRouterOutlet>
        </IonReactRouter>
      )}
    </IonApp>
  );
};

export default App;
