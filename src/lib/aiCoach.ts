import type { CoachContext, TodayCompletedWorkoutSummary } from '@/lib/buildCoachContext';
import { buildAdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { supabase } from '@/lib/supabaseClient';
import { getTodayPlannedWorkout, getTodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';
import type { WeekWorkout } from '@/types/race';

export type AiCoachTopic = 'today' | 'recovery' | 'adjust' | 'fuel' | 'race';

export const AI_COACH_TOPICS: Array<{ id: AiCoachTopic; title: string; summary: string }> = [
  { id: 'today', title: 'What Should I Do Today?', summary: 'Turn today\'s Recovery, plan, and recent logs into one clear priority.' },
  { id: 'recovery', title: 'Why Did My Recovery Change?', summary: 'Understand the available signals behind today\'s Recovery.' },
  { id: 'adjust', title: 'Should I Adjust Today\'s Workout?', summary: 'Compare the planned session with today\'s readiness and safety signals.' },
  { id: 'fuel', title: 'How Should I Fuel Today?', summary: 'Use today\'s logged meals and training load for practical guidance.' },
  { id: 'race', title: 'Am I On Track For My Race?', summary: 'Review your current Race Goal and recent training without rebuilding the plan.' },
];

export type AiCoachAnswer = {
  topic: AiCoachTopic;
  headline: string;
  summary: string;
  actions: string[];
  reasons: string[];
  missingData: string[];
  caution: string | null;
  nextMeal: { title: string; timing: string | null; options: string[] } | null;
  followUps: string[];
  generatedAt: string;
};

export type AiCoachContext = ReturnType<typeof buildAiCoachContext>;

export function buildAiCoachContext(context: CoachContext) {
  const planned = getTodayPlannedWorkout(context);
  const adaptive = buildAdaptiveTrainingRecommendation(context, planned);
  const racePlan = record(context.racePlan);

  return {
    date: context.todayDate,
    timeBangkok: bangkokTime(),
    recovery: {
      state: context.recoverySystem.scoreState,
      freshness: context.recoverySystem.dataFreshness.status,
      score: isRecoveryScored(context) ? Math.round(context.recoverySystem.overallScore) : null,
      label: context.recoverySystem.overallLabel,
      strain: round(context.recoverySystem.strain.score, 1),
      strainEstimated: context.recoverySystem.strain.estimated,
      sleepScore: context.recoverySystem.sleepPerformance.state === 'unscorable'
        ? null
        : Math.round(context.recoverySystem.sleepPerformance.score),
      sleepDuration: formatDuration(context.recoverySystem.sleepPerformance.actualSleepMinutes),
      sleepNeed: formatDuration(context.recoverySystem.sleepPerformance.sleepNeedMinutes),
      sleepShortfall: formatDuration(context.recoverySystem.sleepPerformance.sleepDebtMinutes),
      fuelStatus: context.recoverySystem.fuelInsight.status,
      fuelSummary: context.recoverySystem.fuelInsight.summary,
      usedSignals: context.recoverySystem.sourceCoverage.used.slice(0, 8),
      missingSignals: context.recoverySystem.sourceCoverage.missing.slice(0, 8),
    },
    todayPlan: planned ? {
      status: getTodayTrainingPlanStatus(context, planned),
      workout: compactPlannedWorkout(planned),
      adaptiveRecommendation: adaptive ? {
        action: adaptive.action,
        headline: adaptive.headline,
        summary: adaptive.summary,
        reasons: adaptive.reasons.slice(0, 4),
        suggestedWorkout: compactPlannedWorkout(adaptive.suggestedWorkout),
      } : null,
    } : null,
    todayWorkouts: context.todayWorkouts.slice(0, 6).map(compactCompletedWorkout),
    recentTraining: {
      sessions7d: context.totalSessions,
      runDistanceKm7d: round(context.totalRunKm, 1),
      runDays7d: context.runDays7d,
      longestRunKm7d: context.longestRun7dKm,
      lastWorkoutDate: context.lastWorkoutDate,
    },
    nutritionToday: context.nutritionToday ? {
      meals: context.nutritionToday.mealCount,
      caloriesKcal: context.nutritionToday.caloriesKcal,
      proteinG: context.nutritionToday.proteinG,
      carbsG: context.nutritionToday.carbsG,
      fatG: context.nutritionToday.fatG,
      foods: context.mealsToday.flatMap((meal) => meal.foods).filter(Boolean).slice(0, 12),
      mealLog: context.mealsToday.slice(0, 8).map((meal) => ({
        type: meal.mealType,
        foods: meal.foods.slice(0, 6),
        caloriesKcal: meal.caloriesKcal,
        proteinG: meal.proteinG,
        carbsG: meal.carbsG,
        fatG: meal.fatG,
      })),
    } : null,
    race: context.activeRaceGoal ? {
      status: context.activeRaceStatus,
      name: context.raceName,
      date: context.raceDate,
      distance: context.raceDistance,
      daysUntilRace: context.daysUntilRace,
      targetTime: context.targetTime,
      currentPhase: stringOrNull(racePlan.currentPhase),
      planSummary: stringOrNull(racePlan.planSummary),
    } : null,
    health: {
      activePain: context.activePain,
      painLevel: context.recentMaxPain?.painLevel ?? null,
      painLocation: context.latestPain?.painLocation ?? null,
      activeSick: context.activeSick,
      sickRisk: context.sickRiskLevel,
    },
  };
}

export async function askAiCoach(topic: AiCoachTopic, context: CoachContext): Promise<AiCoachAnswer> {
  const { data, error } = await supabase.functions.invoke('ai-coach', {
    body: { topic, context: buildAiCoachContext(context) },
  });
  if (error) throw new Error(error.message || 'AI Coach Is Unavailable.');
  const payload = record(data);
  const answer = record(payload.data ?? payload);
  return normalizeAnswer(topic, answer);
}

function normalizeAnswer(topic: AiCoachTopic, value: Record<string, unknown>): AiCoachAnswer {
  const headline = requiredString(value.headline, 'AI Coach Could Not Build An Answer.');
  const summary = requiredString(value.summary, 'Please try again when more data is available.');
  return {
    topic,
    headline,
    summary,
    actions: stringArray(value.actions, 4),
    reasons: stringArray(value.reasons, 4),
    missingData: stringArray(value.missingData, 4),
    caution: stringOrNull(value.caution),
    nextMeal: normalizeNextMeal(value.nextMeal),
    followUps: stringArray(value.followUps, 3),
    generatedAt: new Date().toISOString(),
  };
}

function compactPlannedWorkout(workout: WeekWorkout) {
  return {
    type: workout.workoutType,
    distanceKm: workout.distanceKm,
    durationMin: workout.durationMin ?? null,
    targetPace: workout.targetPace,
    targetHR: workout.targetHR,
    purpose: workout.purpose ?? workout.description ?? null,
  };
}

function compactCompletedWorkout(workout: TodayCompletedWorkoutSummary) {
  return {
    type: workout.label,
    kind: workout.kind,
    distanceKm: workout.distanceKm,
    durationMin: workout.durationMin,
    averageHR: workout.avgHR,
    pace: workout.pace,
    calories: workout.calories,
  };
}

function isRecoveryScored(context: CoachContext): boolean {
  return context.recoverySystem.scoreState === 'scored' || context.recoverySystem.scoreState === 'calibrating';
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function requiredString(value: unknown, fallback: string): string {
  return stringOrNull(value) ?? fallback;
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, 1_000) : null;
}

function stringArray(value: unknown, max: number): string[] {
  return Array.isArray(value) ? value.map(stringOrNull).filter((item): item is string => Boolean(item)).slice(0, max) : [];
}

function normalizeNextMeal(value: unknown): AiCoachAnswer['nextMeal'] {
  const input = record(value);
  const title = stringOrNull(input.title);
  const options = stringArray(input.options, 3);
  return title && options.length ? { title, timing: stringOrNull(input.timing), options } : null;
}

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function formatDuration(minutes: number | null): string | null {
  if (minutes == null || !Number.isFinite(minutes) || minutes < 0) return null;
  const rounded = Math.round(minutes);
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  if (hours && remainder) return `${hours}h ${remainder}m`;
  if (hours) return `${hours}h`;
  return `${remainder}m`;
}

function bangkokTime(): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date());
}
