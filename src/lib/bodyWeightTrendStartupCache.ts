import { getBangkokDateKey } from './date';
import type { BodyWeightTrend } from './bodyWeightTrend';

const BODY_WEIGHT_TREND_STARTUP_CACHE_KEY = 'runmate:body-weight-trend-startup:v1';

export type BodyWeightTrendStartupSnapshot = {
  sevenDay: BodyWeightTrend;
  thirtyDay: BodyWeightTrend;
};

type StoredSnapshot = BodyWeightTrendStartupSnapshot & {
  dateKey: string;
  savedAt: string;
};

type StartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isTrend(value: unknown, days: 7 | 30): value is BodyWeightTrend {
  if (!value || typeof value !== 'object') return false;
  const trend = value as Partial<BodyWeightTrend>;
  return Array.isArray(trend.points)
    && trend.points.length === days
    && Array.isArray(trend.logs)
    && typeof trend.hasEnoughData === 'boolean'
    && !!trend.insight;
}

export function loadBodyWeightTrendStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): BodyWeightTrendStartupSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(BODY_WEIGHT_TREND_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now)
      || !isTrend(snapshot.sevenDay, 7)
      || !isTrend(snapshot.thirtyDay, 30)) {
      storage.removeItem(BODY_WEIGHT_TREND_STARTUP_CACHE_KEY);
      return null;
    }
    return { sevenDay: snapshot.sevenDay, thirtyDay: snapshot.thirtyDay };
  } catch {
    storage.removeItem(BODY_WEIGHT_TREND_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveBodyWeightTrendStartupSnapshot(
  snapshot: BodyWeightTrendStartupSnapshot,
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(BODY_WEIGHT_TREND_STARTUP_CACHE_KEY, JSON.stringify({
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      ...snapshot,
    }));
  } catch {
    // Startup acceleration is best-effort.
  }
}

export function clearBodyWeightTrendStartupSnapshot(
  storage: StartupStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(BODY_WEIGHT_TREND_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
