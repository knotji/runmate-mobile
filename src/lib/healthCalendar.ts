import { buildDailyNutritionSummary } from '@/lib/activityNutritionSummary';
import { getHistoryItemDateKey, shiftDate } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { parseSleepDurationToMinutes } from '@/lib/sleepDuration';
import type { DailyStrainCheckIn } from '@/lib/strainContext';
import { workoutDurationMinutes } from '@/lib/workoutDuration';

const CAFFEINE_PATTERN = /\b(coffee|espresso|americano|latte|cappuccino|mocha|cold brew|tea|matcha|cocoa|chocolate|energy drink|cola)\b|กาแฟ|ชา|มัทฉะ|โกโก้|ช็อกโกแลต|เครื่องดื่มชูกำลัง/i;

export type HealthCalendarDay = {
  date: string;
  sleepMinutes: number | null;
  sleepScore: number | null;
  restingHr: number | null;
  hrv: number | null;
  workoutCount: number;
  workoutMinutes: number;
  distanceKm: number;
  mealCount: number;
  caffeineLogged: boolean;
  lateCaffeineLogged: boolean;
  stress: DailyStrainCheckIn['stress'];
};

export type HabitImpactInsight = {
  key: 'late_caffeine' | 'training_day' | 'stress';
  title: string;
  outcome: string;
  detail: string;
  status: 'ready' | 'collecting';
  withHabitDays: number;
  comparisonDays: number;
  deltaMinutes: number | null;
  confidence: 'Early Signal' | 'Building' | 'Stronger Pattern' | 'Need More Data';
};

export function buildHealthCalendarDays(items: LocalHistoryItem[], dates: string[], checkIns: DailyStrainCheckIn[] = []): HealthCalendarDay[] {
  const checkInsByDate = new Map(checkIns.map((item) => [item.date, item]));
  return dates.map((date) => buildDay(items, date, checkInsByDate.get(date) ?? null));
}

export function buildHabitImpactInsights(items: LocalHistoryItem[], checkIns: DailyStrainCheckIn[] = []): HabitImpactInsight[] {
  const sleepByDate = new Map<string, number>();
  for (const item of items.filter((entry) => entry.type === 'sleep')) {
    const minutes = sleepMinutes(item);
    if (minutes != null) sleepByDate.set(getHistoryItemDateKey(item), minutes);
  }

  const knownDates = [...new Set(items.map(getHistoryItemDateKey))].sort();
  const mealDates = new Set(items.filter((item) => item.type === 'meal').map(getHistoryItemDateKey));
  const lateCaffeineDates = new Set(items.filter((item) => item.type === 'meal' && isLateCaffeine(item)).map(getHistoryItemDateKey));
  const trainingDates = new Set(items.filter(isWorkout).map(getHistoryItemDateKey));
  const checkInByDate = new Map(checkIns.filter((item) => item.stress != null).map((item) => [item.date, item]));

  const lateCaffeine = compareNextSleep(
    knownDates.filter((date) => mealDates.has(date) && lateCaffeineDates.has(date)),
    knownDates.filter((date) => mealDates.has(date) && !lateCaffeineDates.has(date)),
    sleepByDate,
  );
  const training = compareNextSleep(
    knownDates.filter((date) => trainingDates.has(date)),
    knownDates.filter((date) => !trainingDates.has(date)),
    sleepByDate,
  );
  const stress = compareNextSleep(
    [...checkInByDate].filter(([, value]) => value.stress === 'moderate' || value.stress === 'high').map(([date]) => date),
    [...checkInByDate].filter(([, value]) => value.stress === 'low').map(([date]) => date),
    sleepByDate,
  );

  return [
    insight('late_caffeine', 'Late Caffeine Logs', lateCaffeine, 'Compares next-morning sleep after logged caffeine at or after 2 PM with other meal-logged days.'),
    insight('training_day', 'Training Days', training, 'Compares next-morning sleep after days with a recorded workout against days without one.'),
    insight('stress', 'Stress Check-Ins', stress, 'Compares next-morning sleep after moderate/high stress check-ins with low-stress check-ins.'),
  ];
}

