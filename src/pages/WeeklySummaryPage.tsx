import { useCallback, useEffect, useMemo, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { IonContent, IonHeader, IonIcon, IonPage, IonRefresher, IonRefresherContent, IonSpinner, IonTitle, IonToolbar, type RefresherEventDetail } from '@ionic/react';
import { arrowBackOutline, barbellOutline, bedOutline, fastFoodOutline, fitnessOutline, timeOutline } from 'ionicons/icons';
import { buildCoachContextFromSupabase, type CoachContext } from '@/lib/buildCoachContext';
import { buildWeeklyTrainingSummary } from '@/lib/weeklyTrainingSummary';
import { syncSamsungSleep } from '@/lib/samsungSleepSync';
import { syncSamsungWorkouts } from '@/lib/samsungWorkoutSync';
import './WeeklySummaryPage.css';

const WeeklySummaryPage: React.FC = () => {
  const history = useHistory();
  const [context, setContext] = useState<CoachContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await Promise.all([syncSamsungSleep('today'), syncSamsungWorkouts('today')]);
      setContext(await buildCoachContextFromSupabase());
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : 'Could Not Load Your Weekly Summary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  const summary = useMemo(() => context ? buildWeeklyTrainingSummary(context) : null, [context]);
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
            <div className="weekly-section-heading"><div><p>Training Load</p><h2 id="weekly-training-heading">Movement At A Glance</h2></div><IonIcon icon={fitnessOutline} /></div>
            <div className="weekly-primary-metrics">
              <Metric value={String(summary.sessions)} label="Sessions" />
              <Metric value={`${formatNumber(summary.distanceKm)} km`} label="Running" />
              <Metric value={formatMinutes(summary.activeMinutes)} label="Active Time" />
            </div>
            <p className="weekly-data-note">Recorded across {summary.activeDays} active {summary.activeDays === 1 ? 'day' : 'days'}.</p>
          </section>

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

export default WeeklySummaryPage;
