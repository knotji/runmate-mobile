import { buildDailyNutritionSummary } from '@/lib/activityNutritionSummary';
import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';

export type NutritionTrendDay = {
  date: string;
  mealCount: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  trainingDay: boolean;
};

export type NutritionDayComparison = {
  loggedDays: number;
  averageCalories: number | null;
  averageProtein: number | null;
};

export type NutritionTrend = {
  rangeDays: 7 | 30;
  days: NutritionTrendDay[];
  loggedDays: number;
  mealCount: number;
  averageCalories: number | null;
  averageProtein: number | null;
  averageCarbs: number | null;
  averageFat: number | null;
  proteinDataDays: number;
  training: NutritionDayComparison;
  rest: NutritionDayComparison;
  insight: { title: string; summary: string };
};

export function buildNutritionTrend(items: LocalHistoryItem[], rangeDays: 7 | 30, endDate: string): NutritionTrend {
  const dates = Array.from({ length: rangeDays }, (_, index) => shiftDate(endDate, index - rangeDays + 1));
  const trainingDates = new Set(items
    .filter((item) => item.type === 'workout' || item.type === 'strength')
    .map(getHistoryItemDateKey));
  const days = dates.map((date): NutritionTrendDay => {
    const summary = buildDailyNutritionSummary(items, date);
    return {
      date,
      mealCount: summary?.mealCount ?? 0,
      caloriesKcal: summary?.caloriesKcal ?? null,
      proteinG: summary?.proteinG ?? null,
      carbsG: summary?.carbsG ?? null,
      fatG: summary?.fatG ?? null,
      trainingDay: trainingDates.has(date),
    };
  });
  const logged = days.filter((day) => day.mealCount > 0);
  const training = comparison(logged.filter((day) => day.trainingDay));
  const rest = comparison(logged.filter((day) => !day.trainingDay));

  return {
    rangeDays,
    days,
    loggedDays: logged.length,
    mealCount: logged.reduce((sum, day) => sum + day.mealCount, 0),
    averageCalories: average(logged.map((day) => day.caloriesKcal)),
    averageProtein: average(logged.map((day) => day.proteinG)),
    averageCarbs: average(logged.map((day) => day.carbsG)),
    averageFat: average(logged.map((day) => day.fatG)),
    proteinDataDays: logged.filter((day) => day.proteinG !== null).length,
    training,
    rest,
    insight: buildInsight(logged, training, rest, rangeDays),
  };
}

function comparison(days: NutritionTrendDay[]): NutritionDayComparison {
  return {
    loggedDays: days.length,
    averageCalories: average(days.map((day) => day.caloriesKcal)),
    averageProtein: average(days.map((day) => day.proteinG)),
  };
}

function buildInsight(logged: NutritionTrendDay[], training: NutritionDayComparison, rest: NutritionDayComparison, rangeDays: number) {
  if (!logged.length) return { title: 'Start With One Logged Day', summary: 'Log meals to see factual Calories and Protein patterns here.' };
  if (logged.length < Math.ceil(rangeDays / 2)) return { title: 'Build A Clearer Picture', summary: `Meals are logged on ${logged.length} of ${rangeDays} days. More logged days will make comparisons more representative.` };
  if (training.loggedDays >= 2 && rest.loggedDays >= 2 && training.averageProtein !== null && rest.averageProtein !== null) {
    const difference = Math.round(training.averageProtein - rest.averageProtein);
    if (Math.abs(difference) >= 10) return difference > 0
      ? { title: 'Training Days Include More Protein', summary: `Logged Protein averages ${difference} g more on training days than rest days.` }
      : { title: 'Training Days Include Less Protein', summary: `Logged Protein averages ${Math.abs(difference)} g less on training days than rest days.` };
  }
  return { title: 'Logging Is Becoming Consistent', summary: `Meals are recorded on ${logged.length} of ${rangeDays} days, giving you a useful baseline to follow.` };
}

function average(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return present.length ? Math.round(present.reduce((sum, value) => sum + value, 0) / present.length) : null;
}

function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
