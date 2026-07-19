import { syncSamsungSleep, type SamsungSleepSyncResult } from '@/lib/samsungSleepSync';
import { syncSamsungWorkouts, type SamsungWorkoutSyncResult } from '@/lib/samsungWorkoutSync';

export const TODAY_SYNC_COOLDOWN_MS = 3 * 60_000;

export type TodayHealthSyncResult = {
  performed: boolean;
  sleep: SamsungSleepSyncResult | null;
  workout: SamsungWorkoutSyncResult | null;
};

let activeSync: Promise<TodayHealthSyncResult> | null = null;
let lastCompletedAt = 0;

export function shouldSyncToday(lastSyncAt: number, now: number, force = false): boolean {
  return force || !lastSyncAt || now - lastSyncAt >= TODAY_SYNC_COOLDOWN_MS;
}

export function syncTodayHealth(force = false): Promise<TodayHealthSyncResult> {
  if (activeSync) return activeSync;
  if (!shouldSyncToday(lastCompletedAt, Date.now(), force)) {
    return Promise.resolve({ performed: false, sleep: null, workout: null });
  }

  activeSync = Promise.all([syncSamsungSleep('today'), syncSamsungWorkouts('today')])
    .then(([sleep, workout]) => {
      lastCompletedAt = Date.now();
      return { performed: true, sleep, workout };
    })
    .finally(() => { activeSync = null; });
  return activeSync;
}
