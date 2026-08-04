import { supabase } from '@/lib/supabaseClient';
import type { CoachContext } from '@/lib/buildCoachContext';
import type { RaceGoal, RacePlan } from '@/types/race';

export type RacePlanGenerationContext = {
  todayDate: string;
  recoveryScore: number;
  recoveryState: string;
  totalRunKm: number;
  longestRunKm: number | null;
  activePain: boolean;
  activeSick: boolean;
  recentWorkouts: CoachContext['workouts7d'];
  completedWorkoutDates: string[];
  currentWeeklyPlan: unknown[];
};

export function buildRacePlanGenerationContext(context: CoachContext): RacePlanGenerationContext {
  const recovery = context.recoverySystem;
  const currentPlan = record(context.racePlan);
  const weeklyPlan = Array.isArray(currentPlan.weeklyPlan) ? currentPlan.weeklyPlan : [];
  return {
    todayDate: context.todayDate,
    recoveryScore: recovery.overallScore,
    recoveryState: recovery.scoreState,
    totalRunKm: context.totalRunKm,
    longestRunKm: context.longestRun7dKm,
    activePain: context.activePain,
    activeSick: context.activeSick,
    recentWorkouts: context.workouts7d,
    completedWorkoutDates: context.workouts7d.filter(hasRecordedWorkout).map((day) => day.date),
    currentWeeklyPlan: weeklyPlan,
  };
}

export async function generateRacePlan(goal: RaceGoal, context: CoachContext): Promise<RacePlan> {
  const { data, error } = await supabase.functions.invoke('generate-race-plan', {
    body: {
      goal,
      context: buildRacePlanGenerationContext(context),
    },
  });
  if (error) throw new Error(error.message.includes('non-2xx') ? 'Could Not Generate A Training Plan. Please Try Again.' : error.message);
  if (!data?.data) throw new Error(data?.error ?? 'Race Plan Generation Returned No Result');
  return data.data as RacePlan;
}

function hasRecordedWorkout(day: CoachContext['workouts7d'][number]): boolean {
  return day.runs.length > 0 || day.walks.length > 0 || day.other.length > 0;
}

function record(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
