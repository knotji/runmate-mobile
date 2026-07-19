import { describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { buildDailyNutritionSummary } from './activityNutritionSummary';

function meal(id: string, dateKey: string, nutrition: Record<string, unknown>): LocalHistoryItem {
  return { id, type: 'meal', createdAt: `${dateKey}T12:00:00Z`, dateKey, data: { nutrition } };
}

describe('Daily Activity Nutrition Summary', () => {
  it('totals only meals from the selected date', () => {
    const items = [
      meal('breakfast', '2026-07-19', { caloriesKcal: 420, proteinG: 24, carbsG: 55, fatG: 12 }),
      meal('dinner', '2026-07-19', { caloriesKcal: 610, proteinG: 38, carbsG: 70, fatG: 19 }),
      meal('yesterday', '2026-07-18', { caloriesKcal: 900, proteinG: 80 }),
    ];
    expect(buildDailyNutritionSummary(items, '2026-07-19')).toEqual({ mealCount: 2, caloriesKcal: 1030, proteinG: 62, carbsG: 125, fatG: 31 });
  });

  it('keeps unavailable macros unknown instead of treating them as zero', () => {
    expect(buildDailyNutritionSummary([meal('meal', '2026-07-19', { caloriesKcal: 350 })], '2026-07-19')).toEqual({ mealCount: 1, caloriesKcal: 350, proteinG: null, carbsG: null, fatG: null });
  });
});
