import { useCallback, useEffect, useMemo, useState } from 'react';
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
  type RefresherEventDetail,
} from '@ionic/react';
import { barbellOutline, bodyOutline, calendarClearOutline, chevronBackOutline, chevronForwardOutline, fastFoodOutline, fitnessOutline, heartOutline, moonOutline, trashOutline } from 'ionicons/icons';
import { deleteHistoryItem, loadHistoryItems } from '@/lib/cloudHistory';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
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

  const load = useCallback(async () => {
    setError(null);
    const result = await loadHistoryItems();
    if (result.ok) setItems(result.items);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
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

          {loading && <div className="history-state"><IonSpinner name="crescent" /><p>Loading History…</p></div>}
          {!loading && error && <div className="history-state history-error"><p>{error}</p><button type="button" onClick={() => void load()}>Try Again</button></div>}
          {!loading && !error && groupedItems.length === 0 && (
            <div className="history-empty"><IonIcon icon={fitnessOutline} /><h2>No Activity On This Date</h2><p>Choose another date to review previous activity.</p></div>
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
      <div className="history-copy"><span>{presentation.label}</span><h3>{presentation.title}</h3><p>{presentation.detail}</p></div>
      {item.source?.provider && <small>{sourceLabel(item.source.provider)}</small>}
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
function formatSelectedDate(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function formatMonthDay(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(new Date(`${date}T12:00:00`)); }
function bangkokDate(offsetDays: number): string { return new Date(Date.now() + 7 * 60 * 60 * 1000 + offsetDays * 86_400_000).toISOString().slice(0, 10); }

export default ActivityPage;
