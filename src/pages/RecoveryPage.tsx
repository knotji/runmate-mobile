import { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonHeader,
  IonIcon,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  useIonViewDidLeave,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { shareSocialOutline } from 'ionicons/icons';
import { SocialShareModal } from '@/components/SocialShareModal';
import { buildRecoveryCoreContextFromSupabase, buildRecoveryPageContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { useHealthSyncStore } from '@/lib/health/healthSyncStore';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { TodayTrainingPlanCard } from '@/components/TodayTrainingPlanCard';
import { PageState } from '@/components/PageState';
import { RecoveryDials, RecoveryLoadingDials, RecoveryPlan, RecoverySecondaryError, RecoverySecondaryLoading } from '@/components/health/RecoveryDialsView';
import { loadTonightWakeOverride } from '@/lib/sleepWindow';
import { loadDefaultWakeTime, loadTonightWakePlan } from '@/lib/sleepWindowStorage';
import { describeTodayHealthSyncPerformance, syncTodayHealth } from '@/lib/healthSyncService';
import { refreshNotifications } from '@/lib/notificationService';
import { getBangkokDateKey } from '@/lib/date';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import {
  loadRecoveryContextStartupSnapshot,
  loadRecoveryStartupSnapshot,
  saveRecoveryContextStartupSnapshot,
  saveRecoveryStartupSnapshot,
} from '@/lib/recoveryStartupCache';
import './RecoveryPage.css';

const RecoveryPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [startupContext, setStartupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const [startupRecovery, setStartupRecovery] = useState<RunMateRecoverySystem | null>(() => startupContext?.recoverySystem ?? loadRecoveryStartupSnapshot());
  const [loading, setLoading] = useState(() => startupRecovery === null);
  const [loadingStage, setLoadingStage] = useState<'syncing' | 'calculating'>('syncing');
  const [error, setError] = useState<string | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(() => startupContext === null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [wakeOverrideMinutes, setWakeOverrideMinutes] = useState<number | null>(() => loadTonightWakeOverride());
  const loadedRef = useRef(false);
  const loadedDateRef = useRef<string | null>(null);
  const visibleRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const ownedHealthSyncRef = useRef(false);

  const loadSecondaryRecovery = useCallback(async (showPlaceholder = false, force = false) => {
    setSecondaryLoading(true);
    setSecondaryError(null);
    try {
      const nextContext = await measurePerformanceDiagnostic(
        'recovery_secondary',
        () => buildRecoveryPageContextFromSupabase({ force }),
        () => ({ detail: showPlaceholder ? 'Foreground guidance load' : 'Background guidance refresh' }),
      );
      setStartupContext(nextContext);
      saveRecoveryContextStartupSnapshot(nextContext);
      void refreshNotifications(nextContext, true).catch((notificationError) => console.warn('[notifications] refresh failed', notificationError));
    } catch (loadError) {
      console.error('[recovery] secondary load failed', loadError);
      setSecondaryError('Today\'s guidance is still loading. Your scores are already available.');
    } finally {
      setSecondaryLoading(false);
    }
  }, []);

  const loadRecoveryCore = useCallback(async (force = false) => {
    const nextContext = await measurePerformanceDiagnostic(
      'recovery_core',
      () => buildRecoveryCoreContextFromSupabase({ force }),
    );
    setStartupRecovery(nextContext.recoverySystem);
    saveRecoveryStartupSnapshot(nextContext.recoverySystem);
    loadedRef.current = true;
    loadedDateRef.current = getBangkokDateKey(Date.now());
    setLoading(false);
  }, []);

  const loadRecovery = useCallback(async (showSecondaryPlaceholder = false, force = false) => {
    setError(null);
    try {
      await loadRecoveryCore(force);
      await loadSecondaryRecovery(showSecondaryPlaceholder, force);
    } catch (loadError) {
      console.error('[recovery] load failed', loadError);
      setError('Unable to load your latest metrics. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [loadRecoveryCore, loadSecondaryRecovery]);

  useEffect(() => {
    return useHealthSyncStore.subscribe((state, previous) => {
      if (state.lastSyncedAt !== previous.lastSyncedAt && visibleRef.current) {
        if (ownedHealthSyncRef.current) return;
        const detail = state.lastSyncDetail as { changed?: unknown } | null;
        if (detail?.changed !== true) return;
        void loadRecovery(false, true);
      }
    });
  }, [loadRecovery]);

  const loadInitialRecovery = useCallback(async (forceContext = false) => {
    setLoading(startupRecovery === null);
    setLoadingStage('syncing');
    setError(null);
    ownedHealthSyncRef.current = true;
    const healthSyncPromise = measurePerformanceDiagnostic(
      'health_sync',
      () => syncTodayHealth(true),
      (syncResult) => describeTodayHealthSyncPerformance(syncResult),
    ).catch((syncError) => {
      console.warn('[health-sync] Today sync failed before Recovery load', syncError);
      return null;
    });

    // Health Connect can take several seconds on a cold Android start. Load the
    // account-backed dials and secondary guidance immediately so the page is
    // interactive in < 200ms while Health Connect sync completes in background.
    setLoadingStage('calculating');
    try {
      await loadRecoveryCore(forceContext);
      void loadSecondaryRecovery(forceContext, forceContext);
    } catch (loadError) {
      console.error('[recovery] initial core load failed', loadError);
      if (startupRecovery) {
        setSecondaryError('Unable to refresh right now. Showing today\'s latest saved scores.');
        setSecondaryLoading(false);
      } else {
        setError('Unable to load your latest metrics. Please try again.');
      }
      setLoading(false);
      return;
    }

    void healthSyncPromise.then((result) => {
      if (result?.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
      if (result?.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
      if (result?.changed && visibleRef.current) {
        return loadRecovery(false, true);
      }
      return undefined;
    }).finally(() => {
      ownedHealthSyncRef.current = false;
    });
  }, [loadRecoveryCore, loadSecondaryRecovery, startupRecovery, loadRecovery]);

  const retryRecovery = useCallback(async () => {
    await loadInitialRecovery(true);
  }, [loadInitialRecovery]);

  useIonViewWillEnter(() => {
    visibleRef.current = true;
    setWakeOverrideMinutes(loadTonightWakeOverride());
    void Promise.all([loadTonightWakePlan(), loadDefaultWakeTime()]).then(([plan, defaultWake]) => setWakeOverrideMinutes(plan.minutes ?? defaultWake));
    const today = getBangkokDateKey(Date.now());
    const needsFreshDay = loadedDateRef.current !== null && loadedDateRef.current !== today;
    if (!loadedRef.current || needsFreshDay) {
      void loadInitialRecovery(needsFreshDay);
    } else {
      syncTimerRef.current = window.setTimeout(() => {
        ownedHealthSyncRef.current = true;
        void measurePerformanceDiagnostic(
          'health_sync',
          () => syncTodayHealth(),
          (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Background check'),
        ).then((result) => {
          if (result.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
          if (result.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
          if (result.changed && visibleRef.current) return loadRecovery(false, true);
          return undefined;
        }).finally(() => { ownedHealthSyncRef.current = false; });
      }, 1200);
    }
  });

  useIonViewDidLeave(() => {
    visibleRef.current = false;
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  });

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    ownedHealthSyncRef.current = true;
    try {
      await measurePerformanceDiagnostic(
        'health_sync',
        () => syncTodayHealth(true),
        (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Pull to refresh'),
      );
      await loadRecovery(false, true);
    } finally {
      ownedHealthSyncRef.current = false;
      event.detail.complete();
    }
  };

  const [showShareModal, setShowShareModal] = useState(false);
  const visibleRecovery = context?.recoverySystem ?? startupRecovery;
  const visibleContext = secondaryLoading && startupContext ? startupContext : context ?? startupContext;

  return (
    <IonPage>
      <IonHeader translucent className="recovery-header">
        <IonToolbar>
          <IonTitle>Recovery</IonTitle>
          <IonButtons slot="end">
            <IonButton disabled={!visibleContext} onClick={() => setShowShareModal(true)} className="recovery-share-btn" aria-label="Share Story">
              <IonIcon icon={shareSocialOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="recovery-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" />
        </IonRefresher>
        <main className="recovery-shell metrics-only-shell">
          {loading && !visibleRecovery && <RecoveryLoadingDials stage={loadingStage} />}
          {!loading && error && !visibleRecovery && <PageState kind="error" title="Recovery Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void retryRecovery()} className="state-panel error-panel" />}
          {!error && visibleRecovery && (
            <>
              <RecoveryDials recovery={visibleRecovery} onRecoveryClick={() => history.push('/recovery-trends')} onSleepClick={() => history.push('/sleep')} />
              {secondaryLoading && !visibleContext ? <RecoverySecondaryLoading /> : secondaryError && !visibleContext ? <RecoverySecondaryError message={secondaryError} onRetry={() => void loadSecondaryRecovery(true)} /> : !visibleContext ? <RecoverySecondaryLoading /> : <>
                <TodayTrainingPlanCard context={visibleContext} />
                <RecoveryPlan recovery={visibleRecovery} wakeOverrideMinutes={wakeOverrideMinutes} onOpen={() => history.push('/sleep-window')} />
              </>}
            </>
          )}
        </main>

        <SocialShareModal
          isOpen={showShareModal}
          onDismiss={() => setShowShareModal(false)}
          context={visibleContext}
        />
      </IonContent>
    </IonPage>
  );
};

export default RecoveryPage;
