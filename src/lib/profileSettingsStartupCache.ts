import { getBangkokDateKey } from './date';
import type { ObservedHeartRate } from './observedHeartRate';
import type { UserProfile } from '@/types/profile';

const PROFILE_SETTINGS_STARTUP_CACHE_KEY = 'runmate:profile-settings-startup:v1';

export type ProfileSettingsStartupSnapshot = {
  profile: UserProfile;
  observedHr: ObservedHeartRate | null;
  restingHrBaseline: number | null;
  defaultWakeTime: number | null;
};

type StoredSnapshot = ProfileSettingsStartupSnapshot & {
  dateKey: string;
  savedAt: string;
};

type StartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): StartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isSnapshot(value: unknown): value is StoredSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as Partial<StoredSnapshot>;
  return typeof snapshot.dateKey === 'string'
    && !!snapshot.profile
    && typeof snapshot.profile === 'object'
    && (snapshot.observedHr === null || typeof snapshot.observedHr?.bpm === 'number')
    && (snapshot.restingHrBaseline === null || typeof snapshot.restingHrBaseline === 'number')
    && (snapshot.defaultWakeTime === null || typeof snapshot.defaultWakeTime === 'number');
}

export function loadProfileSettingsStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): ProfileSettingsStartupSnapshot | null {
  if (!storage) return null;
  try {
    const parsed = JSON.parse(storage.getItem(PROFILE_SETTINGS_STARTUP_CACHE_KEY) ?? 'null') as unknown;
    if (!isSnapshot(parsed) || parsed.dateKey !== getBangkokDateKey(now)) {
      storage.removeItem(PROFILE_SETTINGS_STARTUP_CACHE_KEY);
      return null;
    }
    return {
      profile: parsed.profile,
      observedHr: parsed.observedHr,
      restingHrBaseline: parsed.restingHrBaseline,
      defaultWakeTime: parsed.defaultWakeTime,
    };
  } catch {
    storage.removeItem(PROFILE_SETTINGS_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveProfileSettingsStartupSnapshot(
  snapshot: ProfileSettingsStartupSnapshot,
  now: Date | string | number = Date.now(),
  storage: StartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    storage.setItem(PROFILE_SETTINGS_STARTUP_CACHE_KEY, JSON.stringify({
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      ...snapshot,
    }));
  } catch {
    // Startup acceleration is best-effort.
  }
}

export function clearProfileSettingsStartupSnapshot(
  storage: StartupStorage | null = browserStorage(),
): void {
  try {
    storage?.removeItem(PROFILE_SETTINGS_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in constrained web views.
  }
}
