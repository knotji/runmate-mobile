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
import { addOutline, shareSocialOutline } from 'ionicons/icons';
import { SocialShareModal } from '@/components/SocialShareModal';
import { buildRecoveryCoreContextFromSupabase, buildRecoveryPageContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { useHealthSyncStore } from '@/lib/health/healthSyncStore';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { TodayTrainingPlanCard } from '@/components/TodayTrainingPlanCard';
import { EnergyReserveCard } from '@/components/EnergyReserveCard';
import { PageState } from '@/components/PageState';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import { RecoveryDials, RecoveryLoadingDials, RecoveryPlan, RecoverySecondaryError, RecoverySecondaryLoading } from '@/components/health/RecoveryDialsView';
import { loadTonightSleepCycleOverride, loadTonightWakeOverride, type SleepCycleCount } from '@/lib/sleepWindow';
import { loadDefaultWakeTime, loadTonightWakePlan } from '@/lib/sleepWindowStorage';
import { describeTodayHealthSyncPerformance, syncTodayHealth } from '@/lib/healthSyncService';
import { refreshNotifications } from '@/lib/notificationService';
import { getBangkokDateKey } from '@/lib/date';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import {
  loadRecoveryContextStartupSnapshot,
  loadRecoveryStartupEntry,
  saveRecoveryContextStartupSnapshot,
  saveRecoveryStartupSnapshot,
} from '@/lib/recoveryStartupCache';
import { recoveryDataStatusCopy, resolveRecoveryDataStatus } from '@/lib/recoveryDataFreshness';
import { healthDataErrorCopy, isHealthConnectPermissionError } from '@/lib/dataLoadState';
import { buildEnergyReserve } from '@/lib/energyReserve';
import { loadDailyStrainCheckIn } from '@/lib/strainContext';
import './RecoveryPage.css';

const RecoveryPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [initialRecoveryEntry] = useState(() => loadRecoveryStartupEntry());
  const [startupContext, setStartupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const [startupRecovery, setStartupRecovery] = useState<RunMateRecoverySystem | null>(() => startupContext?.recoverySystem ?? initialRecoveryEntry?.recovery ?? null);
  const [loading, setLoading] = useState(() => startupRecovery === null);
  const [loadingStage, setLoadingStage] = useState<'syncing' | 'calculating'>('syncing');
  const [error, setError] = useState<string | null>(null);
  const [secondaryLoading, setSecondaryLoading] = useState(() => startupContext === null);
  const [secondaryError, setSecondaryError] = useState<string | null>(null);
  const [lastSuccessfulAt, setLastSuccessfulAt] = useState<string | null>(() => initialRecoveryEntry?.savedAt ?? null);
  const [refreshingData, setRefreshingData] = useState(() => startupRecovery !== null);
  const [refreshFailed, setRefreshFailed] = useState(false);
  const [freshnessNow, setFreshnessNow] = useState(() => Date.now());
  const [wakeOverrideMinutes, setWakeOverrideMinutes] = useState<number | null>(() => loadTonightWakeOverride());
  const [sleepCycleOverride, setSleepCycleOverride] = useState<SleepCycleCount | null>(() => loadTonightSleepCycleOverride());
  const energyDate = context?.todayDate ?? startupContext?.todayDate ?? getBangkokDateKey(Date.now());
  const [energyCheckIn, setEnergyCheckIn] = useState(() => loadDailyStrainCheckIn(energyDate));
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
    const savedAt = new Date().toISOString();
    setStartupRecovery(nextContext.recoverySystem);
    saveRecoveryStartupSnapshot(nextContext.recoverySystem, savedAt);
    setLastSuccessfulAt(savedAt);
    loadedRef.current = true;
    loadedDateRef.current = getBangkokDateKey(Date.now());
    setLoading(false);
  }, []);

  const loadRecovery = useCallback(async (showSecondaryPlaceholder = false, force = false) => {
    setError(null);
    try {
      await loadRecoveryCore(force);
      await loadSecondaryRecovery(showSecondaryPlaceholder, force);
      setRefreshFailed(false);
    } catch (loadError) {
      console.error('[recovery] load failed', loadError);
      setRefreshFailed(true);
    } finally {
      setLoading(false);
    }
  }, [loadRecoveryCore, loadSecondaryRecovery]);

  useEffect(() => {
    const freshnessTimer = window.setInterval(() => setFreshnessNow(Date.now()), 60_000);
    const syncSleepPlan = () => {
      setWakeOverrideMinutes(loadTonightWakeOverride());
      setSleepCycleOverride(loadTonightSleepCycleOverride());
    };
    window.addEventListener('runmate:sleep-window-updated', syncSleepPlan);
    const unsubscribe = useHealthSyncStore.subscribe((state, previous) => {
      if (state.lastSyncedAt !== previous.lastSyncedAt && visibleRef.current) {
        if (ownedHealthSyncRef.current) return;
        const detail = state.lastSyncDetail as { changed?: unknown } | null;
        if (detail?.changed !== true) return;
        setRefreshingData(true);
        void loadRecovery(false, true).finally(() => setRefreshingData(false));
      }
    });
    return () => {
      window.clearInterval(freshnessTimer);
      window.removeEventListener('runmate:sleep-window-updated', syncSleepPlan);
      unsubscribe();
    };
  }, [loadRecovery]);

  useEffect(() => {
    const updateEnergyContext = () => setEnergyCheckIn(loadDailyStrainCheckIn(energyDate));
    updateEnergyContext();
    window.addEventListener('runmate:strain-check-in-updated', updateEnergyContext);
    return () => window.removeEventListener('runmate:strain-check-in-updated', updateEnergyContext);
  }, [energyDate]);

  const loadInitialRecovery = useCallback(async (forceContext = false) => {
    setLoading(startupRecovery === null);
    setLoadingStage('syncing');
    setError(null);
    setRefreshingData(startupRecovery !== null);
    setRefreshFailed(false);
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
        setRefreshFailed(true);
        setRefreshingData(false);
        setSecondaryError('Unable to refresh right now. Showing today\'s latest saved scores.');
        setSecondaryLoading(false);
      } else {
        setError('Unable to load your latest metrics. Please try again.');
      }
      setLoading(false);
      return;
    }

    void healthSyncPromise.then(async (result) => {
      if (!result) {
        setRefreshFailed(true);
        return undefined;
      }
      if (result?.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
      if (result?.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
      const hasSyncError = Boolean(result.sleep?.error || result.workout?.error);
      if (result?.changed && visibleRef.current) {
        await loadRecovery(false, true);
      }
      setRefreshFailed(hasSyncError);
      return undefined;
    }).finally(() => {
      ownedHealthSyncRef.current = false;
      setRefreshingData(false);
    });
  }, [loadRecoveryCore, loadSecondaryRecovery, startupRecovery, loadRecovery]);

  const retryRecovery = useCallback(async () => {
    await loadInitialRecovery(true);
  }, [loadInitialRecovery]);

  useIonViewWillEnter(() => {
    visibleRef.current = true;
    setWakeOverrideMinutes(loadTonightWakeOverride());
    setSleepCycleOverride(loadTonightSleepCycleOverride());
    void Promise.all([loadTonightWakePlan(), loadDefaultWakeTime()]).then(([plan, defaultWake]) => setWakeOverrideMinutes(plan.minutes ?? defaultWake));
    const today = getBangkokDateKey(Date.now());
    const needsFreshDay = loadedDateRef.current !== null && loadedDateRef.current !== today;
    if (!loadedRef.current || needsFreshDay) {
      void loadInitialRecovery(needsFreshDay);
    } else {
      syncTimerRef.current = window.setTimeout(() => {
        ownedHealthSyncRef.current = true;
        setRefreshingData(true);
        setRefreshFailed(false);
        void measurePerformanceDiagnostic(
          'health_sync',
          () => syncTodayHealth(),
          (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Background check'),
        ).then(async (result) => {
          if (result.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
          if (result.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
          const hasSyncError = Boolean(result.sleep?.error || result.workout?.error);
          if (result.changed && visibleRef.current) await loadRecovery(false, true);
          setRefreshFailed(hasSyncError);
          return undefined;
        }).catch((syncError) => {
          console.warn('[health-sync] Background Recovery check failed', syncError);
          setRefreshFailed(true);
        }).finally(() => {
          ownedHealthSyncRef.current = false;
          setRefreshingData(false);
        });
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
    setRefreshingData(true);
    setRefreshFailed(false);
    try {
      await measurePerformanceDiagnostic(
        'health_sync',
        () => syncTodayHealth(true),
        (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Pull to refresh'),
      );
      await loadRecovery(false, true);
    } catch (refreshError) {
      console.warn('[recovery] Pull to refresh failed', refreshError);
      setRefreshFailed(true);
    } finally {
      ownedHealthSyncRef.current = false;
      setRefreshingData(false);
      event.detail.complete();
    }
  };

  const [showShareModal, setShowShareModal] = useState(false);
  const visibleRecovery = context?.recoverySystem ?? startupRecovery;
  const visibleContext = secondaryLoading && startupContext ? startupContext : context ?? startupContext;
  const visibleEnergy = visibleRecovery ? buildEnergyReserve({
    recovery: visibleRecovery,
    checkIn: energyCheckIn,
    activePain: visibleContext?.activePain ?? false,
    activeSick: visibleContext?.activeSick ?? false,
  }) : null;
  const dataStatus = resolveRecoveryDataStatus({ savedAt: lastSuccessfulAt, refreshing: refreshingData, refreshFailed, now: freshnessNow });
  const dataStatusCopy = recoveryDataStatusCopy(dataStatus, lastSuccessfulAt);
  const loadErrorCopy = healthDataErrorCopy(error, 'Recovery Is Unavailable');

  return (
    <IonPage>
      <IonHeader translucent className="recovery-header">
        <IonToolbar>
          <IonTitle>Today</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/tabs/upload')} className="recovery-share-btn" aria-label="Log Health Data">
              <IonIcon icon={addOutline} />
            </IonButton>
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
          {!loading && error && !visibleRecovery && <PageState
            kind="error"
            title={loadErrorCopy.title}
            detail={loadErrorCopy.detail}
            actionLabel={loadErrorCopy.actionLabel}
            onAction={() => isHealthConnectPermissionError(error) ? history.push('/health-connect') : void retryRecovery()}
            className="state-panel error-panel"
          />}
          {visibleRecovery && (
            <>
              {dataStatus === 'fallback' && <DataFreshnessStatus
                status={dataStatus}
                label={dataStatusCopy.label}
                detail={dataStatusCopy.detail}
                onRetry={() => void retryRecovery()}
                variant="panel"
                className="recovery-freshness-status"
              />}
              <RecoveryDials
                recovery={visibleRecovery}
                onRecoveryClick={() => history.push('/recovery-trends')}
                onSleepClick={() => history.push('/sleep')}
                onStrainClick={() => history.push('/strain')}
                freshness={dataStatus !== 'fallback' ? { status: dataStatus, detail: dataStatusCopy.detail } : undefined}
                onFreshnessClick={() => void retryRecovery()}
              />
              {visibleEnergy && <EnergyReserveCard energy={visibleEnergy} onOpen={() => history.push('/energy')} />}
              {secondaryLoading && !visibleContext ? <RecoverySecondaryLoading /> : secondaryError && !visibleContext ? <RecoverySecondaryError message={secondaryError} onRetry={() => void loadSecondaryRecovery(true)} /> : !visibleContext ? <RecoverySecondaryLoading /> : <>
                <TodayTrainingPlanCard context={visibleContext} />
                <RecoveryPlan recovery={visibleRecovery} wakeOverrideMinutes={wakeOverrideMinutes} sleepCycleOverride={sleepCycleOverride} onOpen={() => history.push('/sleep-window')} />
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
