import type { RaceGoal, RacePlan, WeekWorkout } from '@/types/race';
import { translatePlanFieldToEnglish } from '@/lib/todayTrainingPlan';

const DISTANCE_KM: Record<string, number> = {
  '5K': 5,
  '10K': 10,
  'Half Marathon': 21.0975,
  'Full Marathon': 42.195,
};

export type MobileRaceSummary = {
  daysRemaining: number;
  weeksRemaining: number;
  currentWeek: number | null;
  totalWeeks: number | null;
  phase: string | null;
  targetPace: string | null;
  scheduledSessions: number;
  scheduledDistanceKm: number;
  workouts: WeekWorkout[];
};

export function buildMobileRaceSummary(goal: RaceGoal, plan: RacePlan | null, today: string): MobileRaceSummary {
  const daysRemaining = Math.max(0, dateDiffDays(today, goal.raceDate));
  const weeksRemaining = Math.max(0, Math.ceil(daysRemaining / 7));
  const totalWeeks = plan?.totalWeeks && plan.totalWeeks > 0 ? plan.totalWeeks : null;
  const currentWeek = totalWeeks == null ? null : Math.min(totalWeeks, Math.max(1, totalWeeks - weeksRemaining + 1));
  const workouts = Array.isArray(plan?.weeklyPlan)
    ? plan.weeklyPlan
    : currentWeek != null
      ? plan?.weeks?.find((week) => week.weekNumber === currentWeek)?.workouts ?? []
      : plan?.weeks?.[0]?.workouts ?? [];
  const activeWorkouts = workouts.filter((workout) => !/rest|พัก/i.test(workout.workoutType));

  return {
    daysRemaining,
    weeksRemaining,
    currentWeek,
    totalWeeks,
    phase: plan?.currentPhase ?? plan?.weeks?.find((week) => week.weekNumber === currentWeek)?.phase ?? null,
    targetPace: calculateTargetPace(goal),
    scheduledSessions: activeWorkouts.length,
    scheduledDistanceKm: roundOne(activeWorkouts.reduce((sum, workout) => sum + (workout.distanceKm ?? 0), 0)),
    workouts,
  };
}

export function formatRaceWorkoutMetric(workout: WeekWorkout): string {
  const workoutType = workout.workoutType.trim().toLowerCase();
  if (/\brest\b/.test(workoutType)) return 'Rest Day';
  if (/\brecovery\b/.test(workoutType)) {
    return workout.durationMin != null && workout.durationMin > 0
      ? `${workout.durationMin} min · Easy Recovery`
      : 'Recovery Day';
  }

  return [
    workout.distanceKm != null && workout.distanceKm > 0 ? `${workout.distanceKm} km` : null,
    workout.durationMin != null && workout.durationMin > 0 ? `${workout.durationMin} min` : null,
    workout.targetPace && !/^n\/?a$/i.test(workout.targetPace.trim()) ? translatePlanFieldToEnglish(workout.targetPace) : null,
  ].filter(Boolean).join(' · ');
}

export function isRaceWorkoutToday(workout: WeekWorkout, today: string): boolean {
  const dated = workout as WeekWorkout & { date?: string; dateKey?: string; dayDate?: string };
  const explicitDate = dated.date ?? dated.dateKey ?? dated.dayDate;
  if (explicitDate) return explicitDate.slice(0, 10) === today;

  const date = new Date(`${today}T12:00:00+07:00`);
  if (Number.isNaN(date.getTime())) return false;
  return normalizeWeekday(workout.day) === date.getDay();
}

function calculateTargetPace(goal: RaceGoal): string | null {
  const distance = DISTANCE_KM[goal.raceDistance];
  if (!distance || !goal.targetTime) return null;
  const parts = goal.targetTime.split(':').map(Number);
  if (parts.some((value) => !Number.isFinite(value))) return null;
  const seconds = parts.length === 3
    ? parts[0] * 3600 + parts[1] * 60 + parts[2]
    : parts.length === 2
      ? parts[0] * 60 + parts[1]
      : 0;
  if (seconds <= 0) return null;
  const pace = Math.round(seconds / distance);
  return `${Math.floor(pace / 60)}:${String(pace % 60).padStart(2, '0')}/km`;
}

function dateDiffDays(from: string, to: string): number {
  const start = Date.parse(`${from}T12:00:00+07:00`);
  const end = Date.parse(`${to}T12:00:00+07:00`);
  return Number.isFinite(start) && Number.isFinite(end) ? Math.round((end - start) / 86_400_000) : 0;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}

function normalizeWeekday(value: string): number {
  const day = value.trim().toLowerCase();
  if (/^(sun|sunday|อาทิตย์|วันอาทิตย์)/i.test(day)) return 0;
  if (/^(mon|monday|จันทร์|วันจันทร์)/i.test(day)) return 1;
  if (/^(tue|tuesday|อังคาร|วันอังคาร)/i.test(day)) return 2;
  if (/^(wed|wednesday|พุธ|วันพุธ)/i.test(day)) return 3;
  if (/^(thu|thursday|พฤหัส|วันพฤหัส)/i.test(day)) return 4;
  if (/^(fri|friday|ศุกร์|วันศุกร์)/i.test(day)) return 5;
  if (/^(sat|saturday|เสาร์|วันเสาร์)/i.test(day)) return 6;
  return -1;
}
