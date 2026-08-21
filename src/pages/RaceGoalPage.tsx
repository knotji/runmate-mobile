import { useCallback, useEffect, useRef, useState } from 'react';
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
import { arrowBackOutline, calendarClearOutline, chevronDownOutline, chevronForwardOutline, flagOutline } from 'ionicons/icons';
import { todayBangkokDateKey } from '@/lib/date';
import { buildMobileRaceSummary, formatRaceWorkoutMetric, isRaceWorkoutToday } from '@/lib/mobileRaceGoal';
import { loadActiveRaceGoalAndPlan, loadRacePlanVersions, saveRaceGoalAndPlan } from '@/lib/raceStorage';
import { loadRaceResults, maybeCompleteRaceFromWorkoutItem } from '@/lib/raceResults';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { extractGoalProfile } from '@/lib/goals/goalContext';
import { useRacePlanStore } from '@/lib/race/racePlanStore';
import { generateRacePlan } from '@/lib/racePlanGeneration';
import { heavyTrainingDates, mergeRefreshedRacePlanWithOptions } from '@/lib/racePlanRefresh';
import { buildRacePlanDiff, prepareActivePlanVersion, prepareLegacyActivePlanVersion, type RacePlanChange } from '@/lib/racePlanVersions';
import { applyProfilePreferencesToRaceGoal } from '@/lib/raceProfilePreferences';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { activityRecentHistoryOptions } from '@/lib/activityHistoryLoad';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { buildTrainingAdherence, type TrainingAdherence } from '@/lib/trainingAdherence';
import {
  adherenceStatusDetail,
  adherenceStatusLabel,
  formatPlanUpdated,
  formatRaceDate,
  formatRacePace,
  formatRaceResultDay,
  formatRaceResultMonth,
  raceResultLabel,
  shortDay,
} from '@/lib/raceGoalFormatting';
import type { RaceGoal, RacePlan, RacePlanVersion, RaceResult, WeekWorkout } from '@/types/race';
import type { UserProfile } from '@/types/profile';
import RaceGoalEditor from '@/components/RaceGoalEditor';
import { WorkoutPlanDetail } from '@/components/race/WorkoutPlanDetail';
import './RaceGoalPage.css';
import { PageState } from '@/components/PageState';
import { PageDataSkeleton } from '@/components/PageDataSkeleton';
import { useAsyncLoad } from '@/lib/hooks/useAsyncLoad';
import { measurePerformanceDiagnostic } from '@/lib/performanceDiagnostics';
import { navigateBackOr } from '@/lib/navigationBack';
import { hapticImpact, hapticNotification } from '@/lib/haptics';

