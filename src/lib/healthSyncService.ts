import { getBangkokDateKey } from '@/lib/date';
import { syncSamsungSleep, type SamsungSleepSyncResult } from '@/lib/samsungSleepSync';
import { syncSamsungWeight, type SamsungWeightSyncResult } from '@/lib/samsungProfileSync';
import { syncSamsungWorkouts, type SamsungWorkoutSyncResult } from '@/lib/samsungWorkoutSync';

export const TODAY_SYNC_COOLDOWN_MS = 3 * 60_000;
export const TODAY_SYNC_STORAGE_KEY = 'runmate:today-health-last-completed-at';
export const HEALTH_HISTORY_LOOKBACK_DAYS = 30;

export type TodayHealthSyncResult = {
  performed: boolean;
  changed: boolean;
  sleep: SamsungSleepSyncResult | null;
  workout: SamsungWorkoutSyncResult | null;
};

export type HealthHistorySyncResult = {
  changed: boolean;
  sleep: SamsungSleepSyncResult;
  workout: SamsungWorkoutSyncResult;
  weight: SamsungWeightSyncResult;
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
  ])
    .then(([sleep, workout, weight]) => ({
      changed: hasHealthChanges(sleep, workout),
      sleep,
      workout,
      weight,
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
