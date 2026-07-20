import type { CoachContext } from '@/lib/buildCoachContext';
import { getTodayTrainingPlanStatus, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import type { WeekWorkout } from '@/types/race';

export type AdaptiveTrainingAction = 'keep' | 'reduce' | 'swap' | 'rest';

export type AdaptiveTrainingRecommendation = {
  action: AdaptiveTrainingAction;
  label: 'Keep' | 'Reduce' | 'Swap' | 'Rest';
  headline: string;
  summary: string;
  reasons: string[];
  originalWorkout: WeekWorkout;
  suggestedWorkout: WeekWorkout;
};

export function buildAdaptiveTrainingRecommendation(
  context: CoachContext,
  planned: WeekWorkout | null,
): AdaptiveTrainingRecommendation | null {
  if (!planned || getTodayTrainingPlanStatus(context, planned) !== 'pending') return null;

  if (isRestDayWorkout(planned)) {
    return recommendation('keep', planned, planned, 'Keep Your Rest Day', 'Recovery is already built into today’s plan.', [
      'The planned session is a Rest Day, so no adjustment is needed.',
    ]);
  }

  if (context.activePain || context.activeSick) {
    const reason = context.activePain
      ? 'Active pain takes priority over today’s training score.'
      : 'Your latest health check shows fatigue or illness.';
    return recommendation('rest', planned, restWorkout(planned), 'Make Today A Rest Day', 'Skip the planned load and focus on recovery today.', [reason]);
  }

  const recovery = context.recoverySystem;
  const scoreAvailable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  if (!scoreAvailable) {
    return recommendation('keep', planned, planned, 'Keep The Original Plan', 'There is not enough fresh Recovery data to make a trustworthy adjustment.', [
      recovery.dataFreshness?.status === 'stale'
        ? 'Last night’s Sleep data is not current.'
        : 'Recovery is still waiting for enough overnight signals.',
    ]);
  }

  const score = recovery.overallScore;
  const hardSession = isHardSession(planned);
  const sleepScore = recovery.sleepPerformance.score;
  const lowSleep = recovery.sleepPerformance.state !== 'unscorable' && sleepScore < 70;
  const highCurrentStrain = recovery.strain.score >= 14;

  if (score < 34) {
    if (hardSession) {
      return recommendation('rest', planned, restWorkout(planned), 'Make Today A Rest Day', 'Low Recovery and a demanding session are not a good match today.', [
        `Recovery is ${Math.round(score)}/100.`,
        `${planned.workoutType} is a demanding session.`,
      ]);
    }
    return recommendation('swap', planned, recoveryWorkout(planned), 'Swap To Easy Recovery', 'Replace today’s session with light movement only.', [
      `Recovery is ${Math.round(score)}/100.`,
      'Light movement preserves the habit without adding meaningful training load.',
    ]);
  }

  if (score < 67 && (hardSession || lowSleep)) {
    const reasons = [`Recovery is ${Math.round(score)}/100.`];
    if (hardSession) reasons.push(`${planned.workoutType} carries more intensity than an easy session.`);
    if (lowSleep) reasons.push(`Sleep Performance is ${Math.round(sleepScore)}/100.`);
    return recommendation('reduce', planned, reducedWorkout(planned), 'Reduce Today’s Load', 'Keep the session, but shorten it and stay at an easy effort.', reasons);
  }

  if (highCurrentStrain) {
    return recommendation('reduce', planned, reducedWorkout(planned), 'Reduce Today’s Load', 'You have already accumulated substantial Strain today.', [
      `Current Strain is ${recovery.strain.score.toFixed(1)}/21.`,
    ]);
  }

  return recommendation('keep', planned, planned, 'Keep The Original Plan', 'Your current signals support the session as written.', [
    `Recovery is ${Math.round(score)}/100.`,
    lowSleep ? `Sleep Performance is ${Math.round(sleepScore)}/100, so keep the effort controlled.` : 'No safety cap is active.',
  ]);
}

function recommendation(
  action: AdaptiveTrainingAction,
  originalWorkout: WeekWorkout,
  suggestedWorkout: WeekWorkout,
  headline: string,
  summary: string,
  reasons: string[],
): AdaptiveTrainingRecommendation {
  const labels: Record<AdaptiveTrainingAction, AdaptiveTrainingRecommendation['label']> = {
    keep: 'Keep',
    reduce: 'Reduce',
    swap: 'Swap',
    rest: 'Rest',
  };
  return {
    action,
    label: labels[action],
    headline,
    summary,
    reasons,
    originalWorkout,
    suggestedWorkout,
  };
}

function isHardSession(workout: WeekWorkout): boolean {
  return /interval|tempo|threshold|speed|long run|race|hill|vo2|max effort|hard/i.test(`${workout.workoutType} ${workout.description ?? ''}`);
}

function reducedWorkout(workout: WeekWorkout): WeekWorkout {
  return {
    ...workout,
    distanceKm: workout.distanceKm == null ? null : roundHalf(Math.max(1, workout.distanceKm * 0.7)),
    durationMin: workout.durationMin == null ? null : Math.max(15, Math.round(workout.durationMin * 0.7 / 5) * 5),
    targetPace: 'Easy Conversational Pace',
    targetHR: 'Zone 1–2',
    adjustment: 'Adaptive suggestion for today only. Original Race Plan unchanged.',
  };
}

function recoveryWorkout(workout: WeekWorkout): WeekWorkout {
  return {
    ...workout,
    workoutType: 'Recovery Walk',
    distanceKm: null,
    durationMin: Math.min(30, Math.max(15, workout.durationMin ?? 20)),
    targetPace: null,
    targetHR: 'Zone 1',
    description: 'Easy walking or gentle mobility. Stop if symptoms worsen.',
    adjustment: 'Adaptive suggestion for today only. Original Race Plan unchanged.',
  };
}

function restWorkout(workout: WeekWorkout): WeekWorkout {
  return {
    ...workout,
    workoutType: 'Rest Day',
    distanceKm: null,
    durationMin: null,
    targetPace: null,
    targetHR: null,
    description: 'Prioritize recovery and return to the plan when your signals improve.',
    adjustment: 'Adaptive suggestion for today only. Original Race Plan unchanged.',
  };
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
