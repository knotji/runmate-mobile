import { useMemo, useState, useTransition } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barbellOutline, bedOutline, calendarClearOutline, checkmarkCircleOutline, chevronBackOutline, chevronForwardOutline, fastFoodOutline, fitnessOutline, pulseOutline, shareSocialOutline, timeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { useCoachContextStore } from '@/lib/context/coachContextStore';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { buildCalendarTrainingSummary } from '@/lib/weeklyTrainingSummary';
import { syncTodayHealth } from '@/lib/healthSyncService';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { restingHeartRateBaseline } from '@/lib/hrZones';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutLoadTrend, type WorkoutLoadTrend } from '@/lib/workoutLoadTrend';
import { calculateTrainingStressBalance } from '@/lib/trainingLoadAnalytics';
import { navigateBackOr } from '@/lib/navigationBack';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { loadRecoveryContextStartupSnapshot } from '@/lib/recoveryStartupCache';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { daysBetween, endOfMonth, shiftDate, shiftMonths, startOfMonth, weekdayIndex } from '@/lib/date';
import { buildPeriodAdherence, buildPeriodTrainingSummary, buildWeeklyRecapHighlights, type RecapPeriod } from '@/lib/weeklyRecapHighlights';
import type { RacePlan } from '@/types/race';
import { loadWeeklySummaryHistorySnapshot, saveWeeklySummaryHistorySnapshot } from '@/lib/weeklySummaryStartupCache';
import { buildRecoveryTrend } from '@/lib/recoveryTrends';
import { SocialShareModal } from '@/components/SocialShareModal';
import './WeeklySummaryPage.css';

type CalendarRange = { start: string; end: string };

