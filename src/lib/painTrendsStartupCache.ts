import { getBangkokDateKey } from './date';
import type { PainTrendInsight, PainTrendLog, PainTrendPoint } from './painTrends';

const PAIN_TRENDS_STARTUP_CACHE_KEY = 'runmate:pain-trends-startup:v1';

export type PainTrendSnapshot = {
  points: PainTrendPoint[];
  insight: PainTrendInsight;
  logs: PainTrendLog[];
  hasActivePain: boolean;
};

export type PainTrendsStartupSnapshot = {
  sevenDay: PainTrendSnapshot;
  thirtyDay: PainTrendSnapshot;
};

type StoredSnapshot = PainTrendsStartupSnapshot & {
  dateKey: string;
  savedAt: string;
};

type StartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isTrend(value: unknown, days: 7 | 30): value is PainTrendSnapshot {
  if (!value || typeof value !== 'object') return false;
  const trend = value as Partial<PainTrendSnapshot>;
  return Array.isArray(trend.points)
    && trend.points.length === days
    && Array.isArray(trend.logs)
    && typeof trend.hasActivePain === 'boolean'
    && !!trend.insight;
}

export function loadPainTrendsStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): PainTrendsStartupSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(PAIN_TRENDS_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now)
      || !isTrend(snapshot.sevenDay, 7)
      || !isTrend(snapshot.thirtyDay, 30)) {
      storage.removeItem(PAIN_TRENDS_STARTUP_CACHE_KEY);
      return null;
    }
    return { sevenDay: snapshot.sevenDay, thirtyDay: snapshot.thirtyDay };
  } catch {
    storage.removeItem(PAIN_TRENDS_STARTUP_CACHE_KEY);
    return null;
  }
}

export function savePainTrendsStartupSnapshot(
  snapshot: PainTrendsStartupSnapshot,
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(PAIN_TRENDS_STARTUP_CACHE_KEY, JSON.stringify({
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      ...snapshot,
    }));
  } catch {
    // Startup acceleration is best-effort.
  }
}

export function clearPainTrendsStartupSnapshot(
  storage: StartupStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(PAIN_TRENDS_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
