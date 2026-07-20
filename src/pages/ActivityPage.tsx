import { useCallback, useMemo, useRef, useState } from 'react';
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
import { barbellOutline, bodyOutline, calendarClearOutline, chevronBackOutline, chevronForwardOutline, fastFoodOutline, fitnessOutline, heartOutline, moonOutline, trashOutline } from 'ionicons/icons';
import { deleteHistoryItem, loadHistoryItems } from '@/lib/cloudHistory';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { dedupeSleepItems } from '@/lib/sleepDedupe';
import { syncTodayHealth } from '@/lib/healthSyncService';
import { dedupeWorkoutItems, type MergedWorkoutItem } from '@/lib/workoutDedupe';
import { buildDailyNutritionSummary } from '@/lib/activityNutritionSummary';
import { PageState } from '@/components/PageState';
import './ActivityPage.css';

const ActivityPage: React.FC = () => {
  const todayDate = bangkokDate(0);
  const [items, setItems] = useState<LocalHistoryItem[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayDate);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [dateLoading, setDateLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<LocalHistoryItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const loadedRef = useRef(false);
  const visibleRef = useRef(false);
  const syncTimerRef = useRef<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    const result = await loadHistoryItems();
    if (result.ok) {
      const sleep = dedupeSleepItems(result.items.filter((item) => item.type === 'sleep'));
      const workouts = dedupeWorkoutItems(result.items.filter((item) => item.type === 'workout' || item.type === 'strength'));
      setItems([...result.items.filter((item) => item.type !== 'sleep' && item.type !== 'workout' && item.type !== 'strength'), ...sleep, ...workouts]);
      loadedRef.current = true;
    }
    else setError(result.error);
    setLoading(false);
  }, []);

  useIonViewWillEnter(() => {
    visibleRef.current = true;
    if (!loadedRef.current) void load();
    syncTimerRef.current = window.setTimeout(() => {
      void syncTodayHealth().then((result) => {
        if (result.sleep?.error) console.warn('[sleep-sync] Samsung Health sync failed', result.sleep.error);
        if (result.workout?.error) console.warn('[workout-sync] Samsung Health sync failed', result.workout.error);
        if (result.changed && visibleRef.current) void load();
      });
    }, 1200);
  });

  useIonViewDidLeave(() => {
    visibleRef.current = false;
    if (syncTimerRef.current !== null) window.clearTimeout(syncTimerRef.current);
    syncTimerRef.current = null;
  });

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await syncTodayHealth(true);
    await load();
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
  const nutritionSummary = useMemo(() => buildDailyNutritionSummary(items, selectedDate), [items, selectedDate]);
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
    if (result.ok) setItems((current) => current.filter((item) => item.id !== target.id));
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
            <button type="button" className="activity-date-button" disabled={dateLoading} onClick={() => setCalendarOpen(true)}>
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
            </section>
          )}

          {loading && <PageState kind="loading" title="Loading Activity…" className="history-state" />}
          {!loading && error && <PageState kind="error" title="Activity Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="history-state history-error" />}
          {!loading && !error && groupedItems.length === 0 && (
            <PageState kind="empty" icon={fitnessOutline} title="No Activity On This Date" detail="Choose another date to review previous activity." className="history-empty" />
          )}
          {deleteError && <div className="history-delete-error"><span>{deleteError}</span><button type="button" onClick={() => setDeleteError(null)}>Dismiss</button></div>}
          {!loading && !error && groupedItems.map(([date, dateItems]) => (
            <section className="history-day" key={date}>
              <header><span>{dateItems.length} {dateItems.length === 1 ? 'Record' : 'Records'}</span></header>
              <div className="history-list">
                {dateItems.map((item) => <HistoryRow item={item} deleting={deletingId === item.id} onDelete={() => setPendingDelete(item)} key={item.id} />)}
              </div>
            </section>
          ))}
        </main>
      </IonContent>
      <IonModal className="history-date-modal" isOpen={calendarOpen} onDidDismiss={() => setCalendarOpen(false)}>
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

function HistoryRow({ item, deleting, onDelete }: { item: LocalHistoryItem; deleting: boolean; onDelete: () => void }) {
  const history = useHistory();
  const presentation = describeHistoryItem(item);
  const isWorkout = item.type === 'workout' || item.type === 'strength';
  const isSleep = item.type === 'sleep';
  const detailPath = isWorkout
    ? `/activity/workout/${encodeURIComponent(item.id)}`
    : isSleep
      ? `/sleep?date=${encodeURIComponent(getHistoryItemDateKey(item))}&from=activity`
      : item.type === 'meal'
        ? `/activity/meal/${encodeURIComponent(item.id)}`
        : item.type === 'pain' || item.type === 'sick'
          ? `/activity/health/${encodeURIComponent(item.id)}`
          : null;
  const content = (
    <>
      <div className={`history-icon history-icon-${presentation.tone}`}><IonIcon icon={presentation.icon} /></div>
      <div className="history-copy">
        <span>{presentation.label}</span>
        <h3>{presentation.title}</h3>
        <div className="history-row-meta"><p>{presentation.detail}</p>{item.source?.provider && <small>{workoutSourceLabel(item)}</small>}</div>
      </div>
      {detailPath && <IonIcon className="history-row-chevron" icon={chevronForwardOutline} />}
    </>
  );
  return <div className="history-row-shell">{detailPath
    ? <button type="button" className="history-row history-row-button" disabled={deleting} onClick={() => history.push(detailPath)}>{content}</button>
    : <article className="history-row">{content}</article>}
    <button type="button" className="history-row-delete" disabled={deleting} onClick={onDelete} aria-label={`Delete ${presentation.title}`}>{deleting ? <IonSpinner name="crescent" /> : <IonIcon icon={trashOutline} />}</button>
  </div>;
}

function describeHistoryItem(item: LocalHistoryItem): { label: string; title: string; detail: string; icon: string; tone: string } {
  const data = asRecord(item.data);
  const extracted = asRecord(data.extracted);
  if (item.type === 'sleep') {
    return { label: 'Sleep', title: text(extracted.sleepDuration) ?? minutesText(extracted.actualSleepDurationMinutes) ?? 'Sleep Record', detail: scoreDetail(extracted.sleepScore), icon: moonOutline, tone: 'sleep' };
  }
  if (item.type === 'workout' || item.type === 'strength') {
    const kind = titleFromKey(text(extracted.workoutKind) ?? (item.type === 'strength' ? 'strength_training' : 'workout'));
    const details = [numberUnit(extracted.distanceKm, 'km'), text(extracted.duration), numberUnit(extracted.avgHR, 'bpm')].filter(Boolean).join(' · ');
    return { label: item.type === 'strength' ? 'Strength' : 'Workout', title: kind, detail: details || 'Training session recorded', icon: item.type === 'strength' ? barbellOutline : fitnessOutline, tone: 'workout' };
  }
  if (item.type === 'meal') {
    const foods = Array.isArray(data.detectedFoods) ? data.detectedFoods.map((food) => text(asRecord(food).name)).filter(Boolean).slice(0, 2).join(', ') : null;
    const nutrition = asRecord(data.nutrition);
    return { label: 'Nutrition', title: foods || titleFromKey(text(data.mealType) ?? 'Meal'), detail: numberUnit(nutrition.caloriesKcal, 'kcal') ?? 'Meal recorded', icon: fastFoodOutline, tone: 'meal' };
  }
  if (item.type === 'pain') {
    return { label: 'Pain', title: text(data.painLocation) ?? 'Pain Check-In', detail: numberUnit(data.painLevel, '/10') ?? 'Health record', icon: heartOutline, tone: 'health' };
  }
  if (item.type === 'sick') {
    return { label: 'Health', title: 'Sick Check-In', detail: arrayText(data.symptoms) ?? 'Symptoms recorded', icon: heartOutline, tone: 'health' };
  }
  if (item.type === 'body') {
    return { label: 'Body', title: numberUnit(extracted.weightKg, 'kg') ?? 'Body Composition', detail: numberUnit(extracted.bodyFatPercent, '% body fat') ?? 'Body record', icon: bodyOutline, tone: 'body' };
  }
  return { label: titleFromKey(item.type), title: 'RunMate Record', detail: 'Health activity recorded', icon: fitnessOutline, tone: 'other' };
}

function asRecord(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function numberUnit(value: unknown, unit: string): string | null { return typeof value === 'number' && Number.isFinite(value) ? `${Math.round(value * 10) / 10} ${unit}` : null; }
function minutesText(value: unknown): string | null { if (typeof value !== 'number') return null; return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`; }
function scoreDetail(value: unknown): string { return typeof value === 'number' ? `Sleep Score ${Math.round(value)}/100` : 'Sleep session recorded'; }
function arrayText(value: unknown): string | null { return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string').map(titleFromKey).join(', ') || null : null; }
function titleFromKey(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function sourceLabel(value: string): string { return titleFromKey(value.replace('_health', ' Health').replace('_connect', ' Connect')); }
function workoutSourceLabel(item: LocalHistoryItem): string {
  const sources = (item as MergedWorkoutItem).reconciledSources;
  return sources?.length ? sources.join(' + ') : sourceLabel(item.source?.provider ?? 'manual');
}
function formatSelectedDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMonthDay(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function bangkokDate(offsetDays: number): string { return new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10); }
function formatMetric(value: number | null): string { return value === null ? '—' : new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); }

export default ActivityPage;
