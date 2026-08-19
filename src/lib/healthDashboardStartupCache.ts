// Dedicated startup cache for the Health tab's "This Week's Signals"
// dashboard — deliberately its own cache rather than reading/writing
// RecoveryTrendsPage/NutritionTrendsPage's caches directly. Those pages
// compute an equivalent result, but sharing their cache risks a subtly
// different shape corrupting what they expect to read back; duplicating one
// small cache entry is cheaper than that risk. Same date-keyed pattern as
// every other *StartupCache.ts module (see recoveryStartupCache.ts).
import { getBangkokDateKey } from './date';
import type { HealthDashboardData } from './healthDashboardData';

const HEALTH_DASHBOARD_STARTUP_CACHE_KEY = 'runmate:health-dashboard-startup:v1';

type StoredSnapshot = {
  dateKey: string;
  savedAt: string;
  data: HealthDashboardData;
};

type HealthDashboardStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): HealthDashboardStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isHealthDashboardData(value: unknown): value is HealthDashboardData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<HealthDashboardData>;
  return Array.isArray(data.trend) && Array.isArray(data.tiles) && Array.isArray(data.sources) && typeof data.anchorValue === 'string';
}

export function loadHealthDashboardStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: HealthDashboardStartupStorage | null = browserStorage(),
): HealthDashboardData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(HEALTH_DASHBOARD_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now) || !isHealthDashboardData(snapshot.data)) {
      storage.removeItem(HEALTH_DASHBOARD_STARTUP_CACHE_KEY);
      return null;
    }
    return snapshot.data;
  } catch {
    storage.removeItem(HEALTH_DASHBOARD_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveHealthDashboardStartupSnapshot(
  data: HealthDashboardData,
  now: Date | string | number = Date.now(),
  storage: HealthDashboardStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const snapshot: StoredSnapshot = {
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      data,
    };
    storage.setItem(HEALTH_DASHBOARD_STARTUP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup acceleration is best-effort and must never block Health.
  }
}

export function clearHealthDashboardStartupSnapshot(storage: HealthDashboardStartupStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(HEALTH_DASHBOARD_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in private or constrained web views.
  }
}
