import { getBangkokDateKey } from './date';
import type { NutritionTrend } from './nutritionTrends';

const NUTRITION_TRENDS_STARTUP_CACHE_KEY = 'runmate:nutrition-trends-startup:v1';

export type NutritionTrendsStartupSnapshot = {
  sevenDay: NutritionTrend;
  thirtyDay: NutritionTrend;
};

type StoredSnapshot = NutritionTrendsStartupSnapshot & {
  dateKey: string;
  savedAt: string;
};

type NutritionTrendsStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): NutritionTrendsStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isTrend(value: unknown, rangeDays: 7 | 30): value is NutritionTrend {
  if (!value || typeof value !== 'object') return false;
  const trend = value as Partial<NutritionTrend>;
  return trend.rangeDays === rangeDays
    && Array.isArray(trend.days)
    && trend.days.length === rangeDays
    && typeof trend.loggedDays === 'number'
    && typeof trend.mealCount === 'number';
}

export function loadNutritionTrendsStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: NutritionTrendsStartupStorage | null = browserStorage(),
): NutritionTrendsStartupSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(NUTRITION_TRENDS_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now)
      || !isTrend(snapshot.sevenDay, 7)
      || !isTrend(snapshot.thirtyDay, 30)) {
      storage.removeItem(NUTRITION_TRENDS_STARTUP_CACHE_KEY);
      return null;
    }
    return { sevenDay: snapshot.sevenDay, thirtyDay: snapshot.thirtyDay };
  } catch {
    storage.removeItem(NUTRITION_TRENDS_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveNutritionTrendsStartupSnapshot(
  snapshot: NutritionTrendsStartupSnapshot,
  now: Date | string | number = Date.now(),
  storage: NutritionTrendsStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const stored: StoredSnapshot = {
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      ...snapshot,
    };
    storage.setItem(NUTRITION_TRENDS_STARTUP_CACHE_KEY, JSON.stringify(stored));
  } catch {
    // Startup acceleration is best-effort.
  }
}

export function clearNutritionTrendsStartupSnapshot(
  storage: NutritionTrendsStartupStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(NUTRITION_TRENDS_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
