import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barbellOutline, bedOutline, checkmarkCircleOutline, chevronDownOutline, fastFoodOutline, fitnessOutline, pulseOutline, timeOutline } from 'ionicons/icons';
import type { CoachContext } from '@/lib/buildCoachContext';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { buildWeeklyTrainingSummary } from '@/lib/weeklyTrainingSummary';
import { syncSamsungSleep } from '@/lib/samsungSleepSync';
import { syncSamsungWorkouts } from '@/lib/samsungWorkoutSync';
import { loadActiveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { buildTrainingAdherenceHistory, type TrainingAdherenceWeek } from '@/lib/trainingAdherence';
import { restingHeartRateBaseline } from '@/lib/hrZones';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { buildWorkoutLoadTrend } from '@/lib/workoutLoadTrend';
import './WeeklySummaryPage.css';

const WeeklySummaryPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [adherenceWeeks, setAdherenceWeeks] = useState<TrainingAdherenceWeek[]>([]);
  const [workoutItems, setWorkoutItems] = useState<LocalHistoryItem[]>([]);
  const [openAdherenceWeek, setOpenAdherenceWeek] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([syncSamsungSleep('today'), syncSamsungWorkouts('today')]);
      const [nextContext, race, workoutHistory] = await Promise.all([buildCoachContextFromSupabase(), loadActiveRaceGoalAndPlan(), loadHistoryItems(['workout', 'strength'])]);
      const canonicalWorkouts = workoutHistory.ok ? dedupeWorkoutItems(workoutHistory.items) : [];
      setContext(nextContext);
      setWorkoutItems(canonicalWorkouts);
      setAdherenceWeeks(race.ok && race.plan ? buildTrainingAdherenceHistory(race.plan, canonicalWorkouts, nextContext.todayDate, 4) : []);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Load Your Weekly Summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const summary = useMemo(() => context ? buildWeeklyTrainingSummary(context) : null, [context]);
  const loadTrend = useMemo(() => {
    if (!context) return null;
    const profile = context.profile ?? {};
    const maxHr = finiteNumber(profile.maxHr);
    const restingHr = restingHeartRateBaseline(context.sleepHistory.slice(0, 14).map((night) => night.restingHR)) ?? finiteNumber(profile.normalRestingHr);
    return buildWorkoutLoadTrend({ items: workoutItems, todayDate: context.todayDate, maxHr, restingHr });
  }, [context, workoutItems]);
  const refresh = async (event: CustomEvent<RefresherEventDetail>) => { await load(); event.detail.complete(); };

  return <IonPage>
    <IonHeader translucent className="weekly-header"><IonToolbar>
      <button type="button" className="weekly-back" aria-label="Back To More" onClick={() => history.goBack()}><IonIcon icon={arrowBackOutline} /></button>
      <IonTitle>Weekly Summary</IonTitle>
    </IonToolbar></IonHeader>
    <IonContent fullscreen className="weekly-content">
      <IonRefresher slot="fixed" onIonRefresh={refresh}><IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" /></IonRefresher>
      <main className="weekly-shell">
        <header className="weekly-heading"><p>Last 7 Days</p><h1>Your Training Week</h1><span>A factual summary of sleep, workouts, and meals logged in RunMate.</span></header>
        {loading && <div className="weekly-state"><IonSpinner name="crescent" /><p>Building Your Summary…</p></div>}
        {!loading && error && <div className="weekly-state weekly-error"><p>{error}</p><button type="button" onClick={() => void load()}>Try Again</button></div>}
        {!loading && summary && <>
          <section className="weekly-hero" aria-labelledby="weekly-training-heading">
            <div className="weekly-section-heading"><div><p>Training Volume</p><h2 id="weekly-training-heading">Movement At A Glance</h2></div><IonIcon icon={fitnessOutline} /></div>
            <div className="weekly-primary-metrics">
              <Metric value={String(summary.sessions)} label="Sessions" />
              <Metric value={`${formatNumber(summary.distanceKm)} km`} label="Running" />
              <Metric value={formatMinutes(summary.activeMinutes)} label="Active Time" />
            </div>
            <p className="weekly-data-note">Recorded across {summary.activeDays} active {summary.activeDays === 1 ? 'day' : 'days'}.</p>
          </section>

          {loadTrend && <section className="weekly-card weekly-load-card" aria-labelledby="weekly-load-heading">
            <div className="weekly-section-heading"><div><p>Measured Intensity</p><h2 id="weekly-load-heading">Workout Load</h2></div><IonIcon icon={pulseOutline} /></div>
            <div className="weekly-load-summary">
              <div><strong>{loadTrend.total ?? '—'}</strong><span>{loadTrend.total == null ? '7-Day Total' : 'Load Points · 7-Day Total'}</span></div>
              <div className={`weekly-load-status status-${loadTrend.status.toLowerCase().replaceAll(' ', '-')}`}><em>Estimated</em><strong>{loadStatusLabel(loadTrend.status)}</strong></div>
            </div>
            <div className="weekly-load-chart" role="img" aria-label={loadChartLabel(loadTrend.days)}>
              {loadTrend.days.map((day) => {
                const max = Math.max(1, ...loadTrend.days.map((value) => value.load ?? 0));
                return <div className={`weekly-load-day${day.load != null ? ' has-load' : day.sessions ? ' needs-data' : ''}`} key={day.date}>
                  <div><i style={{ height: day.load != null ? `${Math.max(8, (day.load / max) * 100)}%` : undefined }} /></div>
                  <strong>{day.load ?? (day.sessions ? '—' : '')}</strong><span>{formatWeekday(day.date)}</span>
                </div>;
              })}
            </div>
            <div className="weekly-load-context"><strong>{loadComparison(loadTrend.changePercentage)}</strong><span>{loadTrend.measuredSessions} Of {loadTrend.sessions} Sessions Included</span></div>
            <p className="weekly-data-note">Calculated only from sessions with at least 50% measured HR coverage. It does not change Recovery or your Training Plan.</p>
          </section>}

          {adherenceWeeks.some((week) => week.planAvailable) && <section className="weekly-card weekly-adherence" aria-labelledby="weekly-adherence-heading">
            <div className="weekly-section-heading"><div><p>Plan Follow-Through</p><h2 id="weekly-adherence-heading">Training Adherence</h2></div><IonIcon icon={checkmarkCircleOutline} /></div>
            <div className="weekly-adherence-current">
              <div><strong>{adherenceWeeks[0]?.percentage ?? 0}%</strong><span>This Week</span></div>
              <p>{adherenceWeeks[0]?.planned ? `${adherenceWeeks[0].completed + adherenceWeeks[0].modified} Of ${adherenceWeeks[0].planned} Sessions Done` : 'No active sessions are planned this week.'}</p>
            </div>
            <div className="weekly-adherence-track"><i style={{ width: `${adherenceWeeks[0]?.percentage ?? 0}%` }} /></div>
            <div className="weekly-adherence-history">
              {adherenceWeeks.map((week, index) => ({ week, index })).filter(({ week, index }) => index === 0 || week.planAvailable).map(({ week, index }) => <div className={`weekly-adherence-week${openAdherenceWeek === index ? ' open' : ''}`} key={week.weekStart}>
                <button type="button" disabled={!week.planAvailable} aria-expanded={openAdherenceWeek === index} onClick={() => setOpenAdherenceWeek((open) => open === index ? null : index)}>
                  <span><strong>{index === 0 ? 'View This Week' : week.label}</strong><small>{`${week.completed} Completed · ${week.modified} Adjusted · ${week.missed} Missed`}</small></span>
                  <em>{index === 0 ? 'Sessions' : `${week.percentage}%`}</em><IonIcon icon={chevronDownOutline} />
                </button>
                {openAdherenceWeek === index && <div className="weekly-adherence-details">
                  {week.days.filter((day) => day.status !== 'recovery').map((day, dayIndex) => <div key={`${day.date}-${dayIndex}`}><span>{formatShortDate(day.date)}</span><strong>{day.workout.workoutType}</strong><em className={`status-${day.status}`}>{adherenceLabel(day.status)}</em></div>)}
                </div>}
              </div>)}
            </div>
            {!adherenceWeeks.slice(1).some((week) => week.planAvailable) && <p className="weekly-adherence-empty-history">Previous weeks will appear after you complete another week of this plan.</p>}
            <p className="weekly-data-note">Rest and Recovery days are not counted toward adherence.</p>
          </section>}

          <section className="weekly-card" aria-labelledby="weekly-recovery-heading">
            <div className="weekly-section-heading"><div><p>Recovery Base</p><h2 id="weekly-recovery-heading">Sleep Consistency</h2></div><IonIcon icon={bedOutline} /></div>
            <div className="weekly-inline-stats"><Metric value={summary.sleepAverageHours === null ? '—' : `${formatNumber(summary.sleepAverageHours)} h`} label="Average Sleep" /><Metric value={String(summary.sleepNights)} label="Nights Logged" /></div>
            <p className="weekly-data-note">Averages include only sleep records available this week.</p>
          </section>

          <section className="weekly-card" aria-labelledby="weekly-nutrition-heading">
            <div className="weekly-section-heading"><div><p>Nutrition Logs</p><h2 id="weekly-nutrition-heading">Meals This Week</h2></div><IonIcon icon={fastFoodOutline} /></div>
            <div className="weekly-inline-stats"><Metric value={String(summary.mealCount)} label="Meals Logged" /><Metric value={`${summary.mealDays} / 7`} label="Days Logged" /></div>
            <div className="weekly-nutrition-line"><span>Average Per Logged Day</span><strong>{summary.averageCaloriesPerLoggedDay === null ? '—' : `${summary.averageCaloriesPerLoggedDay} kcal`} · {summary.averageProteinPerLoggedDay === null ? '—' : `${summary.averageProteinPerLoggedDay} g protein`}</strong></div>
          </section>

          {summary.trainingMix.length > 0 && <section className="weekly-card" aria-labelledby="weekly-mix-heading">
            <div className="weekly-section-heading"><div><p>Training Mix</p><h2 id="weekly-mix-heading">How You Trained</h2></div><IonIcon icon={barbellOutline} /></div>
            <div className="weekly-mix-list">{summary.trainingMix.map((item) => <div key={item.label}><span>{item.label}</span><strong>{item.sessions} {item.sessions === 1 ? 'Session' : 'Sessions'}</strong></div>)}</div>
          </section>}
          <footer className="weekly-footer"><IonIcon icon={timeOutline} /><span>Pull to refresh today’s Samsung Health data.</span></footer>
        </>}
      </main>
    </IonContent>
  </IonPage>;
};