const RaceGoalPage: React.FC = () => {
  const history = useHistory();
  const goal = useRacePlanStore((state) => state.goal);
  const plan = useRacePlanStore((state) => state.plan);
  const raceStoreUpdatedAt = useRacePlanStore((state) => state.lastUpdatedAt);
  const [raceResults, setRaceResults] = useState<RaceResult[]>([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [refreshConfirmOpen, setRefreshConfirmOpen] = useState(false);
  const [refreshingPlan, setRefreshingPlan] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [planPreview, setPlanPreview] = useState<{
    goal: RaceGoal;
    plan: RacePlan;
    changes: RacePlanChange[];
    mode: 'refresh' | 'restore';
    restoredFromPlanId?: string;
  } | null>(null);
  const [applyingPlan, setApplyingPlan] = useState(false);
  const [planHistoryOpen, setPlanHistoryOpen] = useState(false);
  const [planVersions, setPlanVersions] = useState<RacePlanVersion[]>([]);
  const [planHistoryLoading, setPlanHistoryLoading] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<WeekWorkout | null>(null);
  const [adherence, setAdherence] = useState<TrainingAdherence | null>(null);
  const [adherenceOpen, setAdherenceOpen] = useState(false);
  const legacyMigrationRef = useRef(false);
  const hasPreparedRace = raceStoreUpdatedAt != null;

  const loadRaceHistory = useCallback(async () => {
    setHistoryError(null);
    const completed = await loadRaceResults(20);
    if (completed.ok) setRaceResults(completed.results);
    else setHistoryError(completed.error);
  }, []);

  const { loading, error, setError, reload: load } = useAsyncLoad(async () => {
    const [result, workoutHistory] = await measurePerformanceDiagnostic(
      'race_goal',
      () => Promise.all([loadActiveRaceGoalAndPlan(), loadHistoryItems(['workout', 'strength'], activityRecentHistoryOptions())]),
      () => ({ detail: 'Active race, plan, and adherence prepared' }),
    );
    if (result.ok) {
      let activeGoal = result.goal;
      let activePlan = result.plan;
      if (activeGoal && activePlan && activePlan.planStatus !== 'active' && !legacyMigrationRef.current) {
        legacyMigrationRef.current = true;
        const migrated = await saveRaceGoalAndPlan(activeGoal, prepareLegacyActivePlanVersion(activePlan));
        if (migrated.ok) {
          activeGoal = migrated.goal;
          activePlan = migrated.plan;
          useRacePlanStore.getState().setRacePlan(activeGoal, activePlan);
        } else {
          legacyMigrationRef.current = false;
          setRefreshError(`Plan history setup is pending: ${migrated.error}`);
        }
      }
      const summary = activeGoal ? buildMobileRaceSummary(activeGoal, activePlan, todayBangkokDateKey()) : null;
      setAdherence(summary && workoutHistory.ok ? buildTrainingAdherence(summary.workouts, dedupeWorkoutItems(workoutHistory.items), todayBangkokDateKey()) : null);

      // Catches a workout that was already logged/synced on the race date before this
      // check existed (or before the goal was made active), since the sync-time check
      // in samsungWorkoutSync.ts only fires for items new to that specific sync run.
      // Safe to run every load — maybeCompleteRaceFromWorkoutItem() is a no-op once
      // the goal is already completed or nothing on the race date matches.
      if (activeGoal?.id && workoutHistory.ok) {
        const raceDateWorkouts = workoutHistory.items.filter((item) => item.dateKey === activeGoal!.raceDate);
        for (const item of raceDateWorkouts) {
          const outcome = await maybeCompleteRaceFromWorkoutItem(item);
          if (outcome.completed) { void loadRaceHistory(); break; }
        }
      }
    } else {
      setError(result.error);
    }
  }, 'Could Not Load Your Race Goal.');

  useEffect(() => { void loadRaceHistory(); }, [loadRaceHistory]);

  const refresh = async (event: CustomEvent<RefresherEventDetail>) => {
    await load();
    event.detail.complete();
  };

  const today = todayBangkokDateKey();
  const summary = goal ? buildMobileRaceSummary(goal, plan, today) : null;
  const progress = summary?.currentWeek && summary.totalWeeks ? Math.round(summary.currentWeek / summary.totalWeeks * 100) : 0;

  const refreshPlan = async (useLatestProfile: boolean) => {
    if (!goal || refreshingPlan) return;
    void hapticImpact();
    setRefreshingPlan(true); setRefreshError(null);
    try {
      const context = await buildCoachContextFromSupabase();
      const nextGoal = useLatestProfile && context.profile ? applyProfilePreferencesToRaceGoal(goal, context.profile as UserProfile) : goal;
      const generatedPlan = await generateRacePlan(nextGoal, context);
      const nextPlan = plan ? mergeRefreshedRacePlanWithOptions(plan, generatedPlan, today, {
        dynamicUpcoming: true,
        completedWorkoutDates: context.workouts7d.map((day) => day.date),
        goalProfile: extractGoalProfile(context),
        heavyTrainingDates: heavyTrainingDates(context.workouts7d),
      }) : generatedPlan;
      setPlanPreview({ goal: nextGoal, plan: nextPlan, changes: plan ? buildRacePlanDiff(plan, nextPlan) : [], mode: 'refresh' });
    } catch (refreshFailure) {
      setRefreshError(refreshFailure instanceof Error ? refreshFailure.message : 'Could Not Refresh This Plan. Please Try Again.');
    } finally {
      setRefreshingPlan(false);
    }
  };

  const applyPlanPreview = async () => {
    if (!planPreview || applyingPlan) return;
    setApplyingPlan(true); setRefreshError(null);
    try {
      const versionsResult = await loadRacePlanVersions(planPreview.goal.id);
      if (!versionsResult.ok) throw new Error(versionsResult.error);
      const versionedPlan = prepareActivePlanVersion(planPreview.plan, versionsResult.versions, {
        restoredFromPlanId: planPreview.restoredFromPlanId ?? null,
      });
      const saved = await saveRaceGoalAndPlan(planPreview.goal, versionedPlan);
      if (!saved.ok) throw new Error(saved.error);
      setPlanPreview(null);
      await load();
      void hapticNotification();
    } catch (applyFailure) {
      setRefreshError(applyFailure instanceof Error ? applyFailure.message : 'Could Not Apply This Plan.');
    } finally {
      setApplyingPlan(false);
    }
  };

  const openPlanHistory = async () => {
    if (!goal?.id) return;
    setPlanHistoryOpen(true); setPlanHistoryLoading(true); setRefreshError(null);
    const result = await loadRacePlanVersions(goal.id);
    if (result.ok) setPlanVersions(result.versions);
    else setRefreshError(result.error);
    setPlanHistoryLoading(false);
  };

  const previewPlanRestore = (version: RacePlanVersion) => {
    if (!goal || !plan || applyingPlan) return;
    setPlanHistoryOpen(false);
    void hapticImpact();
    setPlanPreview({
      goal,
      plan: version.plan,
      changes: buildRacePlanDiff(plan, version.plan),
      mode: 'restore',
      restoredFromPlanId: version.id,
    });
  };

  return (
    <IonPage>
      <IonHeader translucent className="race-header">
        <IonToolbar>
          <IonButton slot="start" fill="clear" aria-label="Back To Move" onClick={() => navigateBackOr(history, '/tabs/move')}>
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
          {loading && !hasPreparedRace && <PageDataSkeleton variant="race" label="Loading Race Goal" />}
          {!hasPreparedRace && error && <PageState kind="error" title="Race Goal Is Unavailable" detail={error} actionLabel="Try Again" onAction={() => void load()} className="race-state race-error" />}
          {!loading && (!error || hasPreparedRace) && !goal && (
            <section className={`race-empty${raceResults.length > 0 ? ' race-empty-compact' : ''}`}>
              <div><IonIcon icon={flagOutline} /></div>
              <p>Race Planning</p>
              <h1>No Active Race Goal</h1>
              <span>Set your race details and WholeMate will build a fresh training plan from your latest data.</span>
              <IonButton onClick={() => setEditorOpen(true)}>Create Race Goal</IonButton>
            </section>
          )}
          {goal && summary && (
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
                  <header className="race-section-heading"><div><p>PLAN PROGRESS</p><h2>Your Training Build</h2></div><span><small>{summary.phase ?? 'Current Phase'}</small>{progress}%</span></header>
                  <div className="race-progress"><i style={{ width: `${progress}%` }} /></div>
                  <div className="race-progress-facts">
                    <RaceMetric label="Current Week" value={summary.currentWeek && summary.totalWeeks ? `${summary.currentWeek} Of ${summary.totalWeeks}` : '—'} />
                    <RaceMetric label="Phase" value={summary.phase ?? 'Not Set'} />
                    <RaceMetric label="This Week" value={`${summary.scheduledSessions} Sessions`} />
                    <RaceMetric label="Planned Distance" value={summary.scheduledDistanceKm > 0 ? `${summary.scheduledDistanceKm} km` : 'Flexible'} />
                  </div>
                  <div className="race-plan-refresh">
                    <span>{formatPlanUpdated(plan.updatedAt ?? plan.createdAt)}</span>
                    <div>
                      <button type="button" onClick={() => void openPlanHistory()}>Plan History</button>
                      <button type="button" disabled={refreshingPlan} onClick={() => setRefreshConfirmOpen(true)}>{refreshingPlan && <IonSpinner name="crescent" />}{refreshingPlan ? 'Preparing…' : 'Refresh Plan'}</button>
                    </div>
                  </div>
                  {refreshError && <div className="race-refresh-error" role="alert">{refreshError}</div>}
                </section>
              ) : (
                <section className="race-plan-missing"><p>TRAINING PLAN</p><h2>No Plan Available Yet</h2><span>Your Race Goal is active, but no linked training plan was found.</span></section>
              )}

              {plan && adherence && adherence.days.length > 0 && (
                <section className={`race-adherence${adherenceOpen ? ' race-adherence-open' : ''}`}>
                  <div className="race-adherence-summary">
                    <div>
                      <p>TRAINING ADHERENCE</p>
                      <h2>{adherence.planned > 0 ? `${adherence.completed + adherence.modified} Of ${adherence.planned} Sessions Done` : 'Week In Progress'}</h2>
                      <span>{adherence.planned > 0 ? 'Completed or adjusted from this week’s plan.' : 'Your first planned training day is still ahead.'}</span>
                    </div>
                    <strong>{adherence.percentage}%</strong>
                  </div>
                  <div className="race-adherence-track"><i style={{ width: `${adherence.percentage}%` }} /></div>
                  <div className="race-adherence-counts">
                    <span><i className="completed" />{adherence.completed} Completed</span>
                    <span><i className="modified" />{adherence.modified} Adjusted</span>
                    <span><i className="missed" />{adherence.missed} Missed</span>
                  </div>
                  <button type="button" className="race-adherence-toggle" aria-expanded={adherenceOpen} onClick={() => setAdherenceOpen((open) => !open)}>
                    {adherenceOpen ? 'Hide Week' : 'View Week'}<IonIcon icon={chevronDownOutline} />
                  </button>
                  {adherenceOpen && <div className="race-adherence-days">
                    {adherence.days.map((day, index) => <div className={day.status === 'recovery' ? 'race-adherence-support-day' : undefined} key={`${day.date}-${index}`}>
                      <span>{shortDay(day.workout.day)}</span>
                      <div><strong>{day.workout.workoutType}</strong>{(day.actualLabel || ['missed', 'recovery'].includes(day.status)) && <small>{day.actualLabel ? `${day.actualLabel} Instead` : adherenceStatusDetail(day.status)}</small>}</div>
                      <em className={`status-${day.status}`}>{adherenceStatusLabel(day.status)}</em>
                    </div>)}
                  </div>}
                </section>
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
          {(raceResults.length > 0 || historyError) && (
            <section className={`race-history${historyOpen ? ' race-history-open' : ''}`}>
              <button type="button" className="race-history-toggle" aria-expanded={historyOpen} onClick={() => setHistoryOpen((open) => !open)}>
                <div><p>RACE HISTORY</p><h2>Completed Races</h2></div>
                <span>{raceResults.length} {raceResults.length === 1 ? 'Race' : 'Races'}<IonIcon icon={chevronDownOutline} /></span>
              </button>
              {historyOpen && historyError && <div className="race-history-error"><span>{historyError}</span><button type="button" onClick={() => void loadRaceHistory()}>Try Again</button></div>}
              {historyOpen && !historyError && (
                <div className="race-history-list">
                  {raceResults.map((result) => (
                    <article className="race-result" key={result.id ?? `${result.raceDate}-${result.raceName}`}>
                      <div className="race-result-date"><strong>{formatRaceResultDay(result.raceDate)}</strong><span>{formatRaceResultMonth(result.raceDate)}</span></div>
                      <div className="race-result-copy">
                        <strong>{result.raceName || 'Completed Race'}</strong>
                        <span>{[result.raceDistance, result.actualTime, formatRacePace(result.actualPace)].filter(Boolean).join(' · ') || 'Result Logged'}</span>
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
      <RaceGoalEditor isOpen={editorOpen} goal={goal} onClose={() => setEditorOpen(false)} onSaved={() => { setEditorOpen(false); void load(); }} />
      <WorkoutPlanDetail workout={selectedWorkout} onClose={() => setSelectedWorkout(null)} />
      <IonModal isOpen={Boolean(planPreview)} onDidDismiss={() => !applyingPlan && setPlanPreview(null)} className="race-version-modal">
        <div className="race-version-sheet">
          <header><div><p>{planPreview?.mode === 'restore' ? 'RESTORE PREVIEW' : 'PLAN PREVIEW'}</p><h2>Review Changes Before Applying</h2></div><button type="button" disabled={applyingPlan} onClick={() => setPlanPreview(null)}>Close</button></header>
          <p className="race-version-help">{planPreview?.mode === 'restore' ? 'Compare this saved plan with your current schedule. Restoring creates a new version and keeps both originals.' : 'Past days and a completed workout today are locked. Only the remaining schedule can change, and your current plan stays active until you apply.'}</p>
          {refreshError && <div className="race-refresh-error" role="alert">{refreshError}</div>}
          <div className="race-plan-diff">
            {planPreview?.changes.map((change) => <article key={change.day} className={`change-${change.kind}`}>
              <strong>{change.day}</strong>
              <div><span>{change.before?.workoutType ?? 'No Session'}</span><em>→</em><span>{change.after?.workoutType ?? 'No Session'}</span></div>
              <small>{change.kind === 'unchanged' ? 'Locked or unchanged' : 'Upcoming schedule change'}</small>
            </article>)}
          </div>
          <footer><button type="button" disabled={applyingPlan} onClick={() => setPlanPreview(null)}>Keep Current Plan</button><button type="button" disabled={applyingPlan} onClick={() => void applyPlanPreview()}>{applyingPlan ? 'Applying…' : planPreview?.mode === 'restore' ? 'Restore As New Version' : 'Apply New Version'}</button></footer>
        </div>
      </IonModal>
      <IonModal isOpen={planHistoryOpen} onDidDismiss={() => setPlanHistoryOpen(false)} className="race-version-modal">
        <div className="race-version-sheet">
          <header><div><p>PLAN HISTORY</p><h2>Restore A Previous Version</h2></div><button type="button" disabled={applyingPlan} onClick={() => setPlanHistoryOpen(false)}>Close</button></header>
          <p className="race-version-help">Restoring creates a new active version. Workout records and older plans are not deleted.</p>
          {refreshError && <div className="race-refresh-error" role="alert">{refreshError}</div>}
          {planHistoryLoading ? <div className="race-version-loading"><IonSpinner name="crescent" />Loading Versions…</div> : (
            <div className="race-version-list">
              {planVersions.map((version) => <article key={version.id}>
                <div><strong>{version.status === 'legacy' ? 'Imported Plan' : `Version ${version.version}`}</strong><span>{version.status === 'active' ? 'Active' : version.status === 'legacy' ? 'Previous' : version.status}</span></div>
                <p>{formatVersionWeek(version.plan.weeklyPlan ?? [])}</p>
                <small>{formatPlanUpdated(version.createdAt)}</small>
                <button type="button" disabled={applyingPlan || version.status === 'active'} onClick={() => previewPlanRestore(version)}>{version.status === 'active' ? 'Current Plan' : 'Compare And Restore'}</button>
              </article>)}
            </div>
          )}
        </div>
      </IonModal>
      <IonAlert
        isOpen={refreshConfirmOpen}
        onDidDismiss={() => setRefreshConfirmOpen(false)}
        header="Refresh Training Plan?"
        message="Choose the inputs for a preview. Your current plan will not change until you review and apply the new version."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          { text: 'Keep Current Setup', handler: () => { void refreshPlan(false); } },
          { text: 'Use Latest Profile', handler: () => { void refreshPlan(true); } },
        ]}
      />
    </IonPage>
  );
};

function RaceMetric({ label, value }: { label: string; value: string }) {
  return <div className="race-metric"><span>{label}</span><strong>{value}</strong></div>;
}

function formatVersionWeek(workouts: WeekWorkout[]): string {
  return workouts.map((workout) => `${shortDay(workout.day)} ${workout.workoutType}`).join(' · ');
}

export default RaceGoalPage;
