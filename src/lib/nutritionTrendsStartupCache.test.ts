import { beforeEach, describe, expect, it } from 'vitest';
import { buildNutritionTrend } from './nutritionTrends';
import {
  clearNutritionTrendsStartupSnapshot,
  loadNutritionTrendsStartupSnapshot,
  saveNutritionTrendsStartupSnapshot,
} from './nutritionTrendsStartupCache';

describe('Nutrition Trends startup cache', () => {
  beforeEach(() => window.localStorage.clear());

  it('reuses both trend ranges only on the same Bangkok day', () => {
    const snapshot = {
      sevenDay: buildNutritionTrend([], 7, '2026-07-27'),
      thirtyDay: buildNutritionTrend([], 30, '2026-07-27'),
    };
    saveNutritionTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');

    expect(loadNutritionTrendsStartupSnapshot('2026-07-27T12:00:00.000Z')).toEqual(snapshot);
    expect(loadNutritionTrendsStartupSnapshot('2026-07-27T18:00:00.000Z')).toBeNull();
  });

  it('rejects malformed data and supports sign-out clearing', () => {
    window.localStorage.setItem('runmate:nutrition-trends-startup:v1', '{"dateKey":"2026-07-27"}');
    expect(loadNutritionTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();

    const snapshot = {
      sevenDay: buildNutritionTrend([], 7, '2026-07-27'),
      thirtyDay: buildNutritionTrend([], 30, '2026-07-27'),
    };
    saveNutritionTrendsStartupSnapshot(snapshot, '2026-07-27T05:00:00.000Z');
    clearNutritionTrendsStartupSnapshot();
    expect(loadNutritionTrendsStartupSnapshot('2026-07-27T05:00:00.000Z')).toBeNull();
  });
});
