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
import { addOutline, shareSocialOutline, sparklesOutline } from 'ionicons/icons';
import { SocialShareModal } from '@/components/SocialShareModal';
import { buildRecoveryCoreContextFromSupabase, buildRecoveryPageContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { useHealthSyncStore } from '@/lib/health/healthSyncStore';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import { buildRecoveryWhy } from '@/lib/recoveryWhy';
import { buildRecoveryExplainability } from '@/lib/recoveryExplainability';
import { buildDailyRecommendation } from '@/lib/dailyRecommendation';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { buildTodayBrief, buildTodayReadiness } from '@/lib/todayBrief';
import { buildTodayContinuity } from '@/lib/todayContinuity';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import { PageState } from '@/components/PageState';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import {
  RecoveryLoadingDials,
  RecoverySecondaryError,
  RecoverySecondaryLoading,
  TodayActionCard,
  TodayContinuityCard,
  TodayHero,
  TodayRingsRow,
  TodayWhyCard,
} from '@/components/health/RecoveryDialsView';
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
import { usePrimaryTabScroll } from '@/lib/usePrimaryTabScroll';
import './RecoveryPage.css';

const RecoveryPage: React.FC = () => {
  const history = useHistory();
  const contentRef = usePrimaryTabScroll('today');
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

  // "Recovery Why", "Yesterday → Today", and the Today hero/action cards —
  // all pure UI-shaping adapters over already-computed deterministic output
  // (recoveryWhy.ts, todayContinuity.ts, todayBrief.ts). No new data fetch,
  // no new decision.
  const recoveryWhy = visibleRecovery ? buildRecoveryWhy(visibleRecovery) : null;
  // The hero card needs only Recovery (not the rest of CoachContext), so it
  // can render as soon as visibleRecovery is ready, alongside the rings row -
  // dailyAction sharpens the same thresholds once daily recommendation below
  // resolves, it never changes them.
  const heroReadiness = visibleRecovery ? buildTodayReadiness(visibleRecovery, null) : null;
  const plannedToday = visibleContext ? getTodayPlannedWorkout(visibleContext) : null;
  const explainabilityToday = visibleRecovery ? buildRecoveryExplainability(visibleRecovery) : null;
  const dailyRecommendationToday = visibleContext && explainabilityToday
    ? buildDailyRecommendation(visibleContext, explainabilityToday, plannedToday)
    : null;
  const todayContinuity = visibleContext && dailyRecommendationToday
    ? buildTodayContinuity(visibleContext, dailyRecommendationToday)
    : null;
  const planStatusToday = visibleContext && plannedToday ? getTodayTrainingPlanStatus(visibleContext, plannedToday) : null;
  const recommendationToday = visibleContext ? buildAdaptiveTrainingRecommendation(visibleContext, plannedToday) : null;
  const briefToday = visibleContext
    ? buildTodayBrief(visibleContext, {
      planned: plannedToday,
      recommendation: recommendationToday,
      planStatus: planStatusToday,
      dailyAction: dailyRecommendationToday?.status === 'ready' ? dailyRecommendationToday.action : null,
    })
    : null;

  return (
    <IonPage>
      <IonHeader translucent className="recovery-header">
        <IonToolbar>
          <IonTitle>Today</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={() => history.push('/tabs/log')} className="recovery-share-btn" aria-label="Log Health Data">
              <IonIcon icon={addOutline} />
            </IonButton>
            <IonButton disabled={!visibleContext} onClick={() => setShowShareModal(true)} className="recovery-share-btn" aria-label="Share Story">
              <IonIcon icon={shareSocialOutline} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} fullscreen className="recovery-content">
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
          {visibleRecovery && heroReadiness && (
            <>
              {dataStatus === 'fallback' && <DataFreshnessStatus
                status={dataStatus}
                label={dataStatusCopy.label}
                detail={dataStatusCopy.detail}
                onRetry={() => void retryRecovery()}
                variant="panel"
                className="recovery-freshness-status"
              />}
              {/* Level 1 — body status hero (readiness sharpens once briefToday resolves, same underlying thresholds) */}
              <TodayHero
                readiness={briefToday?.readiness ?? heroReadiness}
                freshness={dataStatus !== 'fallback' ? { status: dataStatus, detail: dataStatusCopy.detail } : undefined}
                onFreshnessClick={() => void retryRecovery()}
              />
              {/* Level 1b — the one 4-ring row */}
              <TodayRingsRow
                recovery={visibleRecovery}
                energy={visibleEnergy}
                onRecoveryClick={() => history.push('/recovery-trends', { from: '/tabs/today' })}
                onSleepClick={() => history.push('/sleep')}
                onStrainClick={() => history.push('/strain', { from: '/tabs/today' })}
                onEnergyClick={() => history.push('/energy', { from: '/tabs/today' })}
              />
              {secondaryLoading && !visibleContext ? <RecoverySecondaryLoading /> : secondaryError && !visibleContext ? <RecoverySecondaryError message={secondaryError} onRetry={() => void loadSecondaryRecovery(true)} /> : !visibleContext || !briefToday ? <RecoverySecondaryLoading /> : <>
                {/* Level 2 — WHY */}
                <TodayWhyCard limiter={briefToday.limiter} why={recoveryWhy ?? undefined} />
                {/* Optional — Yesterday → Today */}
                {todayContinuity && <TodayContinuityCard continuity={todayContinuity} />}
                {/* Level 3 — One Useful Move — end of Today's hierarchy */}
                <TodayActionCard action={briefToday.action} />
              </>}
            </>
          )}
        </main>

        <SocialShareModal
          isOpen={showShareModal}
          onDismiss={() => setShowShareModal(false)}
          context={visibleContext}
          energyReserve={visibleEnergy}
          mode="today"
        />

        {visibleContext && (
          <button
            type="button"
            className="today-coach-fab"
            aria-label="Ask Coach About Today"
            onClick={() => history.push('/ai-coach', { from: '/tabs/today', initialTopic: 'today' })}
          >
            <IonIcon icon={sparklesOutline} aria-hidden="true" />
          </button>
        )}
      </IonContent>
    </IonPage>
  );
};

export default RecoveryPage;
