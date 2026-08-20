// Dedicated startup cache for You's "Your Focus / Your Context / Today's
// Check-In" section — its own cache rather than reading/writing any other
// page's cache, same reasoning as healthDashboardStartupCache.ts. Same
// date-keyed pattern as every other *StartupCache.ts module.
import { getBangkokDateKey } from './date';
import type { YouContextData } from './youContextData';

const YOU_CONTEXT_STARTUP_CACHE_KEY = 'runmate:you-context-startup:v1';

type StoredSnapshot = {
  dateKey: string;
  savedAt: string;
  data: YouContextData;
};

type YouContextStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): YouContextStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isYouContextData(value: unknown): value is YouContextData {
  if (!value || typeof value !== 'object') return false;
  const data = value as Partial<YouContextData>;
  return Boolean(data.focus) && Array.isArray(data.context) && Boolean(data.checkIn);
}

export function loadYouContextStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: YouContextStartupStorage | null = browserStorage(),
): YouContextData | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(YOU_CONTEXT_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<StoredSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now) || !isYouContextData(snapshot.data)) {
      storage.removeItem(YOU_CONTEXT_STARTUP_CACHE_KEY);
      return null;
    }
    return snapshot.data;
  } catch {
    storage.removeItem(YOU_CONTEXT_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveYouContextStartupSnapshot(
  data: YouContextData,
  now: Date | string | number = Date.now(),
  storage: YouContextStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const snapshot: StoredSnapshot = {
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      data,
    };
    storage.setItem(YOU_CONTEXT_STARTUP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup acceleration is best-effort and must never block You.
  }
}

export function clearYouContextStartupSnapshot(storage: YouContextStartupStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(YOU_CONTEXT_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in private or constrained web views.
  }
}
