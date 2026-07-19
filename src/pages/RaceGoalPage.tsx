import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import {
  IonButton,
  IonAlert,
  IonContent,
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
import { arrowBackOutline, calendarClearOutline, chevronDownOutline, chevronForwardOutline, closeOutline, flagOutline, refreshOutline } from 'ionicons/icons';
import { todayBangkokDateKey } from '@/lib/date';
import { buildMobileRaceSummary, formatRaceWorkoutMetric, isRaceWorkoutToday } from '@/lib/mobileRaceGoal';
import { loadActiveRaceGoalAndPlan, saveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadRaceResults } from '@/lib/raceResults';
import { buildCoachContextFromSupabase } from '@/lib/buildCoachContext';
import { generateRacePlan } from '@/lib/racePlanGeneration';
import { translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';
import type { RaceGoal, RacePlan, RaceResult, WeekWorkout } from '@/types/race';
import RaceGoalEditor from '@/components/RaceGoalEditor';
import './RaceGoalPage.css';

const RaceGoalPage: React.FC = () => {
  const history = useHistory();
  const [goal, setGoal] = useState<RaceGoal | null>(null);
  const [plan, setPlan] = useState<RacePlan | null>(null);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<WeekWorkout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    setHistoryError(null);
    const [result, completed] = await Promise.all([loadActiveRaceGoalAndPlan(), loadRaceResults(20)]);
    if (result.ok) {
      setGoal(result.goal);
      setPlan(result.plan);
    } else {
      setError(result.error);
    }
    if (completed.ok) setRaceResults(completed.results);
    else setHistoryError(completed.error);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await load();
    event.detail.complete();
  };

  const today = todayBangkokDateKey();
  const summary = goal ? buildMobileRaceSummary(goal, plan, today) : null;
  const progress = summary?.currentWeek && summary.totalWeeks ? Math.round(summary.currentWeek / summary.totalWeeks * 100) : 0;

  const refreshPlan = async () => {
    if (!goal || refreshingPlan) return;
    setRefreshingPlan(true); setRefreshError(null);
    try {
      const context = await buildCoachContextFromSupabase();
      const nextPlan = await generateRacePlan(goal, context);
      const saved = await saveRaceGoalAndPlan(goal, nextPlan);
      if (!saved.ok) throw new Error(saved.error);
      setGoal(saved.goal);
      setPlan(saved.plan);
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : 'Could Not Refresh This Plan. Please Try Again.');
    } finally {
      setRefreshingPlan(false);
    }
  };

  return (
    <IonPage>
      <IonHeader translucent className="race-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Back To More" onClick={() => history.push('/tabs/more')}>
            <IonIcon slot="icon-only" icon={arrowBackOutline} />
          </IonButton>
          <IonTitle>Race Goal</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen className="race-content">
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Pull to refresh" refreshingText="Refreshing…" />
        </IonRefresher>
        <main className="race-shell">
          {loading && <div className="race-state"><IonSpinner name="crescent" /><p>Loading Race Goal…</p></div>}
          {!loading && error && <div className="race-state race-error"><p>{error}</p><IonButton fill="outline" onClick={() => void load()}><IonIcon slot="start" icon={refreshOutline} />Try Again</IonButton></div>}
          {!loading && !error && !goal && (
            <section className="race-empty">
              <div><IonIcon icon={flagOutline} /></div>
              <p>Race Planning</p>
              <h1>No Active Race Goal</h1>
              <span>Set your race details and RunMate will build a fresh training plan from your latest data.</span>
              <IonButton onClick={() => setEditorOpen(true)}>Create Race Goal</IonButton>
            </section>
          )}
          {!loading && !error && goal && summary && (
            <>
              <section className="race-hero">
                <div className="race-hero-topline"><span>ACTIVE RACE</span><strong>{summary.daysRemaining === 0 ? 'Race Day' : `${summary.daysRemaining} Days`}</strong></div>
                <h1>{goal.raceName}</h1>
                <p><IonIcon icon={calendarClearOutline} />{formatRaceDate(goal.raceDate)} · {goal.raceDistance}</p>
                <div className="race-targets">
                  <RaceMetric label="Target Time" value={goal.targetTime ?? 'Finish Strong'} />
                  <RaceMetric label="Target Pace" value={summary.targetPace ?? 'Not Set'} />
                  <RaceMetric label="Weeks Left" value={String(summary.weeksRemaining)} />
                </div>
                <button type="button" className="race-edit-goal" onClick={() => setEditorOpen(true)}>Edit Goal</button>
              </section>

              {plan ? (
                <section className="race-section">
                  <header className="race-section-heading"><div><p>PLAN PROGRESS</p><h2>Your Training Build</h2></div><span>{progress}%</span></header>
                  <div className="race-progress"><i style={{ width: `${progress}%` }} /></div>
                  <div className="race-progress-facts">
                    <RaceMetric label="Current Week" value={summary.currentWeek && summary.totalWeeks ? `${summary.currentWeek} Of ${summary.totalWeeks}` : '—'} />
                    <RaceMetric label="Phase" value={summary.phase ?? 'Not Set'} />
                    <RaceMetric label="This Week" value={`${summary.scheduledSessions} Sessions`} />
                    <RaceMetric label="Planned Distance" value={summary.scheduledDistanceKm > 0 ? `${summary.scheduledDistanceKm} km` : 'Flexible'} />
                  </div>
                  <div className="race-plan-refresh">
                    <span>{formatPlanUpdated(plan.updatedAt ?? plan.createdAt)}</span>
                    <button type="button" disabled={refreshingPlan} onClick={() => setRefreshConfirmOpen(true)}>{refreshingPlan && <IonSpinner name="crescent" />}{refreshingPlan ? 'Refreshing…' : 'Refresh Plan'}</button>
                  </div>
                  {refreshError && <div className="race-refresh-error" role="alert">{refreshError}</div>}
                </section>
              ) : (
                <section className="race-plan-missing"><p>TRAINING PLAN</p><h2>No Plan Available Yet</h2><span>Your Race Goal is active, but no linked training plan was found.</span></section>
              )}

              {summary.workouts.length > 0 && (
                <section className="race-week">
                  <header className="race-section-heading"><div><p>THIS WEEK</p><h2>Upcoming Sessions</h2></div></header>
                  <div className="race-week-list">
                    {summary.workouts.map((workout, index) => {
                      const isToday = isRaceWorkoutToday(workout, today);
                      return (
                      <button type="button" className={`race-workout${isToday ? ' race-workout-today' : ''}`} key={`${workout.day}-${index}`} onClick={() => setSelectedWorkout(workout)} aria-label={`View ${workout.workoutType} Details`}>
                        <span>{shortDay(workout.day)}</span>
                        <div><strong>{workout.workoutType}</strong><small>{formatRaceWorkoutMetric(workout) || (/rest|พัก/i.test(workout.workoutType) ? 'Recovery Day' : 'Follow The Planned Session')}</small></div>
                        <span className="race-workout-action">{isToday && <em>Today</em>}<IonIcon icon={chevronForwardOutline} /></span>
                      </button>
                      );
                    })}
                  </div>
                </section>
              )}
            </>
          )}
          {!loading && !error && (raceResults.length > 0 || historyError) && (
            <section className={`race-history${historyOpen ? ' race-history-open' : ''}`}>
              <button type="button" className="race-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
                <div><p>RACE HISTORY</p><h2>Completed Races</h2></div>
                <span>{raceResults.length} {raceResults.length === 1 ? 'Race' : 'Races'}<IonIcon icon={chevronDownOutline} /></span>
              </button>
              {historyOpen && historyError && <div className="race-history-error"><span>{historyError}</span><button type="button" onClick={() => void load()}>Try Again</button></div>}
              {historyOpen && !historyError && (
                <div className="race-history-list">
                  {raceResults.map((result) => (
                    <article className="race-result" key={result.id ?? `${result.raceDate}-${result.raceName}`}>
                      <div className="race-result-date"><strong>{formatRaceResultDay(result.raceDate)}</strong><span>{formatRaceResultMonth(result.raceDate)}</span></div>
                      <div className="race-result-copy">
                        <strong>{result.raceName || 'Completed Race'}</strong>
                        <span>{[result.raceDistance, result.actualTime, result.actualPace ? `${result.actualPace}/km` : null].filter(Boolean).join(' · ') || 'Result Logged'}</span>
                      </div>
                      <em className={`race-result-badge race-result-${result.goalResult ?? 'unknown'}`}>{raceResultLabel(result.goalResult)}</em>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </main>
      </IonContent>
      <RaceGoalEditor isOpen={editorOpen} goal={goal} onClose={() => setEditorOpen(false)} onSaved={(savedGoal, savedPlan) => { setGoal(savedGoal); setPlan(savedPlan); setEditorOpen(false); }} />
      <WorkoutPlanDetail workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      <IonAlert
        isOpen={refreshConfirmOpen}
        onDidDismiss={() => setRefreshConfirmOpen(false)}
        header="Refresh Training Plan?"
        message="RunMate will rebuild the next seven days from today using your latest Recovery, training load, Pain, and Sick data."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Refresh Plan', handler: () => { void refreshPlan(); } },
        ]}
      />
    </IonPage>
  );
};

function WorkoutPlanDetail({ workout, onClose }: { workout: WeekWorkout | null; onClose: () => void }) {
  const metrics = workout ? [
    workout.distanceKm != null && workout.distanceKm > 0 ? { label: 'Distance', value: `${workout.distanceKm} km` } : null,
    workout.durationMin != null && workout.durationMin > 0 ? { label: 'Duration', value: `${workout.durationMin} min` } : null,
    workout.targetPace && !/^n\/?a$/i.test(workout.targetPace.trim()) ? { label: 'Target Pace', value: translatePlanFieldToEnglish(workout.targetPace) } : null,
    workout.targetHR && !/^n\/?a$/i.test(workout.targetHR.trim()) ? { label: 'Target Effort', value: translatePlanFieldToEnglish(workout.targetHR) } : null,
  ].filter((metric): metric is { label: string; value: string } => Boolean(metric)) : [];

  return (
    <IonModal isOpen={Boolean(workout)} onDidDismiss={onClose} className="workout-plan-modal">
      <IonHeader className="workout-plan-header">
        <IonToolbar>
          <IonTitle>Session Details</IonTitle>
          <IonButton slot="end" fill="clear" aria-label="Close Session Details" onClick={onClose}><IonIcon slot="icon-only" icon={closeOutline} /></IonButton>
        </IonToolbar>
      </IonHeader>
      <IonContent className="workout-plan-content">
        {workout && <main className="workout-plan-shell">
          <header><p>{shortDay(workout.day)} · TRAINING PLAN</p><h1>{workout.workoutType}</h1><span>{formatRaceWorkoutMetric(workout)}</span></header>
          {metrics.length > 0 && <section className="workout-plan-metrics">{metrics.map((metric) => <div key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</section>}
          <section className="workout-plan-guidance">
            <p>COACH GUIDANCE</p>
            <h2>How To Approach It</h2>
            <div><strong>Session</strong><span>{workout.description || 'Follow the planned session at a comfortable, controlled effort.'}</span></div>
            {workout.purpose && <div><strong>Why It Matters</strong><span>{workout.purpose}</span></div>}
            {workout.adjustment && <div><strong>If You Need To Adjust</strong><span>{workout.adjustment}</span></div>}
          </section>
        </main>}
      </IonContent>
    </IonModal>
  );
}

function RaceMetric({ label, value }: { label: string; value: string }) {
  return <div className="race-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatRaceDate(value: string): string {
  const date = new Date(`${value}T12:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? value : new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(date);
}

function shortDay(value: string): string {
  const thaiDays: Record<string, string> = {
    'อาทิตย์': 'SUN', 'วันอาทิตย์': 'SUN',
    'จันทร์': 'MON', 'วันจันทร์': 'MON',
    'อังคาร': 'TUE', 'วันอังคาร': 'TUE',
    'พุธ': 'WED', 'วันพุธ': 'WED',
    'พฤหัสบดี': 'THU', 'วันพฤหัสบดี': 'THU',
    'ศุกร์': 'FRI', 'วันศุกร์': 'FRI',
    'เสาร์': 'SAT', 'วันเสาร์': 'SAT',
  };
  const trimmed = value.trim();
  if (thaiDays[trimmed]) return thaiDays[trimmed];
  const normalized = trimmed.slice(0, 3);
  return normalized ? normalized.toUpperCase() : 'DAY';
}

function formatRaceResultDay(value: string | null): string {
  const date = parseRaceDate(value);
  return date ? String(date.getDate()).padStart(2, '0') : '—';
}

function formatRaceResultMonth(value: string | null): string {
  const date = parseRaceDate(value);
  return date ? new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'Asia/Bangkok' }).format(date) : 'No Date';
}

function parseRaceDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function raceResultLabel(result: RaceResult['goalResult']): string {
  if (result === 'achieved') return 'Goal Achieved';
  if (result === 'missed') return 'Goal Missed';
  if (result === 'completed') return 'Completed';
  return 'Logged';
}

function formatPlanUpdated(value: string | null | undefined): string {
  if (!value) return 'Update Date Unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Update Date Unavailable';
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  if (dateKey === todayBangkokDateKey()) return 'Updated Today';
  return `Updated ${new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' }).format(date)}`;
}

export default RaceGoalPage;
