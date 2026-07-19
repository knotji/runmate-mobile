import type { CoachContext } from '@/lib/buildCoachContext';
import { buildSupportCards } from '@/lib/recoverySupport';
import {
  buildTodayTrainingPlanGuidance,
  getTodayPlannedWorkout,
  getTodayTrainingPlanStatus,
  translatePlanFieldToEnglish,
} from '@/lib/todayTrainingPlan';
import './TodayTrainingPlanCard.css';

export function TodayTrainingPlanCard({ context }: { context: CoachContext }) {
  const planned = getTodayPlannedWorkout(context);
  const status = planned ? getTodayTrainingPlanStatus(context, planned) : null;
  const guidance = planned ? buildTodayTrainingPlanGuidance(context, planned) : null;
  const supportCards = buildSupportCards(context);
  const metrics = planned ? [
    planned.distanceKm != null ? `${planned.distanceKm} km` : null,
    planned.durationMin != null ? `${planned.durationMin} min` : null,
    planned.targetPace ? translatePlanFieldToEnglish(planned.targetPace) : null,
    planned.targetHR ? translatePlanFieldToEnglish(planned.targetHR) : null,
  ].filter((metric): metric is string => Boolean(metric)) : [];
  const title = planned
    ? status === 'pending' ? planned.workoutType : context.todayPrimaryWorkout?.label ?? planned.workoutType
    : fallbackFocus(context);

  return (
    <section className={`plan-card ${status === 'completed' ? 'plan-card-completed' : status === 'logged_different' ? 'plan-card-different' : ''}`} aria-label="Today's Focus">
      <div className="plan-card-main">
        <span>Today's Focus</span>
        <strong>{title}</strong>
        {!planned && <p>{fallbackSummary(context)}</p>}
        {planned && status === 'completed' && <p>Matches today's plan: {planned.workoutType}. Nice work.</p>}
        {planned && status === 'logged_different' && <p>Today's plan called for {planned.workoutType.toLowerCase()}, but you logged this instead.</p>}
        {planned && status === 'pending' && (
          <>
            {metrics.length > 0 && <p className="plan-metrics-line">{metrics.join(' · ')}</p>}
            {guidance && <p className="plan-guidance-line">{guidance.summary}</p>}
          </>
        )}
      </div>
      {supportCards.length > 0 && (
        <details className="plan-support-details">
          <summary>Support And Data <small>{supportCards.length}</small></summary>
          <div className="plan-support-list">
            {supportCards.map((card) => <div className={`plan-support-${card.category}`} key={card.category}><strong>{card.title}</strong><p>{card.summary}</p></div>)}
          </div>
        </details>
      )}
    </section>
  );
}

function fallbackFocus(context: CoachContext): string {
  const recovery = context.recoverySystem;
  if (recovery.scoreState === 'stale' || recovery.scoreState === 'unscorable') return 'Start With Fresh Data';
  if (recovery.overallScore < 34) return 'Recovery First';
  if (recovery.overallScore < 67) return 'Keep Today Controlled';
  return 'Ready To Move';
}

function fallbackSummary(context: CoachContext): string {
  const recovery = context.recoverySystem;
  if (recovery.scoreState === 'stale' || recovery.scoreState === 'unscorable') return 'Recovery is not scored from a fresh sleep record yet.';
  if (recovery.overallScore < 34) return 'Keep Strain low and prioritize recovery today.';
  if (recovery.overallScore < 67) return 'Choose moderate effort and avoid an all-out session.';
  return 'Your Recovery supports a normal training day.';
}