const WeeklySummaryPage: React.FC = () => {
  const history = useHistory();
  const context = useCoachContextStore((state) => state.context);
  const [startupContext] = useState(() => loadRecoveryContextStartupSnapshot());
  const visibleContext = context ?? startupContext;
  const [startupHistory] = useState(() => loadWeeklySummaryHistorySnapshot());
  const [period, setPeriod] = useState<RecapPeriod>('week');
  const [requestedPeriod, setRequestedPeriod] = useState<RecapPeriod>('week');
  const [offset, setOffset] = useState(0);
  const [historyItems, setHistoryItems] = useState<LocalHistoryItem[]>(startupHistory ?? []);
  const [historyReady, setHistoryReady] = useState(startupHistory !== null);
  const [shareOpen, setShareOpen] = useState(false);
  const [periodChanging, startPeriodTransition] = useTransition();

  const { loading, error, reload: load } = useAsyncLoad(async (forceSync) => {
    if (forceSync) await syncTodayHealth(true);
    const contextPromise = forceSync || !visibleContext
      ? buildCoachContextFromSupabase()
      : Promise.resolve(visibleContext);
    const [, result] = await measurePerformanceDiagnostic(
      'weekly_summary',
      () => Promise.all([
        contextPromise,
        loadHistoryItems(['workout', 'strength', 'sleep', 'meal']),
      ]),
      () => ({ variant: startupHistory ? 'prepared' : 'live', detail: startupHistory ? 'Cached summary shown while history refreshed' : 'Calendar summary history prepared' }),
    );
    if (!result.ok) throw new Error(result.error);
    const workouts = dedupeWorkoutItems(result.items.filter((item) => item.type === 'workout' || item.type === 'strength'));
    const nextItems = [...workouts, ...result.items.filter((item) => item.type === 'sleep' || item.type === 'meal')];
    setHistoryItems(nextItems);
    saveWeeklySummaryHistorySnapshot(nextItems);
    setHistoryReady(true);
  }, 'Could Not Load Your Training Summary.');

  const range = useMemo(
    () => visibleContext ? calendarPeriodRange(period, offset, visibleContext.todayDate) : null,
    [offset, period, visibleContext],
  );
  const summary = useMemo(
    () => range && historyReady ? buildCalendarTrainingSummary(historyItems, range.start, range.end) : null,
    [historyItems, historyReady, range],
  );
  const adherence = useMemo(() => {
    if (!visibleContext || !range || !historyReady) return null;
    return buildPeriodAdherence(visibleContext.racePlan as RacePlan | null, historyItems, range.start, range.end, visibleContext.todayDate);
  }, [historyItems, historyReady, range, visibleContext]);
  const loadTrend = useMemo(() => {
    if (!visibleContext || !range || !historyReady) return null;
    const profile = visibleContext.profile ?? {};
    const maxHr = finiteNumber(profile.maxHr);
    const restingHr = restingHeartRateBaseline(visibleContext.sleepHistory.slice(0, 14).map((night) => night.restingHR)) ?? finiteNumber(profile.normalRestingHr);
    return buildWorkoutLoadTrend({ items: historyItems, todayDate: visibleContext.todayDate, periodStart: range.start, periodEnd: range.end, maxHr, restingHr });
  }, [historyItems, historyReady, range, visibleContext]);
  const tsbData = useMemo(() => {
    if (!visibleContext || !historyReady || offset !== 0) return null;
    return calculateTrainingStressBalance(historyItems, visibleContext.profile ?? null, visibleContext.todayDate);
  }, [historyItems, historyReady, offset, visibleContext]);
  const shareHighlights = useMemo(() => {
    if (!shareOpen || !visibleContext || !range || !historyReady || !adherence) return null;
    const analysisEnd = range.end > visibleContext.todayDate ? visibleContext.todayDate : range.end;
    const elapsedDays = Math.max(1, daysBetween(range.start, analysisEnd) + 1);
    const { points, insight } = buildRecoveryTrend(historyItems, visibleContext.profile ?? null, elapsedDays, analysisEnd);
    return buildWeeklyRecapHighlights({
      period,
      periodStart: range.start,
      periodEnd: range.end,
      summary: buildPeriodTrainingSummary(historyItems, range.start, range.end),
      adherence,
      recoveryPoints: points,
      recoveryInsight: insight,
    });
  }, [adherence, historyItems, historyReady, period, range, shareOpen, visibleContext]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await load(true);
    event.detail.complete();
  };
  const selectPeriod = (next: RecapPeriod) => {
    if (next === requestedPeriod) return;
    setRequestedPeriod(next);
    startPeriodTransition(() => {
      setPeriod(next);
      setOffset(0);
    });
  };
  const movePeriod = (nextOffset: number) => {
    if (nextOffset === offset) return;
    startPeriodTransition(() => setOffset(nextOffset));
  };

  return <IonPage>
    <IonHeader translucent className="weekly-header"><IonToolbar>
      <button type="button" className="weekly-back" aria-label="Back To Move" onClick={() => navigateBackOr(history, '/tabs/move')}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Training Summary</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="weekly-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="weekly-shell">
        <header className="weekly-heading"><p>Training History</p><h1>Week And Month At A Glance</h1><span>Calendar-aligned sleep, workouts, and meals logged in RunMate.</span></header>

        <div className="weekly-period-toggle" role="group" aria-label="Summary period">
          <button type="button" className={requestedPeriod === 'week' ? 'active' : ''} aria-pressed={requestedPeriod === 'week'} onClick={() => selectPeriod('week')}>Week</button>
          <button type="button" className={requestedPeriod === 'month' ? 'active' : ''} aria-pressed={requestedPeriod === 'month'} onClick={() => selectPeriod('month')}>Month</button>
        </div>
        <nav className="weekly-period-nav" aria-label={`Choose ${period}`}>
          <button type="button" aria-label={`Previous ${period}`} onClick={() => movePeriod(offset + 1)}><IonIcon icon={chevronBackOutline} /></button>
          <span><IonIcon icon={calendarClearOutline} />{range ? formatPeriodRange(range.start, range.end) : '—'}</span>
          <button type="button" aria-label={`Next ${period}`} disabled={offset === 0} onClick={() => movePeriod(Math.max(0, offset - 1))}><IonIcon icon={chevronForwardOutline} /></button>
        </nav>
        <div className={`weekly-period-loading${periodChanging ? ' visible' : ''}`} role="status" aria-live="polite">
          {periodChanging && <><IonSpinner name="crescent" /><span>Updating {requestedPeriod === 'week' ? 'Week' : 'Month'}…</span></>}
        </div>

        <div className="weekly-summary-actions">
          <button type="button" className="weekly-share-link" disabled={!historyReady || periodChanging} onClick={() => setShareOpen(true)}>
            <span><small>Selected {period}</small><strong>Share This {period === 'week' ? 'Week' : 'Month'}</strong></span><IonIcon icon={shareSocialOutline} />
          </button>
        </div>
        {loading && !historyReady && <PageDataSkeleton variant="summary" label="Building Your Summary" />}
        {!historyReady && error && <PageState kind="error" title="Summary Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="weekly-state weekly-error" />}

        <div className={periodChanging ? 'weekly-results is-updating' : 'weekly-results'} aria-busy={periodChanging}>
        {summary && range && <>
          <section className="weekly-hero" aria-labelledby="weekly-training-heading">
            <SectionHeading eyebrow="Training Volume" title="Movement At A Glance" id="weekly-training-heading" icon={fitnessOutline} />
            <div className="weekly-primary-metrics">
              <Metric value={String(summary.sessions)} label="Sessions" />
              <Metric value={`${formatNumber(summary.distanceKm)} km`} label="Running" />
              <Metric value={formatMinutes(summary.activeMinutes)} label="Active Time" />
            </div>
            <p className="weekly-data-note">Recorded across {summary.activeDays} active {summary.activeDays === 1 ? 'day' : 'days'}.</p>
          </section>

          {loadTrend && <section className="weekly-card weekly-load-card" aria-labelledby="weekly-load-heading">
            <SectionHeading eyebrow="Measured Intensity" title="Workout Load" id="weekly-load-heading" icon={pulseOutline} />
            <div className="weekly-load-summary">
              <div><strong>{loadTrend.total ?? '—'}</strong><span>{loadTrend.total == null ? 'Period Total' : `Load Points · ${period === 'week' ? 'Week' : 'Month'} Total`}</span></div>
              <div className={`weekly-load-status status-${loadTrend.status.toLowerCase().replaceAll(' ', '-')}`}><em>Estimated</em><strong>{loadStatusLabel(loadTrend.status)}</strong></div>
            </div>
            <div className={`weekly-load-chart period-${period}`} role="img" aria-label={loadChartLabel(loadTrend.days)}>
              {loadTrend.days.map((day) => {
                const max = Math.max(1, ...loadTrend.days.map((value) => value.load ?? 0));
                return <div className={`weekly-load-day${day.load != null ? ' has-load' : day.sessions ? ' needs-data' : ''}`} key={day.date}>
                  <div><i style={{ height: day.load != null ? `${Math.max(8, (day.load / max) * 100)}%` : undefined }} /></div>
                  <strong>{day.load ?? (day.sessions ? '—' : '')}</strong><span>{period === 'week' ? formatWeekday(day.date) : formatMonthDay(day.date)}</span>
                </div>;
              })}
            </div>
            <div className="weekly-load-context"><strong>{loadComparison(loadTrend.changePercentage, period)}</strong><span>{loadTrend.measuredSessions} Of {loadTrend.sessions} Sessions Included</span></div>
            <p className="weekly-data-note">Calculated only from sessions with at least 50% measured HR coverage. It does not change Recovery or your Training Plan.</p>
          </section>}

          {tsbData && <section className="weekly-card weekly-tsb-card">
            <SectionHeading eyebrow="Current Fitness Vs Fatigue" title="Training Stress Balance" icon={pulseOutline} />
            <div className="weekly-inline-stats weekly-triple-stats">
              <Metric value={String(tsbData.fatigue.ctl)} label="Fitness (42d CTL)" />
              <Metric value={String(tsbData.fatigue.atl)} label="Fatigue (7d ATL)" />
              <Metric value={`${tsbData.fatigue.tsb > 0 ? '+' : ''}${tsbData.fatigue.tsb}`} label="Stress Balance" />
            </div>
            <div className="weekly-load-context"><strong>{tsbData.fatigue.label}</strong></div>
            <p className="weekly-data-note">{tsbData.fatigue.summary}</p>
          </section>}

          {adherence && adherence.planned > 0 && <section className="weekly-card weekly-adherence" aria-labelledby="weekly-adherence-heading">
            <SectionHeading eyebrow="Plan Follow-Through" title="Training Adherence" id="weekly-adherence-heading" icon={checkmarkCircleOutline} />
            <div className="weekly-adherence-current">
              <div><strong>{adherence.percentage}%</strong><span>Selected {period === 'week' ? 'Week' : 'Month'}</span></div>
              <p>{adherence.completed + adherence.modified} Of {adherence.planned} Sessions Done</p>
            </div>
            <div className="weekly-adherence-track"><i style={{ width: `${adherence.percentage}%` }} /></div>
            <div className="weekly-adherence-totals"><span>{adherence.completed} Completed</span><span>{adherence.modified} Adjusted</span><span>{adherence.missed} Missed</span></div>
            <p className="weekly-data-note">Rest and Recovery days are not counted toward adherence.</p>
          </section>}

          <section className="weekly-card" aria-labelledby="weekly-recovery-heading">
            <SectionHeading eyebrow="Recovery Base" title="Sleep Consistency" id="weekly-recovery-heading" icon={bedOutline} />
            <div className="weekly-inline-stats"><Metric value={summary.sleepAverageHours === null ? '—' : `${formatNumber(summary.sleepAverageHours)} h`} label="Average Sleep" /><Metric value={String(summary.sleepNights)} label="Nights Logged" /></div>
            <p className="weekly-data-note">Average includes only Sleep records in the selected {period}.</p>
          </section>

          <section className="weekly-card" aria-labelledby="weekly-nutrition-heading">
            <SectionHeading eyebrow="Nutrition Logs" title={`Meals This ${period === 'week' ? 'Week' : 'Month'}`} id="weekly-nutrition-heading" icon={fastFoodOutline} />
            <div className="weekly-inline-stats"><Metric value={String(summary.mealCount)} label="Meals Logged" /><Metric value={`${summary.mealDays} / ${daysBetween(range.start, range.end) + 1}`} label="Days Logged" /></div>
            <div className="weekly-nutrition-line"><span>Average Per Logged Day</span><strong>{summary.averageCaloriesPerLoggedDay === null ? '—' : `${summary.averageCaloriesPerLoggedDay} kcal`} · {summary.averageProteinPerLoggedDay === null ? '—' : `${summary.averageProteinPerLoggedDay} g protein`}</strong></div>
          </section>

          {summary.trainingMix.length > 0 && <section className="weekly-card" aria-labelledby="weekly-mix-heading">
            <SectionHeading eyebrow="Training Mix" title="How You Trained" id="weekly-mix-heading" icon={barbellOutline} />
            <div className="weekly-mix-list">{summary.trainingMix.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.sessions} {item.sessions === 1 ? 'Session' : 'Sessions'}</strong></div>)}</div>
          </section>}
          <footer className="weekly-footer"><IonIcon icon={timeOutline} /><span>Pull to refresh today’s Samsung Health data.</span></footer>
        </>}
        </div>
      </main>
    </IonContent>
    <SocialShareModal isOpen={shareOpen} onDismiss={() => setShareOpen(false)} mode="weekly" weeklyData={shareHighlights} />
  </IonPage>;
};

