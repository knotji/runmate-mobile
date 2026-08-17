import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonAlert,
  IonDatetime,
  IonHeader,
  IonIcon,
  IonButton,
  IonButtons,
  IonModal,
  IonPage,
  IonRefresher,
  IonRefresherContent,
  IonSpinner,
  IonTitle,
  IonToolbar,
  useIonViewDidLeave,
  useIonViewWillEnter,
  type RefresherEventDetail,
} from '@ionic/react';
import { addOutline, barbellOutline, bicycleOutline, calendarClearOutline, chevronBackOutline, chevronDownOutline, chevronForwardOutline, fitnessOutline, flagOutline, moonOutline, restaurantOutline, sparklesOutline, statsChartOutline, walkOutline } from 'ionicons/icons';
import { deleteHistoryItem, hideImportedHistoryItem, loadHistoryItems } from '@/lib/cloudHistory';
import { deleteMealNutritionRecord } from '@/lib/nutritionSync';
import { getHistoryItemDateKey, todayBangkokDateKey } from '@/lib/date';
import { isHealthConnectImportedItem, type LocalHistoryItem } from '@/lib/localHistory';
import { describeTodayHealthSyncPerformance, syncTodayHealth } from '@/lib/healthSyncService';
import { buildDailyNutritionSummary } from '@/lib/activityNutritionSummary';
import { activityHistoryItemsMatch, activityRecentHistoryOptions, mergeActivityHistoryItems, prepareActivityHistoryItems, sortHistoryItemsByEventTimeDesc, uploadedActivityDateFromEvent } from '@/lib/activityHistoryLoad';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { ActivityHistoryRow } from '@/components/ActivityHistoryRow';
import { describeHistoryItem, groupActivityRecords, type ActivityRecordGroupKey } from '@/lib/activityHistoryPresentation';
import { measurePerformanceDiagnostic, recordPerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { useHealthSyncStore } from '@/lib/health/healthSyncStore';
import { loadActivityStartupSnapshot, saveActivityStartupSnapshot } from '@/lib/activityStartupCache';
import { buildDailyFuelCoach, type DailyFuelCoach } from '@/lib/dailyFuelCoach';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { useUserProfileStore } from '@/lib/profile/userProfileStore';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import { useRacePlanStore } from '@/lib/race/racePlanStore';
import { formatRaceWorkoutMetric } from '@/lib/mobileRaceGoal';
import { getPlannedWorkoutForDateWithRaceDay, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import { loadMoveSelectedDate, saveMoveSelectedDate } from '@/lib/primaryTabState';
import { usePrimaryTabScroll } from '@/lib/usePrimaryTabScroll';
import type { WeekWorkout } from '@/types/race';
import './ActivityPage.css';

const ActivityPage: React.FC = () => {
  const history = useHistory();
  const todayDate = todayBangkokDateKey();
  const contentRef = usePrimaryTabScroll('move');
  const [startupItems] = useState(() => loadActivityStartupSnapshot());
  const profile = useUserProfileStore((state) => state.profile);
  const racePlan = useRacePlanStore((state) => state.plan);
  const raceGoal = useRacePlanStore((state) => state.goal);
  const [items, setItems] = useState<LocalHistoryItem[]>(() => startupItems ?? []);
  const [selectedDate, setSelectedDate] = useState(() => loadMoveSelectedDate(todayDate));
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => startupItems === null);
  const [error, setError] = useState<string | null>(null);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [fuelContextLoading, setFuelContextLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<LocalHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [expandedRecordGroups, setExpandedRecordGroups] = useState<Set<ActivityRecordGroupKey>>(() => new Set());
  const loadedRef = useRef(startupItems !== null);
  const startupCacheUsedRef = useRef(startupItems !== null);
  const recentLoadingRef = useRef<Promise<void> | null>(null);
  const archiveLoadedRef = useRef(false);
  const archiveLoadingRef = useRef(false);
  const visibleRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const cloudDataDirtyRef = useRef(false);

  useEffect(() => { setExpandedRecordGroups(new Set()); }, [selectedDate]);
  useEffect(() => { saveMoveSelectedDate(selectedDate, todayDate); }, [selectedDate, todayDate]);

  useEffect(() => {
    let active = true;
    const profileState = useUserProfileStore.getState();
    const racePlanState = useRacePlanStore.getState();
    const contextLoads: Promise<unknown>[] = [];
    if (!profileState.lastUpdatedAt) contextLoads.push(loadProfileFromSupabase());
    if (!racePlanState.lastUpdatedAt) contextLoads.push(loadActiveRaceGoalAndPlan());
    void Promise.all(contextLoads).finally(() => {
      if (active) setFuelContextLoading(false);
    });
    return () => { active = false; };
  }, []);

  const loadRecent = useCallback(() => {
    if (recentLoadingRef.current) return recentLoadingRef.current;
    setError(null);
    recentLoadingRef.current = (async () => {
      const result = await measurePerformanceDiagnostic(
        'activity_records',
        async () => {
          const historyResult = await loadHistoryItems(undefined, activityRecentHistoryOptions());
          if (!historyResult.ok) return historyResult;
          return { ...historyResult, items: prepareActivityHistoryItems(historyResult.items) };
        },
        (historyResult) => ({ detail: historyResult.ok ? `${historyResult.items.length} recent records prepared` : 'Activity query failed' }),
      );
      if (result.ok) {
        setRefreshError(null);
        setItems((current) => {
          const next = mergeActivityHistoryItems(current, result.items);
          if (activityHistoryItemsMatch(current, next)) return current;
          saveActivityStartupSnapshot(next);
          return next;
        });
        loadedRef.current = true;
        startupCacheUsedRef.current = false;
      }
      else if (loadedRef.current) setRefreshError(result.error);
      else setError(result.error);
      setLoading(false);
    })().finally(() => { recentLoadingRef.current = null; });
    return recentLoadingRef.current;
  }, []);

  const loadArchive = useCallback(async () => {
    if (archiveLoadedRef.current || archiveLoadingRef.current) return;
    archiveLoadingRef.current = true;
    setArchiveLoading(true);
    setArchiveError(null);
    try {
      const result = await measurePerformanceDiagnostic(
        'activity_archive',
        async () => {
          const historyResult = await loadHistoryItems();
          return historyResult.ok ? { ...historyResult, items: prepareActivityHistoryItems(historyResult.items) } : historyResult;
        },
        (historyResult) => ({ detail: historyResult.ok ? `${historyResult.items.length} archive records prepared` : 'Archive query failed' }),
      );
      if (result.ok) {
        setItems(result.items);
        archiveLoadedRef.current = true;
      } else {
        setArchiveError('Older Activity dates could not be loaded. Please try again.');
      }
    } catch {
      setArchiveError('Older Activity dates could not be loaded. Please try again.');
    } finally {
      archiveLoadingRef.current = false;
      setArchiveLoading(false);
    }
  }, []);

  useEffect(() => {
    const markCloudDataDirty = (event: Event) => {
      cloudDataDirtyRef.current = true;
      const uploadedDate = uploadedActivityDateFromEvent(event);
      if (uploadedDate) setSelectedDate(uploadedDate);
    };
    window.addEventListener('runmate:cloud-data-updated', markCloudDataDirty);
    const unsubscribeHealthSync = useHealthSyncStore.subscribe((state, previous) => {
      if (state.lastSyncedAt !== previous.lastSyncedAt && visibleRef.current) {
        const detail = state.lastSyncDetail as { changed?: unknown } | null;
        if (detail?.changed !== true) return;
        cloudDataDirtyRef.current = false;
        void loadRecent();
      }
    });
    return () => {
      window.removeEventListener('runmate:cloud-data-updated', markCloudDataDirty);
      unsubscribeHealthSync();
    };
  }, [loadRecent]);

  useIonViewWillEnter(() => {
    visibleRef.current = true;
    if (!loadedRef.current || cloudDataDirtyRef.current) {
      cloudDataDirtyRef.current = false;
      void loadRecent();
    }
    syncTimerRef.current = window.setTimeout(() => {
      void measurePerformanceDiagnostic(
        'activity_health_sync',
        () => syncTodayHealth(),
        (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Activity check'),
      ).then((result) => {
        if (result.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
        if (result.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
        if ((result.changed || startupCacheUsedRef.current) && visibleRef.current) {
          cloudDataDirtyRef.current = false;
          void loadRecent();
        }
      });
    }, 1200);
  });

  useIonViewDidLeave(() => {
    visibleRef.current = false;
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  });

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    setRefreshError(null);
    try {
      await measurePerformanceDiagnostic(
        'activity_health_sync',
        () => syncTodayHealth(true),
        (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Activity refresh'),
      );
      cloudDataDirtyRef.current = false;
      await loadRecent();
    } catch (refreshFailure) {
      console.error('[activity] refresh failed', refreshFailure);
      setRefreshError('Unable to refresh Activity right now. Your saved records are still available.');
    } finally {
      event.detail.complete();
    }
  };

  const groupedItems = useMemo(() => {
    const visible = items.filter((item) => getHistoryItemDateKey(item) === selectedDate);
    const groups = new Map<string, LocalHistoryItem[]>();
    for (const item of visible) {
      const date = getHistoryItemDateKey(item);
      groups.set(date, [...(groups.get(date) ?? []), item]);
    }
    return [...groups.entries()]
      .map(([date, dateItems]): [string, LocalHistoryItem[]] => [date, sortHistoryItemsByEventTimeDesc(dateItems)])
      .sort(([a], [b]) => b.localeCompare(a));
  }, [items, selectedDate]);
  const selectedItems = useMemo(() => groupedItems.flatMap(([, dateItems]) => dateItems), [groupedItems]);
  const recordGroups = useMemo(() => groupActivityRecords(selectedItems), [selectedItems]);
  const availableDates = useMemo(() => new Set([...items.map(getHistoryItemDateKey), todayDate]), [items, todayDate]);
  const nutritionMeasurement = useMemo(() => {
    const startedAt = performance.now();
    const value = buildDailyNutritionSummary(items, selectedDate);
    return { value, durationMs: performance.now() - startedAt };
  }, [items, selectedDate]);
  const nutritionSummary = nutritionMeasurement.value;
  const plannedWorkout = useMemo(() => selectedDate === todayDate ? getPlannedWorkoutForDateWithRaceDay(racePlan, raceGoal, selectedDate) : null, [racePlan, raceGoal, selectedDate, todayDate]);
  const fuelCoach = useMemo(() => buildDailyFuelCoach({
    date: selectedDate,
    items,
    profile,
    plannedWorkout,
  }), [items, profile, plannedWorkout, selectedDate]);
  useEffect(() => {
    recordPerformanceDiagnostic(
      'activity_nutrition',
      nutritionMeasurement.durationMs,
      'success',
      nutritionSummary ? `${nutritionSummary.mealCount} meals summarized` : 'No meals for selected date',
    );
  }, [nutritionMeasurement.durationMs, nutritionSummary, selectedDate]);
  const sortedDates = useMemo(() => [...availableDates].sort(), [availableDates]);
  const selectedDateIndex = sortedDates.indexOf(selectedDate);

  const moveToDate = (date: string | undefined) => {
    if (!date || date === selectedDate) return;
    setSelectedDate(date);
    setExpandedRecordGroups(new Set());
  };

  const toggleRecordGroup = (key: ActivityRecordGroupKey) => {
    setExpandedRecordGroups((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return;
    const target = pendingDelete;
    setPendingDelete(null); setDeletingId(target.id); setDeleteError(null);
    const result = isHealthConnectImportedItem(target)
      ? await hideImportedHistoryItem(target)
      : await deleteHistoryItem(target.id);
    if (result.ok) {
      cloudDataDirtyRef.current = false;
      setItems((current) => {
        const next = current.filter((item) => item.id !== target.id);
        saveActivityStartupSnapshot(next);
        return next;
      });
      void deleteMealNutritionRecord(target);
    }
    else setDeleteError(result.error ?? 'Could Not Delete This Activity. Please Try Again.');
    setDeletingId(null);
  };

  return (
    <IonPage>
      <IonHeader translucent className="history-header">
        <IonToolbar>
          <IonTitle>Move</IonTitle>
          <IonButtons slot="end">
            <IonButton aria-label="Log Activity" onClick={() => history.push('/tabs/log')}><IonIcon icon={addOutline} /></IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent ref={contentRef} fullscreen className="history-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" />
        </IonRefresher>
        <main className="history-shell">
          <nav className={`activity-date-navigator${selectedDate !== todayDate ? ' has-current' : ''}`} aria-label="Choose Activity Date">
            <button type="button" className="activity-date-arrow" aria-label="Previous Activity Date" disabled={selectedDateIndex <= 0} onClick={() => moveToDate(sortedDates[selectedDateIndex - 1])}><IonIcon icon={chevronBackOutline} /></button>
            <button type="button" className="activity-date-button" aria-label={`Choose Activity Date. Selected ${selectedDate}`} onClick={() => { setCalendarOpen(true); void loadArchive(); }}>
              <IonIcon icon={calendarClearOutline} />
              <span><small>Selected Date</small><h1>{selectedDate === todayDate ? `Today, ${formatMonthDay(selectedDate)}` : formatSelectedDate(selectedDate)}</h1></span>
            </button>
            <button type="button" className="activity-date-arrow" aria-label="Next Activity Date" disabled={selectedDateIndex < 0 || selectedDateIndex >= sortedDates.length - 1} onClick={() => moveToDate(sortedDates[selectedDateIndex + 1])}><IonIcon icon={chevronForwardOutline} /></button>
            {selectedDate !== todayDate && <button type="button" className="activity-inline-current" onClick={() => moveToDate(todayDate)}>Current</button>}
          </nav>

          <MoveToolsNav
            onPlan={() => history.push('/weekly-plan', { from: '/tabs/move' })}
            onRace={() => history.push('/race-goal', { from: '/tabs/move' })}
            onSummary={() => history.push('/weekly-summary', { from: '/tabs/move' })}
          />

          {!loading && !error && plannedWorkout && (
            <PlannedTrainingCard workout={plannedWorkout} onOpen={() => history.push('/weekly-plan', { from: '/tabs/move' })} />
          )}

          {!loading && !error && nutritionSummary && (
            <section className="daily-nutrition-summary" aria-labelledby="daily-nutrition-heading">
              <header>
                <div><p>Logged Nutrition</p><h2 id="daily-nutrition-heading">Daily Meal Total</h2></div>
                <span>{nutritionSummary.mealCount} {nutritionSummary.mealCount === 1 ? 'Meal' : 'Meals'}</span>
              </header>
              <div className="daily-nutrition-metrics">
                <div><span>Calories</span><strong>{formatMetric(nutritionSummary.caloriesKcal)}<small> kcal</small></strong></div>
                <NutritionMetric label="Protein" value={nutritionSummary.proteinG} />
                <NutritionMetric label="Carbs" value={nutritionSummary.carbsG} />
                <NutritionMetric label="Fat" value={nutritionSummary.fatG} />
              </div>
              <small>Based only on meals logged for this date.</small>
              <button type="button" className="daily-nutrition-trends-link" onClick={() => history.push('/nutrition-trends', { from: '/tabs/move' })}>View Nutrition Trends<IonIcon icon={chevronForwardOutline} /></button>
            </section>
          )}

          {!loading && !error && <DailyFuelCoachCard coach={fuelCoach} preparing={fuelContextLoading && !profile} onProfile={() => history.push('/profile-settings')} onLogMeal={() => history.push('/tabs/log?type=meal')} onAskCoach={() => history.push('/tabs/coach', { initialTopic: 'fuel' })} />}

          {loading && <PageDataSkeleton variant="activity" label="Loading Your Activity" />}
          {!loading && error && <PageState kind="error" title="Activity Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void loadRecent()} className="history-state history-error" />}
          {refreshError && <div className="history-delete-error" role="status"><span>{refreshError}</span><button type="button" onClick={() => setRefreshError(null)}>Dismiss</button></div>}
          {!loading && !error && groupedItems.length === 0 && (
            <PageState kind="empty" icon={fitnessOutline} title="No Activity On This Date" detail="Choose another date to review previous activity." className="history-empty" />
          )}
          {deleteError && <div className="history-delete-error" role="alert"><span>{deleteError}</span><button type="button" onClick={() => setDeleteError(null)}>Dismiss</button></div>}
          {!loading && !error && groupedItems.map(([date, dateItems]) => (
            <section className="history-day" key={date}>
              <header>
                <div><p>Recorded Data</p><h2>{selectedDate === todayDate ? "Today's Records" : 'Daily Records'}</h2></div>
                <span>{dateItems.length} {dateItems.length === 1 ? 'Record' : 'Records'}</span>
              </header>
              <div className="activity-record-groups">
                {recordGroups.map((group) => {
                  const expanded = expandedRecordGroups.has(group.key);
                  return <section className={`activity-record-group is-${group.key}${expanded ? ' is-expanded' : ''}`} key={group.key}>
                    <button type="button" className="activity-record-group-toggle" aria-expanded={expanded} aria-controls={`activity-records-${group.key}`} onClick={() => toggleRecordGroup(group.key)}>
                      <IonIcon icon={group.icon} /><span><strong>{group.label}</strong><small>{group.summary}</small></span><b>{group.items.length}</b><IonIcon className="activity-record-group-chevron" icon={chevronDownOutline} />
                    </button>
                    {expanded && <div className="history-list" id={`activity-records-${group.key}`}>{group.items.map((item) => <ActivityHistoryRow item={item} deleting={deletingId === item.id} onDelete={() => setPendingDelete(item)} key={item.id} />)}</div>}
                  </section>;
                })}
              </div>
            </section>
          ))}
        </main>
      </IonContent>
      <IonModal className="history-date-modal" isOpen={calendarOpen} onDidDismiss={() => setCalendarOpen(false)}>
        {(archiveLoading || archiveError) && (
          <div className={archiveError ? 'history-archive-status is-error' : 'history-archive-status'} role="status">
            {archiveLoading ? <><IonSpinner name="crescent" />Loading Older Dates...</> : <><span>{archiveError}</span><button type="button" onClick={() => void loadArchive()}>Retry</button></>}
          </div>
        )}
        <IonDatetime
          presentation="date"
          value={selectedDate}
          min={sortedDates[0]}
          max={sortedDates.at(-1)}
          isDateEnabled={(date) => availableDates.has(date)}
          onIonChange={(event) => {
            const value = event.detail.value;
            if (typeof value === 'string' && availableDates.has(value.slice(0, 10))) {
              setSelectedDate(value.slice(0, 10));
              setCalendarOpen(false);
            }
          }}
        />
      </IonModal>
      <IonAlert
        isOpen={Boolean(pendingDelete)}
        onDidDismiss={() => setPendingDelete(null)}
        header={pendingDelete && isHealthConnectImportedItem(pendingDelete) ? 'Hide From RunMate?' : 'Delete RunMate Record?'}
        message={pendingDelete ? isHealthConnectImportedItem(pendingDelete)
          ? `Hide ${describeHistoryItem(pendingDelete).title} from RunMate and prevent it from being imported again? Samsung Health and Health Connect will not be changed.`
          : `Permanently delete ${describeHistoryItem(pendingDelete).title} from RunMate? Samsung Health and Health Connect will not be changed.` : ''}
        buttons={[{ text: 'Cancel', role: 'cancel' }, { text: pendingDelete && isHealthConnectImportedItem(pendingDelete) ? 'Hide' : 'Delete', role: 'destructive', handler: () => { void confirmDelete(); } }]}
      />
    </IonPage>
  );
};

function NutritionMetric({ label, value }: { label: string; value: number | null }) {
  return <div><span>{label}</span><strong>{formatMetric(value)}{value !== null ? ' g' : ''}</strong></div>;
}

export function PlannedTrainingCard({ workout, onOpen }: { workout: WeekWorkout; onOpen: () => void }) {
  const restDay = isRestDayWorkout(workout);
  const details = formatRaceWorkoutMetric(workout);
  // workout.description is Coach Guidance text (Thai, shown in the Session Details
  // modal opened via onOpen) — this card stays on a fixed English caption instead
  // of rendering it directly, since the Move tab is English-only.
  return <section className={`move-plan-card${restDay ? ' is-rest' : ''}`} aria-labelledby="move-plan-heading">
    <span className="move-plan-icon"><IonIcon icon={plannedWorkoutIcon(workout)} aria-hidden="true" /></span>
    <div className="move-plan-copy">
      <p>Planned Training</p>
      <h2 id="move-plan-heading">{workout.workoutType || 'Training Session'}</h2>
      <span>{restDay ? 'Recovery is the plan for today.' : 'Follow the planned session for today.'}</span>
      {details && <small>{details}</small>}
    </div>
    <button type="button" onClick={onOpen} aria-label="Open Weekly Plan"><span>{restDay ? 'Rest' : 'Plan'}</span><IonIcon icon={chevronForwardOutline} aria-hidden="true" /></button>
  </section>;
}

export function MoveToolsNav({ onPlan, onRace, onSummary }: { onPlan: () => void; onRace: () => void; onSummary: () => void }) {
  return <nav className="move-tools-nav" aria-label="Move Tools">
    <button type="button" onClick={onPlan}><IonIcon icon={calendarClearOutline} aria-hidden="true" /><span>Plan</span></button>
    <button type="button" onClick={onRace}><IonIcon icon={flagOutline} aria-hidden="true" /><span>Race</span></button>
    <button type="button" onClick={onSummary}><IonIcon icon={statsChartOutline} aria-hidden="true" /><span>Summary</span></button>
  </nav>;
}

function plannedWorkoutIcon(workout: WeekWorkout): string {
  const type = workout.workoutType.toLowerCase();
  if (isRestDayWorkout(workout)) return moonOutline;
  if (type.includes('strength') || type.includes('weight')) return barbellOutline;
  if (type.includes('walk') || type.includes('recovery')) return walkOutline;
  if (type.includes('cycle') || type.includes('bike')) return bicycleOutline;
  return fitnessOutline;
}

function DailyFuelCoachCard({ coach, preparing, onProfile, onLogMeal, onAskCoach }: { coach: DailyFuelCoach; preparing: boolean; onProfile: () => void; onLogMeal: () => void; onAskCoach: () => void }) {
  if (preparing) return <section className="daily-fuel-card is-preparing" aria-busy="true"><IonSpinner name="crescent" /><div><p>Daily Fuel Coach</p><h2>Preparing Your Targets</h2><span>Loading your current weight and training plan.</span></div></section>;
  return <section className="daily-fuel-card" aria-labelledby="daily-fuel-heading">
    <header><div><p>Daily Fuel Coach</p><h2 id="daily-fuel-heading">Fuel For This Day</h2></div><span>{coach.dayLabel}</span></header>
    {coach.basedOnLoggedTraining && <small className="daily-fuel-day-source">Based on today&apos;s logged training, which differs from the planned session above.</small>}
    {coach.status === 'needs_weight' ?<div className="daily-fuel-setup"><IonIcon icon={restaurantOutline} /><div><strong>{coach.recommendation.title}</strong><span>{coach.recommendation.detail}</span></div><button type="button" onClick={onProfile}>Review Profile</button></div> : <>
      <div className="daily-fuel-quick-status" aria-label="Daily fuel target status">
        <FuelStatus label="Protein" target={coach.protein!} />
        <FuelStatus label="Carbs" target={coach.carbs!} />
      </div>
      <div className="daily-fuel-guidance"><IonIcon icon={sparklesOutline} /><div><strong>{coach.recommendation.title}</strong><span>{coach.recommendation.detail}</span></div></div>
      <div className="daily-fuel-footer"><span>{coach.note}</span>{coach.mealCount === 0 ? <button type="button" onClick={onLogMeal}>Log A Meal</button> : <button type="button" onClick={onAskCoach}>Ask AI Coach</button>}</div>
    </>}
  </section>;
}

function FuelStatus({ label, target }: { label: string; target: NonNullable<DailyFuelCoach['protein']> }) {
  const status = target.logged == null ? 'Not available' : target.remainingToMinimum ? `${target.remainingToMinimum} g remaining` : 'Target reached';
  return <div className={target.remainingToMinimum ? '' : 'is-reached'}><span>{label}</span><strong>{status}</strong></div>;
}

function formatSelectedDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMonthDay(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMetric(value: number | null): string { return value === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); }

export default ActivityPage;
