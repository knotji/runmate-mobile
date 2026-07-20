import { describe, expect, it } from 'vitest';
import { buildNutritionTrend } from '@/lib/nutritionTrends';
import type { LocalHistoryItem } from '@/lib/localHistory';

function meal(id: string, date: string, nutrition: Record<string, number>): LocalHistoryItem {
  return { id, type: 'meal', dateKey: date, createdAt: `${date}T12:00:00Z`, data: { nutrition } };
}
function workout(id: string, date: string): LocalHistoryItem {
  return { id, type: 'workout', dateKey: date, createdAt: `${date}T13:00:00Z`, data: {} };
}

describe('buildNutritionTrend', () => {
  it('builds an exact range and averages only days with available values', () => {
    const result = buildNutritionTrend([
      meal('a', '2026-07-19', { caloriesKcal: 1200, proteinG: 80, carbsG: 150, fatG: 40 }),
      meal('b', '2026-07-20', { caloriesKcal: 1600, proteinG: 100, carbsG: 200, fatG: 50 }),
      workout('run', '2026-07-20'),
    ], 7, '2026-07-20');

    expect(result.days).toHaveLength(7);
    expect(result.days[0].date).toBe('2026-07-14');
    expect(result.loggedDays).toBe(2);
    expect(result.mealCount).toBe(2);
    expect(result.averageCalories).toBe(1400);
    expect(result.averageProtein).toBe(90);
    expect(result.training).toEqual({ loggedDays: 1, averageCalories: 1600, averageProtein: 100 });
    expect(result.rest).toEqual({ loggedDays: 1, averageCalories: 1200, averageProtein: 80 });
  });

  it('keeps missing nutrition values unknown instead of zero', () => {
    const result = buildNutritionTrend([meal('a', '2026-07-20', { caloriesKcal: 500 })], 7, '2026-07-20');
    expect(result.averageProtein).toBeNull();
    expect(result.proteinDataDays).toBe(0);
    expect(result.days.at(-1)?.proteinG).toBeNull();
  });
});
