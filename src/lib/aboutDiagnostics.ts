import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getPerformanceDiagnostics, getPerformanceDiagnosticSummaries } from '@/lib/performanceDiagnostics';
import { getSamsungSleepLastSyncedAt } from '@/lib/samsungSleepSync';
import { getSamsungWorkoutLastSyncedAt } from '@/lib/samsungWorkoutSync';
import { getPersistedTodaySyncAt } from '@/lib/healthSyncService';
import { loadRecoveryContextStartupEntry, loadRecoveryStartupEntry } from '@/lib/recoveryStartupCache';
import { loadActivityStartupEntry } from '@/lib/activityStartupCache';
import { resolveRecoveryDataStatus } from '@/lib/recoveryDataFreshness';
import { useRacePlanStore } from '@/lib/race/racePlanStore';

export type RunMateBuildInfo = {
  version: string;
  build: string;
  builtAt: string;
};

export type ReleaseHealthRow = {
  key: 'network' | 'health_sync' | 'local_cache' | 'performance';
  label: string;
  status: 'ready' | 'attention' | 'pending';
  detail: string;
};

export function getReleaseHealthSnapshot(now: Date | string | number = Date.now()): ReleaseHealthRow[] {
  const nowMs = new Date(now).getTime();
  const todaySyncAt = getPersistedTodaySyncAt();
  const recoveryCache = loadRecoveryStartupEntry();
  const activityCache = loadActivityStartupEntry();
  const diagnostics = getPerformanceDiagnostics();
  const latestDiagnostic = diagnostics[0] ?? null;
  const online = typeof navigator === 'undefined' ? null : navigator.onLine;
  const syncAgeMs = todaySyncAt > 0 ? nowMs - todaySyncAt : Number.POSITIVE_INFINITY;
  const cachedAt = [recoveryCache?.savedAt, activityCache?.savedAt]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? null;

  return [
    {
      key: 'network',
      label: 'App Connection',
      status: online === false ? 'attention' : online === true ? 'ready' : 'pending',
      detail: online === false ? 'Offline · saved data remains available' : online === true ? 'Online' : 'Connection not checked',
    },
    {
      key: 'health_sync',
      label: 'Health Connect Sync',
      status: !Number.isFinite(syncAgeMs) ? 'pending' : syncAgeMs <= 6 * 60 * 60 * 1000 ? 'ready' : 'attention',
      detail: todaySyncAt > 0 ? `Last completed ${formatRelativeAge(syncAgeMs)}` : 'No completed sync recorded on this device',
    },
    {
      key: 'local_cache',
      label: 'Fast Startup Cache',
      status: cachedAt ? 'ready' : 'pending',
      detail: cachedAt ? `Available · updated ${formatRelativeAge(nowMs - Date.parse(cachedAt))}` : 'Builds after Recovery or Activity loads',
    },
    {
      key: 'performance',
      label: 'Latest Page Load',
      status: !latestDiagnostic ? 'pending' : latestDiagnostic.status === 'failed' ? 'attention' : 'ready',
      detail: latestDiagnostic ? `${humanizePhase(latestDiagnostic.phase)} · ${latestDiagnostic.durationMs} ms` : 'No page timing recorded yet',
    },
  ];
}

export async function getRunMateBuildInfo(): Promise<RunMateBuildInfo> {
  if (Capacitor.isNativePlatform()) {
    try {
      const info = await CapacitorApp.getInfo();
      return { version: info.version, build: info.build, builtAt: __RUNMATE_BUILD_DATE__ };
    } catch {
      // The embedded build metadata remains available if the native bridge is unavailable.
    }
  }
  return { version: __RUNMATE_VERSION__, build: __RUNMATE_BUILD_CODE__, builtAt: __RUNMATE_BUILD_DATE__ };
}

export function buildSupportDiagnostics(info: RunMateBuildInfo): string {
  const performance = getPerformanceDiagnosticSummaries().map((summary) => ({
    phase: summary.phase,
    latestMs: summary.latest.durationMs,
    averageMs: summary.averageMs,
    samples: summary.sampleCount,
    budgetMs: summary.budgetMs,
    budgetStatus: summary.budgetStatus,
    status: summary.latest.status,
  }));
  const recoveryCache = loadRecoveryStartupEntry();
  const contextCache = loadRecoveryContextStartupEntry();
  const activityCache = loadActivityStartupEntry();
  const activePlan = useRacePlanStore.getState().plan;
  const latestFailures = getPerformanceDiagnostics()
    .filter((entry) => entry.status === 'failed')
    .slice(0, 5)
    .map((entry) => ({ phase: entry.phase, at: entry.at }));
  const todaySyncAt = getPersistedTodaySyncAt();
  return JSON.stringify({
    app: 'WholeMate',
    version: info.version,
    build: info.build,
    builtAt: info.builtAt,
    capturedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    healthSync: {
      todayCompletedAt: todaySyncAt > 0 ? new Date(todaySyncAt).toISOString() : null,
      samsungSleepAt: getSamsungSleepLastSyncedAt(),
      samsungWorkoutAt: getSamsungWorkoutLastSyncedAt(),
    },
    cache: {
      recovery: cacheMetadata(recoveryCache?.savedAt ?? null),
      coachContext: cacheMetadata(contextCache?.savedAt ?? null),
      activity: cacheMetadata(activityCache?.savedAt ?? null),
    },
    racePlan: activePlan ? {
      version: activePlan.planVersion ?? null,
      status: activePlan.planStatus ?? 'legacy',
      updatedAt: activePlan.updatedAt ?? activePlan.createdAt ?? null,
    } : null,
    latestFailures,
    performance,
  }, null, 2);
}

function cacheMetadata(savedAt: string | null) {
  return {
    available: Boolean(savedAt),
    savedAt,
    freshness: resolveRecoveryDataStatus({ savedAt, refreshing: false, refreshFailed: false }),
  };
}

function formatRelativeAge(ageMs: number): string {
  if (!Number.isFinite(ageMs) || ageMs < 0) return 'recently';
  const minutes = Math.max(0, Math.round(ageMs / 60_000));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  return `${hours}h ago`;
}

function humanizePhase(phase: string): string {
  return phase.split('_').map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
}
