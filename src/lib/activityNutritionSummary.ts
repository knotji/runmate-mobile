import { getHistoryItemDateKey } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';

export type DailyNutritionSummary = {
  mealCount: number;
  caloriesKcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
};

export function buildDailyNutritionSummary(items: LocalHistoryItem[], date: string): DailyNutritionSummary | null {
  const meals = items.filter((item) => item.type === 'meal' && getHistoryItemDateKey(item) === date);
  if (!meals.length) return null;

  return {
    mealCount: meals.length,
    caloriesKcal: sumNutrition(meals, 'caloriesKcal'),
    proteinG: sumNutrition(meals, 'proteinG'),
    carbsG: sumNutrition(meals, 'carbsG'),
    fatG: sumNutrition(meals, 'fatG'),
  };
}

function sumNutrition(items: LocalHistoryItem[], key: string): number | null {
  const values = items
    .map((item) => asRecord(asRecord(item.data).nutrition)[key])
    .map(toFiniteNumber)
    .filter((value): value is number => value !== null);
  if (!values.length) return null;
  return Math.round(values.reduce((total, value) => total + value, 0) * 10) / 10;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
