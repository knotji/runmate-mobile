import { getBangkokDateKey } from '@/lib/date';
import { syncSamsungSleep, type SamsungSleepSyncResult } from '@/lib/samsungSleepSync';
import { syncSamsungWeight, type SamsungWeightSyncResult } from '@/lib/samsungProfileSync';
import { syncSamsungWorkouts, type SamsungWorkoutSyncResult } from '@/lib/samsungWorkoutSync';
import { syncSamsungBody, type SamsungBodySyncResult } from '@/lib/samsungBodySync';
import { invalidateCoachContextCache } from '@/lib/coachContextService';
import { useHealthSyncStore } from '@/lib/health/healthSyncStore';
import { syncAllDayHeartRate, type AllDayHeartRateSyncResult } from '@/lib/allDayHeartRate';
import { getPersistedTodaySyncAt, persistTodaySyncAt } from '@/lib/healthSyncMetadata';

export { getPersistedTodaySyncAt, TODAY_SYNC_STORAGE_KEY } from '@/lib/healthSyncMetadata';

export const TODAY_SYNC_COOLDOWN_MS = 3 * 60_000;
export const HEALTH_HISTORY_LOOKBACK_DAYS = 30;

export type TodayHealthSyncResult = {
  performed: boolean;
  changed: boolean;
  sleep: SamsungSleepSyncResult | null;
  workout: SamsungWorkoutSyncResult | null;
  heartRate?: AllDayHeartRateSyncResult | null;
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
    return Promise.resolve({ performed: false, changed: false, sleep: null, workout: null, heartRate: null });
  }

  useHealthSyncStore.getState().startSync();
  activeTodaySync = Promise.all([syncSamsungSleep(force ? 7 : 2), syncSamsungWorkouts('today'), syncAllDayHeartRate(force)])
    .then(([sleep, workout, heartRate]) => {
      lastCompletedAt = Date.now();
      persistTodaySyncAt(lastCompletedAt);
      invalidateCoachContextCache();
      const changed = hasHealthChanges(sleep, workout);
      const detail = { sleep, workout, heartRate, changed };
      useHealthSyncStore.getState().dispatchSyncCompleted(detail);
      return { performed: true, changed, sleep, workout, heartRate };
    })
    .catch((error) => {
      useHealthSyncStore.setState({ isSyncing: false });
      throw error;
    })
    .finally(() => { activeTodaySync = null; });
  return activeTodaySync;
}

/** Syncs the user-requested Health Connect history window plus the latest weight. */
export function syncHealthHistory(): Promise<HealthHistorySyncResult> {
  if (activeHistorySync) return activeHistorySync;
  useHealthSyncStore.getState().startSync();
  activeHistorySync = Promise.all([
    syncSamsungSleep(HEALTH_HISTORY_LOOKBACK_DAYS),
    syncSamsungWorkouts(HEALTH_HISTORY_LOOKBACK_DAYS),
    syncSamsungWeight(),
    syncSamsungBody(HEALTH_HISTORY_LOOKBACK_DAYS),
  ])
    .then(([sleep, workout, weight, body]) => {
      invalidateCoachContextCache();
      const changed = hasHealthChanges(sleep, workout);
      const detail = { sleep, workout, weight, body, changed };
      useHealthSyncStore.getState().dispatchSyncCompleted(detail);
      return {
        changed,
        sleep,
        workout,
        weight,
        body,
      };
    })
    .catch((error) => {
      useHealthSyncStore.setState({ isSyncing: false });
      throw error;
    })
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
