export const PERFORMANCE_DIAGNOSTICS_KEY = 'runmate:performance-diagnostics';

export type PerformanceDiagnosticPhase =
  | 'health_sync'
  | 'recovery_core'
  | 'recovery_secondary'
  | 'activity_health_sync'
  | 'activity_records'
  | 'activity_archive'
  | 'activity_nutrition';
export type PerformanceDiagnosticStatus = 'success' | 'skipped' | 'failed';
export type PerformanceDiagnosticVariant = 'prepared' | 'mixed' | 'live' | 'cooldown';

export type PerformanceDiagnosticEntry = {
  phase: PerformanceDiagnosticPhase;
  at: string;
  durationMs: number;
  status: PerformanceDiagnosticStatus;
  variant?: PerformanceDiagnosticVariant;
  detail?: string;
};

export type PerformanceDiagnosticSummary = {
  phase: PerformanceDiagnosticPhase;
  latest: PerformanceDiagnosticEntry;
  averageMs: number;
  sampleCount: number;
};

export type HealthSyncPerformanceComparison = {
  variant: Exclude<PerformanceDiagnosticVariant, 'cooldown'>;
  averageMs: number;
  sampleCount: number;
};

const MAX_STORED_ENTRIES = 30;
const SUMMARY_SAMPLE_SIZE = 5;

export async function measurePerformanceDiagnostic<T>(
  phase: PerformanceDiagnosticPhase,
  operation: () => Promise<T>,
  describe?: (value: T) => { status?: PerformanceDiagnosticStatus; variant?: PerformanceDiagnosticVariant; detail?: string },
): Promise<T> {
  const startedAt = monotonicNow();
  try {
    const value = await operation();
    const description = describe?.(value);
    recordPerformanceDiagnostic(phase, monotonicNow() - startedAt, description?.status ?? 'success', description?.detail, description?.variant);
    return value;
  } catch (error) {
    recordPerformanceDiagnostic(phase, monotonicNow() - startedAt, 'failed', error instanceof Error ? error.message : 'Operation failed');
    throw error;
  }
}

export function recordPerformanceDiagnostic(
  phase: PerformanceDiagnosticPhase,
  durationMs: number,
  status: PerformanceDiagnosticStatus = 'success',
  detail?: string,
  variant?: PerformanceDiagnosticVariant,
): PerformanceDiagnosticEntry {
  const entry: PerformanceDiagnosticEntry = {
    phase,
    at: new Date().toISOString(),
    durationMs: Math.max(0, Math.round(durationMs)),
    status,
    ...(variant ? { variant } : {}),
    ...(detail ? { detail: detail.slice(0, 120) } : {}),
  };
  try {
    const current = getPerformanceDiagnostics();
    window.localStorage.setItem(PERFORMANCE_DIAGNOSTICS_KEY, JSON.stringify([entry, ...current].slice(0, MAX_STORED_ENTRIES)));
  } catch { /* Diagnostics must never interrupt Recovery. */ }
  return entry;
}

export function getHealthSyncPerformanceComparison(): HealthSyncPerformanceComparison[] {
  const entries = getPerformanceDiagnostics().filter((entry) => entry.phase === 'health_sync' && entry.variant && entry.variant !== 'cooldown');
  return (['prepared', 'mixed', 'live'] as const).flatMap((variant) => {
    const samples = entries.filter((entry) => entry.variant === variant).slice(0, SUMMARY_SAMPLE_SIZE);
    if (!samples.length) return [];
    return [{
      variant,
      averageMs: Math.round(samples.reduce((total, sample) => total + sample.durationMs, 0) / samples.length),
      sampleCount: samples.length,
    }];
  });
}

export function getPerformanceDiagnostics(): PerformanceDiagnosticEntry[] {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PERFORMANCE_DIAGNOSTICS_KEY) ?? '[]') as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isPerformanceDiagnosticEntry).slice(0, MAX_STORED_ENTRIES);
  } catch {
    return [];
  }
}

export function getPerformanceDiagnosticSummaries(): PerformanceDiagnosticSummary[] {
  const entries = getPerformanceDiagnostics();
  const phases: PerformanceDiagnosticPhase[] = [
    'health_sync',
    'recovery_core',
    'recovery_secondary',
    'activity_health_sync',
    'activity_records',
    'activity_archive',
    'activity_nutrition',
  ];
  return phases.flatMap((phase) => {
    const samples = entries.filter((entry) => entry.phase === phase).slice(0, SUMMARY_SAMPLE_SIZE);
    if (!samples.length) return [];
    return [{
      phase,
      latest: samples[0],
      averageMs: Math.round(samples.reduce((total, sample) => total + sample.durationMs, 0) / samples.length),
      sampleCount: samples.length,
    }];
  });
}

function isPerformanceDiagnosticEntry(value: unknown): value is PerformanceDiagnosticEntry {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<PerformanceDiagnosticEntry>;
  return ['health_sync', 'recovery_core', 'recovery_secondary', 'activity_health_sync', 'activity_records', 'activity_archive', 'activity_nutrition'].includes(entry.phase ?? '')
    && typeof entry.at === 'string'
    && typeof entry.durationMs === 'number'
    && ['success', 'skipped', 'failed'].includes(entry.status ?? '')
    && (entry.variant === undefined || ['prepared', 'mixed', 'live', 'cooldown'].includes(entry.variant));
}

function monotonicNow(): number {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}
