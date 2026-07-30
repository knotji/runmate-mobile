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
    app: 'RunMate',
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
