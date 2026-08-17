import type { CoachContext } from '@/lib/buildCoachContext';
import type { RecoveryExplainability } from '@/lib/recoveryExplainability';
import { isRestDayWorkout } from '@/lib/todayTrainingPlan';
import { HEAVY_WEEKLY_TRAINING_LOAD_THRESHOLD } from '@/lib/weeklyTrainingLoad';
import type { WeekWorkout } from '@/types/race';

/**
 * A deterministic, advisory-only read of "how hard can today be" — built from
 * Recovery, Sleep Performance, today's accumulated Strain, a lightweight 7-day
 * training-load proxy, and (informationally) today's planned workout. It never
 * writes to the Race Plan or any store; callers only render its output.
 *
 * Thresholds intentionally reuse the same bands already used elsewhere in the
 * app (67/34 Recovery zones, 14/10 Strain levels, 70/85 Sleep Performance
 * labels, weeklyTrainingLoad7d >= 250 "heavy week" in adaptiveTrainingPlan.ts)
 * so this recommendation never disagrees with the dials or the adaptive plan
 * card for the same underlying numbers.
 */
export type DailyRecommendationAction = 'push' | 'normal' | 'reduce' | 'recover';

export type DailyRecommendation =
  | { status: 'insufficient_data'; reason: string }
  | {
      status: 'ready';
      action: DailyRecommendationAction;
      label: string;
      reason: string;
      plannedWorkoutNote: string | null;
    };

const ACTION_LABEL: Record<DailyRecommendationAction, string> = {
  push: 'Push Today',
  normal: 'Normal Training',
  reduce: 'Reduce Load',
  recover: 'Recover First',
};

export function buildDailyRecommendation(
  context: CoachContext,
  explainability: RecoveryExplainability,
  planned: WeekWorkout | null,
): DailyRecommendation {
  const recovery = context.recoverySystem;
  if (recovery.scoreState !== 'scored' && recovery.scoreState !== 'calibrating') {
    return {
      status: 'insufficient_data',
      reason: explainability.status === 'unavailable' ? explainability.reason : 'Not enough trustworthy Recovery data yet for today\'s recommendation.',
    };
  }

  const score = recovery.overallScore;
  const sleepScore = recovery.sleepPerformance.state === 'unscorable' ? null : recovery.sleepPerformance.score;
  const strainScore = recovery.strain.score;
  const heavyWeeklyLoad = (context.weeklyTrainingLoad7d ?? 0) >= HEAVY_WEEKLY_TRAINING_LOAD_THRESHOLD;
  const plannedWorkoutNote = describePlannedWorkout(planned);
  const topHelping = explainability.status === 'ready' ? explainability.helping[0] ?? null : null;
  const topHurting = explainability.status === 'ready' ? explainability.hurting[0] ?? null : null;

  if (context.activePain) {
    return build('recover', 'Active pain takes priority over today\'s training load.', plannedWorkoutNote);
  }
  if (context.activeSick) {
    return build('recover', 'An active sick check-in means today should focus on recovery.', plannedWorkoutNote);
  }
  if (score < 34) {
    return build('recover', topHurting?.detail ?? `Recovery is ${Math.round(score)}/100 today, below the normal range.`, plannedWorkoutNote);
  }
  if (score < 67) {
    return build('reduce', topHurting?.detail ?? `Recovery is ${Math.round(score)}/100 today, so keep effort controlled.`, plannedWorkoutNote);
  }
  if (strainScore >= 14) {
    return build('reduce', `Today's Strain has already reached ${strainScore.toFixed(1)}/21.`, plannedWorkoutNote);
  }
  if (sleepScore != null && sleepScore < 70) {
    return build('reduce', `Sleep Performance for last night is ${Math.round(sleepScore)}/100.`, plannedWorkoutNote);
  }
  if (heavyWeeklyLoad) {
    return build('reduce', 'This week\'s training load is already high.', plannedWorkoutNote);
  }
  if (score >= 80 && strainScore < 10 && (sleepScore == null || sleepScore >= 85)) {
    return build('push', topHelping?.detail ?? `Recovery is ${Math.round(score)}/100 today and Strain is still light.`, plannedWorkoutNote);
  }
  return build('normal', topHelping?.detail ?? 'Recovery, Strain, and Sleep are all in a balanced range, with no clear limiter.', plannedWorkoutNote);
}

function build(action: DailyRecommendationAction, reason: string, plannedWorkoutNote: string | null): DailyRecommendation {
  return { status: 'ready', action, label: ACTION_LABEL[action], reason, plannedWorkoutNote };
}

function describePlannedWorkout(planned: WeekWorkout | null): string | null {
  if (!planned) return null;
  if (isRestDayWorkout(planned)) return 'Rest Day';
  const distance = planned.distanceKm != null ? `${planned.distanceKm} km` : null;
  const duration = planned.durationMin != null ? `${planned.durationMin} min` : null;
  const detail = [distance, duration].filter(Boolean).join(' · ');
  return detail ? `${planned.workoutType} · ${detail}` : planned.workoutType;
}
