import type { CoachContext, DayWorkoutSummary, NutritionDaySummary } from '@/lib/buildCoachContext';

export type WeeklyTrainingSummary = {
  sessions: number;
  distanceKm: number;
  activeMinutes: number;
  activeDays: number;
  sleepAverageHours: number | null;
  sleepNights: number;
  mealCount: number;
  mealDays: number;
  averageCaloriesPerLoggedDay: number | null;
  averageProteinPerLoggedDay: number | null;
  trainingMix: { label: string; sessions: number }[];
};

export function buildWeeklyTrainingSummary(context: CoachContext): WeeklyTrainingSummary {
  const firstDate = context.todayDate ? shiftDate(context.todayDate, -6) : null;
  const workouts = firstDate ? context.workouts7d.filter((day) => day.date >= firstDate && day.date <= context.todayDate) : context.workouts7d;
  const nutritionDays = firstDate ? context.nutrition7d.filter((day) => day.date >= firstDate && day.date <= context.todayDate) : context.nutrition7d;
  const workoutTotals = workouts.reduce((total, day) => addWorkoutDay(total, day), {
    activeMinutes: 0,
    activeDays: 0,
    distanceKm: 0,
    runSessions: 0,
    walkSessions: 0,
    otherSessions: 0,
  });
  const nutrition = nutritionDays.reduce((total, day) => addNutritionDay(total, day), {
    mealCount: 0,
    calories: 0,
    calorieDays: 0,
    protein: 0,
    proteinDays: 0,
  });

  const trainingMix = [
    { label: 'Running', sessions: workoutTotals.runSessions },
    { label: 'Walking', sessions: workoutTotals.walkSessions },
    { label: 'Other Training', sessions: workoutTotals.otherSessions },
  ].filter((item) => item.sessions > 0);

  return {
    sessions: workoutTotals.runSessions + workoutTotals.walkSessions + workoutTotals.otherSessions,
    distanceKm: Math.round(workoutTotals.distanceKm * 10) / 10,
    activeMinutes: workoutTotals.activeMinutes,
    activeDays: workoutTotals.activeDays,
    sleepAverageHours: context.sleepAvg7dHours,
    sleepNights: context.sleepNightCount7d,
    mealCount: nutrition.mealCount,
    mealDays: nutritionDays.length,
    averageCaloriesPerLoggedDay: nutrition.calorieDays ? Math.round(nutrition.calories / nutrition.calorieDays) : null,
    averageProteinPerLoggedDay: nutrition.proteinDays ? Math.round(nutrition.protein / nutrition.proteinDays) : null,
    trainingMix,
  };
}

function addWorkoutDay(total: { activeMinutes: number; activeDays: number; distanceKm: number; runSessions: number; walkSessions: number; otherSessions: number }, day: DayWorkoutSummary) {
  const dayMinutes = [
    ...day.runs.map((item) => item.durationMin),
    ...day.walks.map((item) => item.durationMin),
    ...day.other.map((item) => item.durationMin),
  ].reduce((sum, value) => sum + value, 0);
  total.activeMinutes += dayMinutes;
  total.activeDays += dayMinutes > 0 ? 1 : 0;
  total.distanceKm += day.runs.reduce((sum, run) => sum + run.km, 0);
  total.runSessions += day.runs.length;
  total.walkSessions += day.walks.length;
  total.otherSessions += day.other.length;
  return total;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function addNutritionDay(total: { mealCount: number; calories: number; calorieDays: number; protein: number; proteinDays: number }, day: NutritionDaySummary) {
  total.mealCount += day.mealCount;
  if (day.caloriesKcal !== null) { total.calories += day.caloriesKcal; total.calorieDays += 1; }
  if (day.proteinG !== null) { total.protein += day.proteinG; total.proteinDays += 1; }
  return total;
}
