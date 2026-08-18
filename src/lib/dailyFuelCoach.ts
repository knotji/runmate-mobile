import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { UserProfile } from '@/types/profile';
import type { WeekWorkout } from '@/types/race';

export type FuelDayType = 'rest' | 'easy' | 'strength' | 'hard' | 'long';
export type FuelMacroTarget = { logged: number | null; minimum: number; maximum: number; remainingToMinimum: number | null; source: 'profile' | 'calculated' };
export type DailyFuelCoach = {
  status: 'needs_weight' | 'ready';
  dayType: FuelDayType;
  dayLabel: string;
  basedOnLoggedTraining: boolean;
  mealCount: number;
  completeMacroMeals: number;
  coverage: 'none' | 'partial' | 'stronger';
  protein: FuelMacroTarget | null;
  carbs: FuelMacroTarget | null;
  recommendation: { title: string; detail: string };
  note: string;
};

export function buildDailyFuelCoach(options: {
  date: string;
  items: LocalHistoryItem[];
  profile: UserProfile | null;
  plannedWorkout?: WeekWorkout | null;
}): DailyFuelCoach {
  const meals = options.items.filter((item) => item.type === 'meal' && getHistoryItemDateKey(item) === options.date);
  const workouts = options.items.filter((item) => (item.type === 'workout' || item.type === 'strength') && getHistoryItemDateKey(item) === options.date);
  const dayType = classifyDay(workouts, options.plannedWorkout ?? null);
  const dayLabel = describeDay(workouts, options.plannedWorkout ?? null, dayType);
  const plannedType = options.plannedWorkout ? classifyDay([], options.plannedWorkout) : null;
  const basedOnLoggedTraining = workouts.length > 0 && plannedType != null && plannedType !== dayType;
  const mealCount = meals.length;
  const completeMacroMeals = meals.filter((meal) => {
    const nutrition = record(record(meal.data).nutrition);
    return number(nutrition.proteinG) != null && number(nutrition.carbsG) != null;
  }).length;
  const coverage = mealCount === 0 ? 'none' : mealCount >= 3 && completeMacroMeals >= 2 ? 'stronger' : 'partial';
  const proteinLogged = sum(meals, 'proteinG');
  const carbsLogged = sum(meals, 'carbsG');
  const weight = validWeight(options.profile?.weightKg);
  if (weight == null) {
    return {
      status: 'needs_weight', dayType, dayLabel, basedOnLoggedTraining, mealCount, completeMacroMeals, coverage,
      protein: null, carbs: null,
      recommendation: { title: 'Add Your Body Weight', detail: 'WholeMate needs a current weight to calculate personal protein and carbohydrate ranges.' },
      note: 'Meal totals remain available, but WholeMate will not guess a personal target.',
    };
  }

  const proteinOverride = positive(options.profile?.proteinTargetG);
  const carbOverride = carbProfileTarget(options.profile, dayType);
  const proteinRange = proteinOverride != null ? [proteinOverride, proteinOverride] : scale(weight, proteinFactors(dayType));
  const carbRange = carbOverride != null ? [carbOverride, carbOverride] : scale(weight, carbFactors(dayType));
  const protein = macro(proteinLogged, proteinRange, proteinOverride != null);
  const carbs = macro(carbsLogged, carbRange, carbOverride != null);
  return {
    status: 'ready', dayType, dayLabel, basedOnLoggedTraining, mealCount, completeMacroMeals, coverage,
    protein, carbs,
    recommendation: recommendation(dayType, mealCount, protein, carbs),
    note: coverage === 'stronger'
      ? `${mealCount} meals logged. Targets are guidance ranges, not a medical prescription.`
      : `${mealCount} ${mealCount === 1 ? 'meal' : 'meals'} logged. Remaining amounts may be overstated until the day is fully logged.`,
  };
}

function classifyDay(workouts: LocalHistoryItem[], planned: WeekWorkout | null): FuelDayType {
  const text = trainingText(workouts, planned);
  if (/long|marathon|race|half marathon/.test(text)) return 'long';
  if (/interval|tempo|threshold|speed|vo2|hill repeat/.test(text)) return 'hard';
  if (/strength|weight|barbell|gym/.test(text)) return 'strength';
  if (/run|walk|cycling|swim|easy|recovery/.test(text)) return 'easy';
  return 'rest';
}

function describeDay(workouts: LocalHistoryItem[], planned: WeekWorkout | null, type: FuelDayType): string {
  const text = trainingText(workouts, planned);
  if (/interval/.test(text)) return 'Interval Day';
  if (/tempo|threshold/.test(text)) return 'Tempo Day';
  if (/hill repeat/.test(text)) return 'Hill Workout Day';
  if (/speed|vo2/.test(text)) return 'Speed Day';
  if (/race|marathon|half marathon/.test(text)) return 'Race Day';
  return label(type);
}

