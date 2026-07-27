import { getBangkokDateKey, getHistoryItemDateKey } from './date';
import type { LocalHistoryItem } from './localHistory';

const ACTIVITY_STARTUP_CACHE_KEY = 'runmate:activity-startup:v1';
const MAX_CACHED_TODAY_ITEMS = 80;

type ActivityStartupSnapshot = {
  dateKey: string;
  savedAt: string;
  items: LocalHistoryItem[];
};

type ActivityStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): ActivityStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isHistoryItem(value: unknown): value is LocalHistoryItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<LocalHistoryItem>;
  return typeof item.id === 'string'
    && typeof item.type === 'string'
    && typeof item.createdAt === 'string'
    && 'data' in item;
}

export function loadActivityStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: ActivityStartupStorage | null = browserStorage(),
): LocalHistoryItem[] | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(ACTIVITY_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<ActivityStartupSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now)
      || !Array.isArray(snapshot.items)
      || !snapshot.items.every(isHistoryItem)) {
      storage.removeItem(ACTIVITY_STARTUP_CACHE_KEY);
      return null;
    }
    return snapshot.items;
  } catch {
    storage.removeItem(ACTIVITY_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveActivityStartupSnapshot(
  items: LocalHistoryItem[],
  now: Date | string | number = Date.now(),
  storage: ActivityStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  const dateKey = getBangkokDateKey(now);
  const todayItems = items
    .filter((item) => getHistoryItemDateKey(item) === dateKey)
    .slice(0, MAX_CACHED_TODAY_ITEMS);
  try {
    const snapshot: ActivityStartupSnapshot = {
      dateKey,
      savedAt: new Date(now).toISOString(),
      items: todayItems,
    };
    storage.setItem(ACTIVITY_STARTUP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Activity startup acceleration is best-effort.
  }
}

export function clearActivityStartupSnapshot(storage: ActivityStartupStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(ACTIVITY_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
