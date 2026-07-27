import { getBangkokDateKey } from './date';
import type { RecoveryTrend } from './recoveryTrends';

const RECOVERY_TRENDS_STARTUP_CACHE_KEY = 'runmate:recovery-trends-startup:v1';

export type RecoveryTrendsStartupSnapshot = {
  sevenDay: RecoveryTrend;
  thirtyDay: RecoveryTrend;
};

type StoredSnapshot = RecoveryTrendsStartupSnapshot & {
  dateKey: string;
  savedAt: string;
};

type RecoveryTrendsStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): RecoveryTrendsStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isTrend(value: unknown, days: 7 | 30): value is RecoveryTrend {
  if (!value || typeof value !== 'object') return false;
  const trend = value as Partial<RecoveryTrend>;
  return Array.isArray(trend.points)
    && trend.points.length === days
    && Boolean(trend.insight)
    && Boolean(trend.calibration);
}

export function loadRecoveryTrendsStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: RecoveryTrendsStartupStorage | null = browserStorage(),
): RecoveryTrendsStartupSnapshot | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RECOVERY_TRENDS_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now)
      || !isTrend(snapshot.sevenDay, 7)
      || !isTrend(snapshot.thirtyDay, 30)) {
      storage.removeItem(RECOVERY_TRENDS_STARTUP_CACHE_KEY);
      return null;
    }
    return { sevenDay: snapshot.sevenDay, thirtyDay: snapshot.thirtyDay };
  } catch {
    storage.removeItem(RECOVERY_TRENDS_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveRecoveryTrendsStartupSnapshot(
  snapshot: RecoveryTrendsStartupSnapshot,
  now: Date | string | number = Date.now(),
  storage: RecoveryTrendsStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(RECOVERY_TRENDS_STARTUP_CACHE_KEY, JSON.stringify({
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      ...snapshot,
    } satisfies StoredSnapshot));
  } catch {
    // Startup acceleration is best-effort.
  }
}

export function clearRecoveryTrendsStartupSnapshot(
  storage: RecoveryTrendsStartupStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(RECOVERY_TRENDS_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
