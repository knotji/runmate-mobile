import { App as CapacitorApp } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { getPerformanceDiagnosticSummaries } from '@/lib/performanceDiagnostics';

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
  return JSON.stringify({
    app: 'RunMate',
    version: info.version,
    build: info.build,
    builtAt: info.builtAt,
    capturedAt: new Date().toISOString(),
    platform: Capacitor.getPlatform(),
    online: typeof navigator === 'undefined' ? null : navigator.onLine,
    performance,
  }, null, 2);
}
