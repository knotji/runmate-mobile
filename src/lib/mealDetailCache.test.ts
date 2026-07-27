import { beforeEach, describe, expect, it } from 'vitest';
import type { LocalHistoryItem } from './localHistory';
import { cacheMealDetailItem, clearMealDetailCache, loadCachedMealDetailItem } from './mealDetailCache';

function item(id: string, type: LocalHistoryItem['type'] = 'meal'): LocalHistoryItem {
  return { id, type, createdAt: '2026-07-27T00:00:00.000Z', data: {} };
}

describe('Meal Detail cache', () => {
  beforeEach(() => clearMealDetailCache());

  it('keeps an existing meal available for immediate detail rendering', () => {
    cacheMealDetailItem(item('meal-1'));
    expect(loadCachedMealDetailItem('meal-1')).toEqual(item('meal-1'));
  });

  it('ignores non-meal records and clears on sign out', () => {
    cacheMealDetailItem(item('workout-1', 'workout'));
    expect(loadCachedMealDetailItem('workout-1')).toBeNull();

    cacheMealDetailItem(item('meal-1'));
    clearMealDetailCache();
    expect(loadCachedMealDetailItem('meal-1')).toBeNull();
  });
});
