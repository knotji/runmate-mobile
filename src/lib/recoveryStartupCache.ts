import { getBangkokDateKey } from './date';
import type { CoachContext } from './buildCoachContext';
import type { RunMateRecoverySystem } from './recoverySystem';

const RECOVERY_STARTUP_CACHE_KEY = 'runmate:recovery-startup:v1';
const RECOVERY_CONTEXT_STARTUP_CACHE_KEY = 'runmate:recovery-context-startup:v1';

type RecoveryStartupSnapshot = {
  dateKey: string;
  savedAt: string;
  recovery: RunMateRecoverySystem;
};

type RecoveryContextStartupSnapshot = {
  dateKey: string;
  savedAt: string;
  context: CoachContext;
};

type RecoveryStartupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function browserStorage(): RecoveryStartupStorage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

function isRecoverySystem(value: unknown): value is RunMateRecoverySystem {
  if (!value || typeof value !== 'object') return false;
  const recovery = value as Partial<RunMateRecoverySystem>;
  return recovery.model === 'whoop_style_v1'
    && typeof recovery.overallScore === 'number'
    && Number.isFinite(recovery.overallScore)
    && typeof recovery.scoreState === 'string'
    && Boolean(recovery.strain)
    && Boolean(recovery.sleepPerformance);
}

function isCoachContext(value: unknown): value is CoachContext {
  if (!value || typeof value !== 'object') return false;
  const context = value as Partial<CoachContext>;
  return typeof context.todayDate === 'string'
    && Boolean(context.recoveryLoop)
    && isRecoverySystem(context.recoverySystem);
}

export function loadRecoveryStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: RecoveryStartupStorage | null = browserStorage(),
): RunMateRecoverySystem | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RECOVERY_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<RecoveryStartupSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now) || !isRecoverySystem(snapshot.recovery)) {
      storage.removeItem(RECOVERY_STARTUP_CACHE_KEY);
      return null;
    }
    return snapshot.recovery;
  } catch {
    storage.removeItem(RECOVERY_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveRecoveryStartupSnapshot(
  recovery: RunMateRecoverySystem,
  now: Date | string | number = Date.now(),
  storage: RecoveryStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const snapshot: RecoveryStartupSnapshot = {
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      recovery,
    };
    storage.setItem(RECOVERY_STARTUP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Startup acceleration is best-effort and must never block Recovery.
  }
}

export function loadRecoveryContextStartupSnapshot(
  now: Date | string | number = Date.now(),
  storage: RecoveryStartupStorage | null = browserStorage(),
): CoachContext | null {
  if (!storage) return null;
  try {
    const raw = storage.getItem(RECOVERY_CONTEXT_STARTUP_CACHE_KEY);
    if (!raw) return null;
    const snapshot = JSON.parse(raw) as Partial<RecoveryContextStartupSnapshot>;
    if (snapshot.dateKey !== getBangkokDateKey(now) || !isCoachContext(snapshot.context)) {
      storage.removeItem(RECOVERY_CONTEXT_STARTUP_CACHE_KEY);
      return null;
    }
    return snapshot.context;
  } catch {
    storage.removeItem(RECOVERY_CONTEXT_STARTUP_CACHE_KEY);
    return null;
  }
}

export function saveRecoveryContextStartupSnapshot(
  context: CoachContext,
  now: Date | string | number = Date.now(),
  storage: RecoveryStartupStorage | null = browserStorage(),
): void {
  if (!storage) return;
  try {
    const snapshot: RecoveryContextStartupSnapshot = {
      dateKey: getBangkokDateKey(now),
      savedAt: new Date(now).toISOString(),
      context,
    };
    storage.setItem(RECOVERY_CONTEXT_STARTUP_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Full-page startup acceleration is best-effort.
  }
}

export function clearRecoveryStartupSnapshot(storage: RecoveryStartupStorage | null = browserStorage()): void {
  try {
    storage?.removeItem(RECOVERY_STARTUP_CACHE_KEY);
    storage?.removeItem(RECOVERY_CONTEXT_STARTUP_CACHE_KEY);
  } catch {
    // Storage can be unavailable in private or constrained web views.
  }
}