function SectionHeading({ eyebrow, title, icon, id }: { eyebrow: string; title: string; icon: string; id?: string }) {
  return <div className="weekly-section-heading"><div><p>{eyebrow}</p><h2 id={id}>{title}</h2></div><IonIcon icon={icon} /></div>;
}
function Metric({ value, label }: { value: string; label: string }) { return <div className="weekly-metric"><strong>{value}</strong><span>{label}</span></div>; }
function calendarPeriodRange(period: RecapPeriod, offset: number, today: string): CalendarRange {
  if (period === 'week') {
    const monday = shiftDate(today, -((weekdayIndex(today) + 6) % 7));
    const start = shiftDate(monday, -7 * offset);
    return { start, end: shiftDate(start, 6) };
  }
  const start = shiftMonths(startOfMonth(today), -offset);
  return { start, end: endOfMonth(start) };
}
function formatPeriodRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00Z`);
  const endDate = new Date(`${end}T12:00:00Z`);
  const sameMonth = start.slice(0, 7) === end.slice(0, 7);
  const first = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(startDate);
  const last = new Intl.DateTimeFormat('en-US', { month: sameMonth ? undefined : 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }).format(endDate);
  return `${first} – ${last}`;
}
function formatNumber(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); }
function formatMinutes(minutes: number): string { if (!minutes) return '0 min'; const hours = Math.floor(minutes / 60); const rest = Math.round(minutes % 60); return hours ? `${hours}h ${rest}m` : `${rest} min`; }
function finiteNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function formatWeekday(value: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function formatMonthDay(value: string): string { const day = Number(value.slice(-2)); return day === 1 || day % 5 === 0 ? String(day) : ''; }
function loadComparison(change: number | null, period: RecapPeriod): string { if (change == null) return 'Building Your Baseline'; if (change === 0) return `Same As Previous ${period === 'week' ? 'Week' : 'Month'}`; return `${Math.abs(change)}% ${change > 0 ? 'Higher' : 'Lower'} Than Previous ${period === 'week' ? 'Week' : 'Month'}`; }
function loadStatusLabel(status: WorkoutLoadTrend['status']): string { return status === 'Starting Point' ? 'Baseline In Progress' : status; }
function loadChartLabel(days: WorkoutLoadTrend['days']): string { return days.map((day) => `${day.date}: ${day.load == null ? day.sessions ? 'insufficient HR coverage' : 'no workout' : `${day.load} load points`}`).join('; '); }

export default WeeklySummaryPage;