function Metric({ value, label }: { value: string; label: string }) { return <div className="weekly-metric"><strong>{value}</strong><span>{label}</span></div>; }
function formatNumber(value: number): string { return new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 }).format(value); }
function formatMinutes(minutes: number): string { if (!minutes) return '0 min'; const hours = Math.floor(minutes / 60); const rest = Math.round(minutes % 60); return hours ? `${hours}h ${rest}m` : `${rest} min`; }
function formatShortDate(value: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function adherenceLabel(status: TrainingAdherenceWeek['days'][number]['status']): string { return ({ completed: 'Completed', modified: 'Adjusted', missed: 'Missed', upcoming: 'Upcoming', recovery: 'Support' })[status]; }
function finiteNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function formatWeekday(value: string): string { return new Intl.DateTimeFormat('en-US', { weekday: 'narrow', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`)); }
function loadComparison(change: number | null): string { if (change == null) return 'Building Your Baseline'; if (change === 0) return 'Same As Previous 7 Days'; return `${Math.abs(change)}% ${change > 0 ? 'Higher' : 'Lower'} Than Previous 7 Days`; }
function loadStatusLabel(status: ReturnType<typeof buildWorkoutLoadTrend>['status']): string { return status === 'Starting Point' ? 'Baseline In Progress' : status; }
function loadChartLabel(days: Array<{ date: string; load: number | null; sessions: number }>): string { return days.map((day) => `${day.date}: ${day.load == null ? day.sessions ? 'insufficient HR coverage' : 'no workout' : `${day.load} load points`}`).join('; '); }

export default WeeklySummaryPage;
