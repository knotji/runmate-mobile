import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonTitle, IonToolbar, useIonViewWillEnter, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, chevronBackOutline, chevronForwardOutline, fitnessOutline, moonOutline, nutritionOutline, pulseOutline } from 'ionicons/icons';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { PageState } from '@/components/PageState';
import { DataFreshnessStatus } from '@/components/DataFreshnessStatus';
import { endOfMonth, shiftDate, shiftMonths, startOfMonth, todayBangkokDateKey, weekdayIndex } from '@/lib/date';
import { buildHabitImpactInsights, buildHealthCalendarDays } from '@/lib/healthCalendar';
import { HEALTH_CALENDAR_MAX_ROWS, loadHealthCalendarHistory } from '@/lib/healthCalendarHistory';
import { loadHealthCalendarSnapshot, saveHealthCalendarSnapshot } from '@/lib/healthCalendarStartupCache';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { exportStrainCheckIns } from '@/lib/strainContext';
import './HealthCalendarPage.css';

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

const HealthCalendarPage: React.FC = () => {
  const history = useHistory();
  const [today, setToday] = useState(() => todayBangkokDateKey());
  const [startupItems] = useState(() => loadHealthCalendarSnapshot());
  const [month, setMonth] = useState(() => startOfMonth(today));
  const [selectedDate, setSelectedDate] = useState(today);
  const [items, setItems] = useState<LocalHistoryItem[]>(startupItems ?? []);
  const [dataReady, setDataReady] = useState(startupItems !== null);
  const [loading, setLoading] = useState(startupItems === null);
  const [error, setError] = useState<string | null>(null);
  const [historyLimited, setHistoryLimited] = useState(false);
  const [checkIns, setCheckIns] = useState(() => exportStrainCheckIns());
  const activeLoadRef = useRef<Promise<void> | null>(null);
  const contentRef = useRef<HTMLIonContentElement>(null);

  const load = useCallback(async () => {
    if (activeLoadRef.current) return activeLoadRef.current;
    const operation = (async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await measurePerformanceDiagnostic(
          'health_calendar',
          () => loadHealthCalendarHistory(),
          (value) => ({
            status: value.ok ? 'success' : 'failed',
            variant: startupItems ? 'prepared' : 'live',
            detail: value.ok ? `${value.items.length} health records prepared${value.limited ? ' (newest rows only)' : ''}` : value.error,
          }),
        );
        if (result.ok) {
          setItems(result.items);
          setHistoryLimited(result.limited);
          saveHealthCalendarSnapshot(result.items);
          setDataReady(true);
        } else {
          setError(result.error);
        }
      } catch (failure) {
        setError(failure instanceof Error ? failure.message : 'Could Not Load Health Calendar.');
      } finally {
        setLoading(false);
      }
    })().finally(() => { activeLoadRef.current = null; });
    activeLoadRef.current = operation;
    return operation;
  }, [startupItems]);

  const enterView = useCallback(() => {
    const currentToday = todayBangkokDateKey();
    if (today !== currentToday) {
      setSelectedDate((current) => current === today ? currentToday : current);
      setMonth((current) => current === startOfMonth(today) ? startOfMonth(currentToday) : current);
      setToday(currentToday);
    }
    setCheckIns(exportStrainCheckIns());
    void contentRef.current?.scrollToTop(0);
    void load();
  }, [load, today]);

  useIonViewWillEnter(enterView);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const refreshAfterHistoryChange = () => {
      const activeLoad = activeLoadRef.current;
      if (activeLoad) {
        void activeLoad.finally(() => { void load(); });
        return;
      }
      void load();
    };
    window.addEventListener('runmate:cloud-data-updated', refreshAfterHistoryChange);
    return () => window.removeEventListener('runmate:cloud-data-updated', refreshAfterHistoryChange);
  }, [load]);
  useEffect(() => {
    const refreshCheckIns = () => setCheckIns(exportStrainCheckIns());
    window.addEventListener('runmate:strain-check-in-updated', refreshCheckIns);
    return () => window.removeEventListener('runmate:strain-check-in-updated', refreshCheckIns);
  }, []);

  const monthDates = useMemo(() => datesBetween(month, endOfMonth(month)), [month]);
  const days = useMemo(() => buildHealthCalendarDays(items, monthDates, checkIns), [checkIns, items, monthDates]);
  const daysByDate = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const selected = daysByDate.get(selectedDate) ?? buildHealthCalendarDays(items, [selectedDate], checkIns)[0];
  const insights = useMemo(() => buildHabitImpactInsights(items, checkIns), [checkIns, items]);
  const leadingEmpty = (weekdayIndex(month) + 6) % 7;
  const monthSummary = useMemo(() => ({
    recordedDays: days.filter(hasRecordedData).length,
    sleepDays: days.filter((day) => day.sleepMinutes != null).length,
    trainingDays: days.filter((day) => day.workoutCount > 0).length,
    mealDays: days.filter((day) => day.mealCount > 0).length,
  }), [days]);

  const changeMonth = (offset: number) => {
    const next = shiftMonths(month, offset);
    setMonth(next);
    setSelectedDate(next === startOfMonth(today) ? today : next);
  };
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="health-calendar-header"><IonToolbar>
      <button type="button" className="health-calendar-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Health Calendar</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent ref={contentRef} fullscreen className="health-calendar-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="health-calendar-shell">
        <header className="health-calendar-heading"><p>YOUR HEALTH PATTERNS</p><h1>See Your Month At A Glance</h1><span>Sleep, training, meals, and check-ins—together by day.</span></header>
        {loading && !dataReady && <PageDataSkeleton variant="summary" label="Loading Health Calendar" />}
        {dataReady && loading && <DataFreshnessStatus status="refreshing" detail="Refreshing your health history…" className="health-calendar-freshness" />}
        {dataReady && !loading && error && <DataFreshnessStatus status="fallback" label="Saved Data" detail="Refresh unavailable · Showing the last loaded calendar" onRetry={() => void load()} variant="panel" className="health-calendar-freshness" />}
        {dataReady && !loading && !error && historyLimited && <DataFreshnessStatus status="fallback" label="Recent History" detail={`Showing the newest ${HEALTH_CALENDAR_MAX_ROWS.toLocaleString()} records · Older months may be incomplete`} variant="panel" className="health-calendar-freshness" />}
        {!dataReady && !loading && error && <PageState kind="error" title="Calendar Data Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} />}
        {dataReady && <>
          <section className="health-calendar-card" aria-label="Monthly health calendar">
            <div className="health-calendar-month-nav"><button type="button" aria-label="Previous Month" onClick={() => changeMonth(-1)}><IonIcon icon={chevronBackOutline} /></button><strong>{formatMonth(month)}</strong><button type="button" aria-label="Next Month" onClick={() => changeMonth(1)} disabled={month >= startOfMonth(today)}><IonIcon icon={chevronForwardOutline} /></button></div>
            <div className="health-calendar-weekdays">{WEEKDAYS.map((day) => <span key={day}>{day}</span>)}</div>
            <div className="health-calendar-grid">
              {Array.from({ length: leadingEmpty }, (_, index) => <span className="health-calendar-empty" key={`empty-${index}`} />)}
              {days.map((day) => { const future = day.date > today; return <button type="button" key={day.date} className={`${day.date === selectedDate ? 'selected ' : ''}${day.date === today ? 'today ' : ''}${future ? 'future' : ''}`.trim()} aria-label={`${formatDayLabel(day.date)}${day.date === selectedDate ? ', selected' : ''}${future ? ', future date' : ''}`} aria-pressed={day.date === selectedDate} disabled={future} onClick={() => setSelectedDate(day.date)}><b>{Number(day.date.slice(8))}</b><span className="health-calendar-dots" aria-hidden="true">{day.sleepMinutes != null && <i className="sleep" />}{day.workoutCount > 0 && <i className="workout" />}{day.mealCount > 0 && <i className="meal" />}{day.stress != null && <i className="stress" />}</span></button>; })}
            </div>
            <div className="health-calendar-legend"><span><i className="sleep" />Sleep</span><span><i className="workout" />Training</span><span><i className="meal" />Meals</span><span><i className="stress" />Check-in</span></div>
            <div className="health-calendar-month-summary"><strong>{monthSummary.recordedDays}</strong><span>days with data</span><i /> <span>{monthSummary.sleepDays} sleep</span><i /> <span>{monthSummary.trainingDays} training</span><i /> <span>{monthSummary.mealDays} meal days</span></div>
          </section>

          <section className="health-day-card" aria-labelledby="selected-health-day">
            <div className="health-section-label">SELECTED DAY</div><h2 id="selected-health-day">{formatDayLabel(selectedDate)}</h2>
            <div className="health-day-metrics">
              <Metric icon={moonOutline} label="Sleep" value={selected?.sleepMinutes == null ? 'Not recorded' : duration(selected.sleepMinutes)} detail={sleepDetail(selected)} tone="sleep" />
              <Metric icon={fitnessOutline} label="Training" value={selected?.workoutCount ? `${selected.workoutCount} session${selected.workoutCount === 1 ? '' : 's'}` : 'No session'} detail={selected?.workoutMinutes ? `${selected.workoutMinutes} min${selected.distanceKm ? ` · ${selected.distanceKm} km` : ''}` : null} tone="workout" />
              <Metric icon={nutritionOutline} label="Meals" value={selected?.mealCount ? `${selected.mealCount} logged` : 'Not logged'} detail={selected?.lateCaffeineLogged ? 'Late caffeine log' : selected?.caffeineLogged ? 'Caffeine logged' : null} tone="meal" />
              <Metric icon={pulseOutline} label="Stress" value={selected?.stress ? title(selected.stress) : 'No check-in'} detail={null} tone="stress" />
            </div>
          </section>

          <section className="habit-impact-section" aria-labelledby="habit-impact-title">
            <div className="health-section-label">HABIT IMPACT INSIGHTS</div><h2 id="habit-impact-title">What May Be Shaping Your Sleep</h2><p className="habit-impact-intro">Associations from your logged data, not proof that a habit caused the outcome.</p>
            <div className="habit-impact-list">{insights.map((insight) => <article key={insight.key} className={`habit-impact-card ${insight.status}`}><div><span>{insight.confidence}</span><strong>{insight.title}</strong></div><h3>{insight.outcome}</h3><p>{insight.detail}</p><small>{insight.withHabitDays} habit days · {insight.comparisonDays} comparison days</small></article>)}</div>
          </section>
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function Metric({ icon, label, value, detail, tone }: { icon: string; label: string; value: string; detail: string | null; tone: string }) { return <div className={`health-day-metric ${tone}`}><header><span><IonIcon icon={icon} /></span><small>{label}</small></header><strong>{value}</strong>{detail && <em>{detail}</em>}</div>; }
function hasRecordedData(day: ReturnType<typeof buildHealthCalendarDays>[number]): boolean { return day.sleepMinutes != null || day.workoutCount > 0 || day.mealCount > 0 || day.stress != null; }
function sleepDetail(day: ReturnType<typeof buildHealthCalendarDays>[number] | undefined): string | null {
  if (!day || day.sleepMinutes == null) return null;
  return [day.sleepScore == null ? null : `Score ${Math.round(day.sleepScore)}`, day.restingHr == null ? null : `RHR ${Math.round(day.restingHr)}`, day.hrv == null ? null : `HRV ${Math.round(day.hrv)} ms`].filter(Boolean).join(' · ') || null;
}
function datesBetween(start: string, end: string): string[] { const dates: string[] = []; for (let date = start; date <= end; date = shiftDate(date, 1)) dates.push(date); return dates; }
function formatMonth(date: string): string { return new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
function formatDayLabel(date: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(new Date(`${date}T12:00:00+07:00`)); }
function duration(minutes: number): string { return `${Math.floor(minutes / 60)}h ${String(Math.round(minutes % 60)).padStart(2, '0')}m`; }
function title(value: string): string { return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
export default HealthCalendarPage;
