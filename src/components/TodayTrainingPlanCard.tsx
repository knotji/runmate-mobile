import { useMemo } from 'react';
import type { CoachContext } from '@/lib/buildCoachContext';
import {
  buildAdaptiveTrainingRecommendation,
} from '@/lib/adaptiveTrainingPlan';
import { buildSupportCards } from '@/lib/recoverySupport';
import {
  getTodayPlannedWorkout,
  getTodayTrainingPlanStatus,
  isRestDayWorkout,
  translatePlanFieldToEnglish,
} from '@/lib/todayTrainingPlan';
import './TodayTrainingPlanCard.css';

export function TodayTrainingPlanCard({ context }: { context: CoachContext }) {
  const planned = getTodayPlannedWorkout(context);
  const status = planned ? getTodayTrainingPlanStatus(context, planned) : null;
  const recommendation = useMemo(() => buildAdaptiveTrainingRecommendation(context, planned), [context, planned]);
  const appliedWorkout = recommendation?.suggestedWorkout ?? planned;
  const restDay = isRestDayWorkout(appliedWorkout);
  const supportCards = buildSupportCards(context);
  const metrics = appliedWorkout && !restDay ? [
    appliedWorkout.distanceKm != null ? `${appliedWorkout.distanceKm} km` : null,
    appliedWorkout.durationMin != null ? `${appliedWorkout.durationMin} min` : null,
    appliedWorkout.targetPace ? translatePlanFieldToEnglish(appliedWorkout.targetPace) : null,
    appliedWorkout.targetHR ? translatePlanFieldToEnglish(appliedWorkout.targetHR) : null,
  ].filter((metric): metric is string => typeof metric === 'string' && metric.length > 0 && !/^0 (km|min)$|^N\/A$/i.test(metric)) : [];
  const title = planned
    ? recommendation && recommendation.action !== 'keep' ? recommendation.suggestedWorkout.workoutType
      : restDay && status === 'pending' ? 'Rest Day' : status === 'pending' ? planned.workoutType : context.todayPrimaryWorkout?.label ?? planned.workoutType
    : fallbackFocus(context);

  return (
    <section className={`plan-card ${status === 'completed' ? 'plan-card-completed' : status === 'logged_different' ? 'plan-card-different' : ''}${recommendation && recommendation.action !== 'keep' ? ' plan-card-adapted' : ''}`} aria-label="Today's Focus">
      <div className="plan-card-main">
        <div className="plan-card-eyebrow"><span>Today's Focus</span>{recommendation && status === 'pending' && <em className={`adaptive-action adaptive-action-${recommendation.action}`}>Adaptive · {recommendation.label}</em>}</div>
        <strong>{title}</strong>
        {!planned && <p>{fallbackSummary(context)}</p>}
        {planned && status === 'completed' && <p>Matches today's plan: {planned.workoutType}. Nice work.</p>}
        {planned && status === 'logged_different' && <p>Today's plan called for {planned.workoutType.toLowerCase()}, but you logged this instead.</p>}
        {planned && status === 'pending' && (
          <>
            {metrics.length > 0 && <p className="plan-metrics-line">{metrics.join(' · ')}</p>}
            {recommendation && <div className="adaptive-guidance">
              <p><strong>{recommendation.headline}</strong>{recommendation.summary}</p>
              {recommendation.action !== 'keep' && <p className="adaptive-original-plan">Original Plan: {planned.workoutType}</p>}
              {recommendation.reasons.length > 0 && <ul>{recommendation.reasons.map((reason) => <li key={reason}>{reason}</li>)}</ul>}
            </div>}
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