function trainingText(workouts: LocalHistoryItem[], planned: WeekWorkout | null): string {
  const actual = workouts.map((item) => {
    const data = record(item.data); const extracted = record(data.extracted);
    const distance = number(extracted.distanceKm);
    return `${item.type} ${distance != null && distance >= 10 ? 'long' : ''} ${String(extracted.workoutKind ?? '')} ${String(extracted.workoutName ?? '')} ${String(data.workoutType ?? '')}`.toLowerCase();
  }).join(' ').trim();
  return actual || `${planned?.workoutType ?? ''} ${planned?.description ?? ''}`.toLowerCase();
}

function proteinFactors(type: FuelDayType): [number, number] {
  if (type === 'hard' || type === 'long' || type === 'strength') return [1.6, 2];
  if (type === 'easy') return [1.4, 1.8];
  return [1.4, 1.6];
}
function carbFactors(type: FuelDayType): [number, number] {
  if (type === 'long') return [5, 7];
  if (type === 'hard') return [4.5, 6];
  if (type === 'easy' || type === 'strength') return [3.5, 5];
  return [3, 4];
}
function carbProfileTarget(profile: UserProfile | null, type: FuelDayType): number | null {
  if (!profile) return null;
  if (type === 'hard' || type === 'long') return positive(profile.carbTargetHardDayG);
  if (type === 'easy' || type === 'strength') return positive(profile.carbTargetEasyDayG);
  return positive(profile.carbTargetRestDayG);
}
function macro(logged: number | null, range: number[], overridden: boolean): FuelMacroTarget {
  const minimum = range[0]; const maximum = range[1];
  return { logged, minimum, maximum, remainingToMinimum: logged == null ? null : Math.max(0, Math.round(minimum - logged)), source: overridden ? 'profile' : 'calculated' };
}
function recommendation(type: FuelDayType, mealCount: number, protein: FuelMacroTarget, carbs: FuelMacroTarget): DailyFuelCoach['recommendation'] {
  if (mealCount === 0) return { title: 'Log Your First Meal', detail: `Start with one meal so WholeMate can compare today's ${label(type).toLowerCase()} targets with what you actually ate.` };
  if (protein.logged == null || carbs.logged == null) return { title: 'Complete The Macro Picture', detail: 'At least one logged meal is missing protein or carbohydrate values. Add or review those values before relying on the remaining target.' };
  const proteinRemaining = protein.remainingToMinimum ?? 0;
  const carbRemaining = carbs.remainingToMinimum ?? 0;
  if ((type === 'hard' || type === 'long') && carbRemaining > 0) return { title: 'Prioritize Carbohydrate', detail: `About ${carbRemaining} g remains to reach the lower end of today's carbohydrate range. Pair it with protein across your next meals.` };
  if (proteinRemaining > 0) return { title: 'Spread Protein Across The Day', detail: `About ${proteinRemaining} g remains to reach the lower end of today's protein range. Add a practical protein source to the next meal.` };
  if (carbRemaining > 0) return { title: 'Add Training Fuel', detail: `About ${carbRemaining} g remains to reach the lower end of today's carbohydrate range.` };
  return { title: 'Lower Targets Reached', detail: 'Your logged meals have reached the lower end of both guidance ranges. Continue eating to appetite and recovery needs.' };
}
function label(type: FuelDayType): string { return ({ rest: 'Rest Day', easy: 'Easy Training Day', strength: 'Strength Day', hard: 'Hard Training Day', long: 'Long Run Day' })[type]; }
function scale(weight: number, factors: [number, number]): [number, number] { return [Math.round(weight * factors[0]), Math.round(weight * factors[1])]; }
function sum(meals: LocalHistoryItem[], key: string): number | null { const values = meals.map((meal) => number(record(record(meal.data).nutrition)[key])).filter((value): value is number => value != null); return values.length ? Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10 : null; }
function validWeight(value: unknown): number | null { const parsed = number(value); return parsed != null && parsed >= 30 && parsed <= 300 ? parsed : null; }
function positive(value: unknown): number | null { const parsed = number(value); return parsed != null && parsed > 0 ? parsed : null; }
function number(value: unknown): number | null { const parsed = typeof value === 'number' ? value : typeof value === 'string' && value.trim() ? Number(value) : NaN; return Number.isFinite(parsed) ? parsed : null; }
function record(value: unknown): Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
