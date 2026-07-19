import type { CoachContext } from '@/lib/buildCoachContext';
import {
  buildTodayTrainingPlanGuidance,
  getTodayPlannedWorkout,
  getTodayTrainingPlanStatus,
  translatePlanFieldToEnglish,
} from '@/lib/todayTrainingPlan';
import './TodayTrainingPlanCard.css';

export function TodayTrainingPlanCard({ context }: { context: CoachContext }) {
  const planned = getTodayPlannedWorkout(context);

  if (!planned) {
    return (
      <section className="plan-card" aria-label="Today's Training Plan">
        <span>Training Plan</span>
        <strong>No Active Plan</strong>
        <p>Add a race goal to get a day-by-day training plan tied to your Recovery.</p>
      </section>
    );
  }

  const status = getTodayTrainingPlanStatus(context, planned);
  const guidance = buildTodayTrainingPlanGuidance(context, planned);
  const metrics = [
    planned.distanceKm != null ? `${planned.distanceKm} km` : null,
    planned.durationMin != null ? `${planned.durationMin} min` : null,
    planned.targetPace ? translatePlanFieldToEnglish(planned.targetPace) : null,
    planned.targetHR ? translatePlanFieldToEnglish(planned.targetHR) : null,
  ].filter((metric): metric is string => Boolean(metric));
  const title = status === 'pending' ? planned.workoutType : context.todayPrimaryWorkout?.label ?? planned.workoutType;

  return (
    <section className={`plan-card ${status === 'completed' ? 'plan-card-completed' : status === 'logged_different' ? 'plan-card-different' : ''}`} aria-label="Today's Training Plan">
      <span>Training Plan</span>
      <strong>{title}</strong>
      {status === 'completed' && <p>Matches today's plan: {planned.workoutType}. Nice work.</p>}
      {status === 'logged_different' && <p>Today's plan called for {planned.workoutType.toLowerCase()}, but you logged this instead.</p>}
      {status === 'pending' && (
        <>
          {metrics.length > 0 && <p className="plan-metrics-line">{metrics.join(' · ')}</p>}
          {guidance && <p className="plan-guidance-line">{guidance.summary}</p>}
        </>
      )}
    </section>
  );
}
