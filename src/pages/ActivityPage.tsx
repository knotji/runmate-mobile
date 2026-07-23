import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonContent,
  IonAlert,
  IonDatetime,
  IonHeader,
  IonIcon,
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
import { calendarClearOutline, chevronBackOutline, chevronForwardOutline, fitnessOutline } from 'ionicons/icons';
import { deleteHistoryItem, loadHistoryItems } from '@/lib/cloudHistory';
import { getHistoryItemDateKey, todayBangkokDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { describeTodayHealthSyncPerformance, syncTodayHealth } from '@/lib/healthSyncService';
import { buildDailyNutritionSummary } from '@/lib/activityNutritionSummary';
import { activityRecentHistoryOptions, mergeActivityHistoryItems, prepareActivityHistoryItems, uploadedActivityDateFromEvent } from '@/lib/activityHistoryLoad';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { ActivityHistoryRow } from '@/components/ActivityHistoryRow';
import { describeHistoryItem } from '@/lib/activityHistoryPresentation';
import { measurePerformanceDiagnostic, recordPerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import './ActivityPage.css';

const ActivityPage: React.FC = () => {
  const history = useHistory();
  const todayDate = todayBangkokDateKey();
  const [items, setItems] = useState<LocalHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [dateLoading, setDateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LocalHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const archiveLoadedRef = useRef(false);
  const archiveLoadingRef = useRef(false);
  const visibleRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);
  const cloudDataDirtyRef = useRef(false);

  const loadRecent = useCallback(async () => {
    setError(null);
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
      setItems((current) => mergeActivityHistoryItems(current, result.items));
      loadedRef.current = true;
    }
    else setError(result.error);
    setLoading(false);
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
    const handleHealthSynced = () => {
      if (visibleRef.current) {
        cloudDataDirtyRef.current = false;
        void loadRecent();
      }
    };
    window.addEventListener('runmate:cloud-data-updated', markCloudDataDirty);
    window.addEventListener('runmate:health-synced', handleHealthSynced);
    return () => {
      window.removeEventListener('runmate:cloud-data-updated', markCloudDataDirty);
      window.removeEventListener('runmate:health-synced', handleHealthSynced);
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
        if (result.changed && visibleRef.current) {
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
    await measurePerformanceDiagnostic(
      'activity_health_sync',
      () => syncTodayHealth(true),
      (syncResult) => describeTodayHealthSyncPerformance(syncResult, 'Activity refresh'),
    );
    cloudDataDirtyRef.current = false;
    await loadRecent();
    event.detail.complete();
  };

  const groupedItems = useMemo(() => {
    const visible = items.filter((item) => getHistoryItemDateKey(item) === selectedDate);
    const groups = new Map<string, LocalHistoryItem[]>();
    for (const item of visible) {
      const date = getHistoryItemDateKey(item);
      groups.set(date, [...(groups.get(date) ?? []), item]);
    }
    return [...groups.entries()].sort(([a], [b]) => b.localeCompare(a));
  }, [items, selectedDate]);
  const availableDates = useMemo(() => new Set([...items.map(getHistoryItemDateKey), todayDate]), [items, todayDate]);
  const nutritionMeasurement = useMemo(() => {
    const startedAt = performance.now();
    const value = buildDailyNutritionSummary(items, selectedDate);
    return { value, durationMs: performance.now() - startedAt };
  }, [items, selectedDate]);
  const nutritionSummary = nutritionMeasurement.value;
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
    if (!date || date === selectedDate || dateLoading) return;
    setDateLoading(true);
    window.setTimeout(() => {
      setSelectedDate(date);
      setDateLoading(false);
    }, 200);
  };

  const confirmDelete = async () => {
    if (!pendingDelete || deletingId) return;
    const target = pendingDelete;
    setPendingDelete(null); setDeletingId(target.id); setDeleteError(null);
    const result = await deleteHistoryItem(target.id);
    if (result.ok) {
      cloudDataDirtyRef.current = false;
      setItems((current) => current.filter((item) => item.id !== target.id));
    }
    else setDeleteError(result.error ?? 'Could Not Delete This Activity. Please Try Again.');
    setDeletingId(null);
  };

  return (
    <IonPage>
      <IonHeader translucent className="history-header">
        <IonToolbar>
          <IonTitle>Activity</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="history-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" />
        </IonRefresher>
        <main className="history-shell">
          <header className="history-intro">
            <p>Daily Activity</p>
            <h1>{selectedDate === todayDate ? "Today's Activity" : formatSelectedDate(selectedDate)}</h1>
            <span>Sleep, training, nutrition, and health records for the selected day.</span>
          </header>

          <nav className={`activity-date-navigator${selectedDate !== todayDate ? ' has-current' : ''}`} aria-label="Choose Activity Date">
            <button type="button" className="activity-date-arrow" aria-label="Previous Activity Date" disabled={dateLoading || selectedDateIndex <= 0} onClick={() => moveToDate(sortedDates[selectedDateIndex - 1])}><IonIcon icon={chevronBackOutline} /></button>
            <button type="button" className="activity-date-button" disabled={dateLoading} onClick={() => { setCalendarOpen(true); void loadArchive(); }}>
              {dateLoading ? <IonSpinner name="crescent" /> : <IonIcon icon={calendarClearOutline} />}
              <span><small>{dateLoading ? 'Loading Date' : 'Selected Date'}</small><strong>{dateLoading ? 'Updating…' : selectedDate === todayDate ? `Today, ${formatMonthDay(selectedDate)}` : formatSelectedDate(selectedDate)}</strong></span>
            </button>
            <button type="button" className="activity-date-arrow" aria-label="Next Activity Date" disabled={dateLoading || selectedDateIndex < 0 || selectedDateIndex >= sortedDates.length - 1} onClick={() => moveToDate(sortedDates[selectedDateIndex + 1])}><IonIcon icon={chevronForwardOutline} /></button>
            {selectedDate !== todayDate && <button type="button" className="activity-inline-current" disabled={dateLoading} onClick={() => moveToDate(todayDate)}>Current</button>}
          </nav>

          {!loading && !error && nutritionSummary && (
            <section className="daily-nutrition-summary" aria-labelledby="daily-nutrition-heading">
              <header>
                <div><p>Logged Nutrition</p><h2 id="daily-nutrition-heading">Daily Meal Total</h2></div>
                <span>{nutritionSummary.mealCount} {nutritionSummary.mealCount === 1 ? 'Meal' : 'Meals'}</span>
              </header>
              <div className="daily-nutrition-calories">
                <strong>{formatMetric(nutritionSummary.caloriesKcal)}</strong><span>kcal logged</span>
              </div>
              <div className="daily-nutrition-macros">
                <NutritionMetric label="Protein" value={nutritionSummary.proteinG} />
                <NutritionMetric label="Carbs" value={nutritionSummary.carbsG} />
                <NutritionMetric label="Fat" value={nutritionSummary.fatG} />
              </div>
              <small>Based only on meals logged for this date.</small>
              <button type="button" className="daily-nutrition-trends-link" onClick={() => history.push('/nutrition-trends')}>View Nutrition Trends<IonIcon icon={chevronForwardOutline} /></button>
            </section>
          )}

          {loading && <PageDataSkeleton variant="activity" label="Loading Your Activity" />}
          {!loading && error && <PageState kind="error" title="Activity Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void loadRecent()} className="history-state history-error" />}
          {!loading && !error && groupedItems.length === 0 && (
            <PageState kind="empty" icon={fitnessOutline} title="No Activity On This Date" detail="Choose another date to review previous activity." className="history-empty" />
          )}
          {deleteError && <div className="history-delete-error"><span>{deleteError}</span><button type="button" onClick={() => setDeleteError(null)}>Dismiss</button></div>}
          {!loading && !error && groupedItems.map(([date, dateItems]) => (
            <section className="history-day" key={date}>
              <header><span>{dateItems.length} {dateItems.length === 1 ? 'Record' : 'Records'}</span></header>
              <div className="history-list">
                {dateItems.map((item) => <ActivityHistoryRow item={item} deleting={deletingId === item.id} onDelete={() => setPendingDelete(item)} key={item.id} />)}
              </div>
            </section>
          ))}
        </main>
      </IonContent>
      <IonModal className="history-date-modal" isOpen={calendarOpen} onDidDismiss={() => setCalendarOpen(false)}>
        {(archiveLoading || archiveError) && (
          <div className={archiveError ? 'history-archive-status is-error' : 'history-archive-status'} role="status">
            {archiveLoading ? <><IonSpinner name="crescent" />Loading Older Datesâ€¦</> : <><span>{archiveError}</span><button type="button" onClick={() => void loadArchive()}>Retry</button></>}
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
      <IonAlert isOpen={Boolean(pendingDelete)} onDidDismiss={() => setPendingDelete(null)} header="Delete Activity?" message={pendingDelete ? `Remove ${describeHistoryItem(pendingDelete).title} from your Activity? This cannot be undone.` : ''} buttons={[{ text: 'Cancel', role: 'cancel' }, { text: 'Delete', role: 'destructive', handler: () => { void confirmDelete(); } }]} />
    </IonPage>
  );
};

function NutritionMetric({ label, value }: { label: string; value: number | null }) {
  return <div><span>{label}</span><strong>{formatMetric(value)}{value !== null ? ' g' : ''}</strong></div>;
}

function formatSelectedDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMonthDay(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMetric(value: number | null): string { return value === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); }

export default ActivityPage;
