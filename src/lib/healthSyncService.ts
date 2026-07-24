import { getBangkokDateKey } from '@/lib/date';
import { syncSamsungSleep, type SamsungSleepSyncResult } from '@/lib/samsungSleepSync';
import { syncSamsungWeight, type SamsungWeightSyncResult } from '@/lib/samsungProfileSync';
import { syncSamsungWorkouts, type SamsungWorkoutSyncResult } from '@/lib/samsungWorkoutSync';
import { syncSamsungBody, type SamsungBodySyncResult } from '@/lib/samsungBodySync';

export const TODAY_SYNC_COOLDOWN_MS = 3 * 60_000;
export const TODAY_SYNC_STORAGE_KEY = 'runmate:today-health-last-completed-at';
export const HEALTH_HISTORY_LOOKBACK_DAYS = 30;

export type TodayHealthSyncResult = {
  performed: boolean;
  changed: boolean;
  sleep: SamsungSleepSyncResult | null;
  workout: SamsungWorkoutSyncResult | null;
};

export type TodayHealthSyncPerformance = {
  status: 'success' | 'skipped';
  variant: 'prepared' | 'mixed' | 'live' | 'cooldown';
  detail: string;
};

export type HealthHistorySyncResult = {
  changed: boolean;
  sleep: SamsungSleepSyncResult;
  workout: SamsungWorkoutSyncResult;
  weight: SamsungWeightSyncResult;
  body: SamsungBodySyncResult;
};

let activeTodaySync: Promise<TodayHealthSyncResult> | null = null;
let activeHistorySync: Promise<HealthHistorySyncResult> | null = null;
let activeWorkoutRepair: Promise<SamsungWorkoutSyncResult> | null = null;
let lastCompletedAt = 0;

export function shouldSyncToday(lastSyncAt: number, now: number, force = false): boolean {
  return force
    || !lastSyncAt
    || getBangkokDateKey(lastSyncAt) !== getBangkokDateKey(now)
    || now - lastSyncAt >= TODAY_SYNC_COOLDOWN_MS;
}

/** Syncs only today's Sleep and Workout records. Used by foreground pages. */
export function syncTodayHealth(force = false): Promise<TodayHealthSyncResult> {
  if (activeTodaySync) return activeTodaySync;
  const previousSyncAt = Math.max(lastCompletedAt, getPersistedTodaySyncAt());
  if (!shouldSyncToday(previousSyncAt, Date.now(), force)) {
    return Promise.resolve({ performed: false, changed: false, sleep: null, workout: null });
  }

  activeTodaySync = Promise.all([syncSamsungSleep('today'), syncSamsungWorkouts('today')])
    .then(([sleep, workout]) => {
      lastCompletedAt = Date.now();
      persistTodaySyncAt(lastCompletedAt);
      return { performed: true, changed: hasHealthChanges(sleep, workout), sleep, workout };
    })
    .finally(() => { activeTodaySync = null; });
  return activeTodaySync;
}

/** Syncs the user-requested Health Connect history window plus the latest weight. */
export function syncHealthHistory(): Promise<HealthHistorySyncResult> {
  if (activeHistorySync) return activeHistorySync;
  activeHistorySync = Promise.all([
    syncSamsungSleep(HEALTH_HISTORY_LOOKBACK_DAYS),
    syncSamsungWorkouts(HEALTH_HISTORY_LOOKBACK_DAYS),
    syncSamsungWeight(),
    syncSamsungBody(HEALTH_HISTORY_LOOKBACK_DAYS),
  ])
    .then(([sleep, workout, weight, body]) => ({
      changed: hasHealthChanges(sleep, workout),
      sleep,
      workout,
      weight,
      body,
    }))
    .finally(() => { activeHistorySync = null; });
  return activeHistorySync;
}

/** Re-runs Workout reconciliation without touching Sleep or Profile data. */
export function repairWorkoutHistory(): Promise<SamsungWorkoutSyncResult> {
  if (activeWorkoutRepair) return activeWorkoutRepair;
  activeWorkoutRepair = syncSamsungWorkouts(HEALTH_HISTORY_LOOKBACK_DAYS)
    .finally(() => { activeWorkoutRepair = null; });
  return activeWorkoutRepair;
}

export function hasHealthChanges(
  sleep: Pick<SamsungSleepSyncResult, 'added' | 'updated'>,
  workout: Pick<SamsungWorkoutSyncResult, 'added' | 'updated'>,
): boolean {
  return sleep.added + sleep.updated + workout.added + workout.updated > 0;
}

export function describeTodayHealthSyncPerformance(result: TodayHealthSyncResult, prefix = 'Today'): TodayHealthSyncPerformance {
  if (!result.performed) return { status: 'skipped', variant: 'cooldown', detail: 'Cooldown reused latest sync' };
  const sources = [result.sleep?.dataSource, result.workout?.dataSource].filter((source) => source === 'prepared' || source === 'live');
  const preparedCount = sources.filter((source) => source === 'prepared').length;
  const liveCount = sources.filter((source) => source === 'live').length;
  const variant = preparedCount > 0 && liveCount > 0 ? 'mixed' : preparedCount > 0 ? 'prepared' : 'live';
  const sourceLabel = variant === 'prepared' ? 'prepared snapshot' : variant === 'mixed' ? 'snapshot plus live read' : 'live Health Connect';
  return {
    status: 'success',
    variant,
    detail: `${prefix} used ${sourceLabel}; ${result.changed ? 'records changed' : 'no record changes'}`,
  };
}

export function getPersistedTodaySyncAt(): number {
  try {
    const value = Number(window.localStorage.getItem(TODAY_SYNC_STORAGE_KEY));
    return Number.isFinite(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
}

function persistTodaySyncAt(value: number): void {
  try { window.localStorage.setItem(TODAY_SYNC_STORAGE_KEY, String(value)); }
  catch { /* The in-memory cooldown still prevents duplicate work in this session. */ }
}
