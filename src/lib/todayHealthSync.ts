import { syncSamsungSleep, type SamsungSleepSyncResult } from '@/lib/samsungSleepSync';
import { syncSamsungWorkouts, type SamsungWorkoutSyncResult } from '@/lib/samsungWorkoutSync';
import { getBangkokDateKey } from '@/lib/date';

export const TODAY_SYNC_COOLDOWN_MS = 3 * 60_000;
export const TODAY_SYNC_STORAGE_KEY = 'runmate:today-health-last-completed-at';

export type TodayHealthSyncResult = {
  performed: boolean;
  changed: boolean;
  sleep: SamsungSleepSyncResult | null;
  workout: SamsungWorkoutSyncResult | null;
};

let activeSync: Promise<TodayHealthSyncResult> | null = null;
let lastCompletedAt = 0;

export function shouldSyncToday(lastSyncAt: number, now: number, force = false): boolean {
  return force
    || !lastSyncAt
    || getBangkokDateKey(lastSyncAt) !== getBangkokDateKey(now)
    || now - lastSyncAt >= TODAY_SYNC_COOLDOWN_MS;
}

export function syncTodayHealth(force = false): Promise<TodayHealthSyncResult> {
  if (activeSync) return activeSync;
  const previousSyncAt = Math.max(lastCompletedAt, getPersistedTodaySyncAt());
  if (!shouldSyncToday(previousSyncAt, Date.now(), force)) {
    return Promise.resolve({ performed: false, changed: false, sleep: null, workout: null });
  }

  activeSync = Promise.all([syncSamsungSleep('today'), syncSamsungWorkouts('today')])
    .then(([sleep, workout]) => {
      lastCompletedAt = Date.now();
      persistTodaySyncAt(lastCompletedAt);
      const changed = sleep.added + sleep.updated + workout.added + workout.updated > 0;
      return { performed: true, changed, sleep, workout };
    })
    .finally(() => { activeSync = null; });
  return activeSync;
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