function buildDay(items: LocalHistoryItem[], date: string, checkIn: DailyStrainCheckIn | null): HealthCalendarDay {
  const dayItems = items.filter((item) => getHistoryItemDateKey(item) === date);
  const sleep = dayItems.find((item) => item.type === 'sleep');
  const workouts = dayItems.filter(isWorkout);
  const nutrition = buildDailyNutritionSummary(dayItems, date);
  const extracted = record(record(sleep?.data).extracted);
  return {
    date,
    sleepMinutes: sleep ? sleepMinutes(sleep) : null,
    sleepScore: positiveFinite(extracted.sleepScore),
    restingHr: positiveFinite(extracted.restingHR ?? extracted.restingHr),
    hrv: positiveFinite(extracted.hrv),
    workoutCount: workouts.length,
    workoutMinutes: Math.round(workouts.reduce((sum, item) => sum + (workoutDurationMinutes(record(record(item.data).extracted), record(item.data)) ?? 0), 0)),
    distanceKm: roundOne(workouts.reduce((sum, item) => sum + (finite(record(record(item.data).extracted).distanceKm) ?? 0), 0)),
    mealCount: nutrition?.mealCount ?? 0,
    caffeineLogged: dayItems.some((item) => item.type === 'meal' && CAFFEINE_PATTERN.test(JSON.stringify(item.data))),
    lateCaffeineLogged: dayItems.some((item) => item.type === 'meal' && isLateCaffeine(item)),
    stress: checkIn?.stress ?? null,
  };
}

function insight(key: HabitImpactInsight['key'], title: string, comparison: Comparison, detail: string): HabitImpactInsight {
  const enough = comparison.withDays >= 3 && comparison.withoutDays >= 3;
  const total = comparison.withDays + comparison.withoutDays;
  const confidence: HabitImpactInsight['confidence'] = !enough ? 'Need More Data' : total >= 28 ? 'Stronger Pattern' : total >= 14 ? 'Building' : 'Early Signal';
  const delta = enough ? Math.round(comparison.withAverage - comparison.withoutAverage) : null;
  return {
    key,
    title,
    outcome: delta == null ? 'Keep logging to compare next sleep' : Math.abs(delta) < 5 ? 'About the same next-night sleep' : `${Math.abs(delta)} min ${delta > 0 ? 'more' : 'less'} next-night sleep`,
    detail,
    status: enough ? 'ready' : 'collecting',
    withHabitDays: comparison.withDays,
    comparisonDays: comparison.withoutDays,
    deltaMinutes: delta,
    confidence,
  };
}

type Comparison = { withDays: number; withoutDays: number; withAverage: number; withoutAverage: number };

function compareNextSleep(withDates: string[], withoutDates: string[], sleepByDate: Map<string, number>): Comparison {
  const withValues = withDates.map((date) => sleepByDate.get(shiftDate(date, 1))).filter((value): value is number => value != null);
  const withoutValues = withoutDates.map((date) => sleepByDate.get(shiftDate(date, 1))).filter((value): value is number => value != null);
  return { withDays: withValues.length, withoutDays: withoutValues.length, withAverage: average(withValues), withoutAverage: average(withoutValues) };
}

function isLateCaffeine(item: LocalHistoryItem): boolean {
  if (!CAFFEINE_PATTERN.test(JSON.stringify(item.data))) return false;
  const data = record(item.data);
  const timestamp = text(data.loggedAt) ?? text(data.recordedAt) ?? item.recordedAt ?? null;
  if (!timestamp) return false;
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) return false;
  const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Bangkok', hour: '2-digit', hourCycle: 'h23' }).format(date));
  return hour >= 14;
}

function sleepMinutes(item: LocalHistoryItem): number | null {
  const extracted = record(record(item.data).extracted);
  return parseSleepDurationToMinutes(extracted.actualSleepDurationMinutes ?? extracted.sleepDurationMinutes ?? extracted.sleepDuration);
}

function isWorkout(item: LocalHistoryItem): boolean { return item.type === 'workout' || item.type === 'strength'; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === 'object' ? value as Record<string, unknown> : {}; }
function text(value: unknown): string | null { return typeof value === 'string' && value.trim() ? value.trim() : null; }
function finite(value: unknown): number | null { const parsed = typeof value === 'number' ? value : Number(value); return Number.isFinite(parsed) ? parsed : null; }
function positiveFinite(value: unknown): number | null { const parsed = finite(value); return parsed != null && parsed > 0 ? parsed : null; }
function average(values: number[]): number { return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0; }
function roundOne(value: number): number { return Math.round(value * 10) / 10; }
