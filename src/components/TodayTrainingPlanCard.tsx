import type { CoachContext } from '@/lib/buildCoachContext';
import {
  buildTodayTrainingPlanGuidance,
  getTodayPlannedWorkout,
  isTodayPlannedWorkoutCompleted,
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

  const completed = isTodayPlannedWorkoutCompleted(context, planned);
  const guidance = buildTodayTrainingPlanGuidance(context, planned);
  const metrics = [
    planned.distanceKm != null ? `${planned.distanceKm} km` : null,
    planned.durationMin != null ? `${planned.durationMin} min` : null,
    planned.targetPace ? translatePlanFieldToEnglish(planned.targetPace) : null,
    planned.targetHR ? translatePlanFieldToEnglish(planned.targetHR) : null,
  ].filter((metric): metric is string => Boolean(metric));

  return (
    <section className={`plan-card ${completed ? 'plan-card-completed' : ''}`} aria-label="Today's Training Plan">
      <span>Training Plan</span>
      <strong>{planned.workoutType}</strong>
      {completed ? (
        <p>You already logged a matching workout today. Nice work.</p>
      ) : (
        <>
          {metrics.length > 0 && <p className="plan-metrics-line">{metrics.join(' · ')}</p>}
          {guidance && <p className="plan-guidance-line">{guidance.summary}</p>}
        </>
      )}
    </section>
  );
}
