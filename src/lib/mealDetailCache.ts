import type { LocalHistoryItem } from './localHistory';

const cachedMeals = new Map<string, LocalHistoryItem>();
const MAX_CACHED_MEALS = 12;

export function cacheMealDetailItem(item: LocalHistoryItem): void {
  if (item.type !== 'meal') return;
  cachedMeals.delete(item.id);
  cachedMeals.set(item.id, item);
  while (cachedMeals.size > MAX_CACHED_MEALS) {
    const oldest = cachedMeals.keys().next().value;
    if (typeof oldest !== 'string') break;
    cachedMeals.delete(oldest);
  }
}

export function loadCachedMealDetailItem(id: string): LocalHistoryItem | null {
  const item = cachedMeals.get(id) ?? null;
  if (item) {
    cachedMeals.delete(id);
    cachedMeals.set(id, item);
  }
  return item;
}

export function clearMealDetailCache(): void {
  cachedMeals.clear();
}
