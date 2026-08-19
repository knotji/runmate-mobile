// "This Week's Signals" — the inline dashboard section added to the Health
// tab hub. Read-only, reuses the exact production builders the Recovery
// Trends / Nutrition Trends pages already call (buildRecoveryTrend,
// buildNutritionTrend, buildPersonalBaseline) so this can never drift from
// what those pages would show. Ported from the validated
// src/labs/wholemate-next/realHealth.ts prototype.
import { supabase } from './supabaseClient';
import { buildCoachContextFromSupabase } from './coachContextService';
import { buildPersonalBaseline } from './personalBaseline';
import { loadHistoryItems } from './cloudHistory';
import { loadProfileFromSupabase } from './profileStorage';
import { buildRecoveryTrend, recoveryTrendHistoryOptions, type RecoveryTrend } from './recoveryTrends';
import { buildNutritionTrend, nutritionTrendHistoryOptions, type NutritionTrend } from './nutritionTrends';
import { formatMinutes } from './sleepDetailFormatting';
import { getBangkokDateKey } from './date';
import type { CoachContext } from './buildCoachContext';
import type { SignalBaseline } from './personalBaseline';

export type HealthTrendStatus = 'good' | 'steady' | 'caution' | 'low';
export interface HealthTrendDay { label: string; value: number; status: HealthTrendStatus; }

export interface HealthStatTile {
  key: string;
  eyebrow: string;
  value: string;
  unit?: string;
  deltaLabel: string;
  deltaDirection: 'up' | 'down' | 'flat';
  goodDirection: 'up' | 'down';
}

export interface HealthDataSourceRow { label: string; detail: string; state: 'ok' | 'stale' | 'missing'; }

export interface HealthDashboardData {
  trend: HealthTrendDay[];
  anchorValue: string;
  tiles: HealthStatTile[];
  sources: HealthDataSourceRow[];
}

function trendStatus(score: number | null): HealthTrendStatus {
  if (score == null) return 'caution';
  if (score >= 70) return 'good';
  if (score >= 50) return 'steady';
  if (score >= 30) return 'caution';
  return 'low';
}

function deltaVsBaseline(delta: number, unit: string): string {
  if (delta === 0) return 'In line with your baseline';
  return `${delta > 0 ? '+' : ''}${delta} ${unit} vs your baseline`;
}

/**
 * A "vs baseline" tile is only honest when the baseline is actually
 * trustworthy (`state === 'ready'`) — a median of 1-3 nights is real but too
 * thin to compare against, so calibrating/insufficient baselines get a
 * plain status line instead of a fabricated-looking delta number, even
 * though `baseline.value` may technically be non-null for 'calibrating'.
 */
function baselineAwareDelta(current: number | null, baseline: SignalBaseline, unit: string): { deltaLabel: string; deltaDirection: 'up' | 'down' | 'flat' } {
  if (current != null && baseline.state === 'ready' && baseline.value != null) {
    const delta = Math.round(current - baseline.value);
    return { deltaLabel: deltaVsBaseline(delta, unit), deltaDirection: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' };
  }
  if (baseline.state === 'calibrating') {
    return { deltaLabel: `Baseline calibrating (${baseline.sampleCount}/4 nights)`, deltaDirection: 'flat' };
  }
  return { deltaLabel: 'Not enough nights yet for a baseline', deltaDirection: 'flat' };
}

function weekdayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

// 'insufficient' (zero samples) really is missing; 'calibrating' (a handful
// of samples, not enough to trust as a baseline yet) is not the same claim
// as 'ready' — showing both as a flat "Synced" would overstate how solid a
// 2-night reading is, so this gets its own in-between state.
function respiratoryRateSourceRow(respiratoryRate: ReturnType<typeof buildPersonalBaseline>['respiratoryRate']): HealthDataSourceRow {
  if (respiratoryRate.state === 'insufficient') {
    return {
      label: 'Respiratory rate',
      detail: 'Not reported by this device\'s Health Connect source — shown as missing, never estimated',
      state: 'missing',
    };
  }
  if (respiratoryRate.state === 'calibrating') {
    return {
      label: 'Respiratory rate',
      detail: `Only ${respiratoryRate.sampleCount} night${respiratoryRate.sampleCount === 1 ? '' : 's'} recorded in the last 30 days — not enough yet to trust as a baseline`,
      state: 'stale',
    };
  }
  return {
    label: 'Respiratory rate',
    detail: `${respiratoryRate.sampleCount} nights recorded in the last 30 days`,
    state: 'ok',
  };
}

/** Pure — no I/O. Exported for direct unit testing. */
export function assembleHealthDashboard(context: CoachContext, recoveryTrend: RecoveryTrend, nutritionTrend: NutritionTrend): HealthDashboardData {
  const baseline = buildPersonalBaseline(context);

  const trend: HealthTrendDay[] = recoveryTrend.points.map((point) => ({
    label: weekdayLabel(point.date),
    value: point.recovery ?? 0,
    status: trendStatus(point.recovery),
  }));
  const anchorPoint = recoveryTrend.points[recoveryTrend.points.length - 1] ?? null;

  const latestNight = context.sleepBaseline30d?.[0] ?? null;

  const sleep7dMinutes = context.sleep7d
    .map((night) => night.durationMinutes)
    .filter((value): value is number => value != null);
  const sleepAvgMinutes = sleep7dMinutes.length ? sleep7dMinutes.reduce((sum, value) => sum + value, 0) / sleep7dMinutes.length : null;

  const hrvResult = baselineAwareDelta(latestNight?.hrv ?? null, baseline.hrv, 'ms');
  const rhrResult = baselineAwareDelta(latestNight?.restingHR ?? null, baseline.restingHR, 'bpm');
  const sleepResult = baselineAwareDelta(sleepAvgMinutes != null ? Math.round(sleepAvgMinutes) : null, baseline.sleepDurationMinutes, 'min');

  const tiles: HealthStatTile[] = [
    {
      key: 'hrv',
      eyebrow: 'HRV vs Baseline',
      value: latestNight?.hrv != null ? `${Math.round(latestNight.hrv)}` : '—',
      unit: 'ms',
      deltaLabel: hrvResult.deltaLabel,
      deltaDirection: hrvResult.deltaDirection,
      goodDirection: 'up',
    },
    {
      key: 'rhr',
      eyebrow: 'Resting HR vs Baseline',
      value: latestNight?.restingHR != null ? `${Math.round(latestNight.restingHR)}` : '—',
      unit: 'bpm',
      deltaLabel: rhrResult.deltaLabel,
      deltaDirection: rhrResult.deltaDirection,
      goodDirection: 'down',
    },
    {
      key: 'sleep',
      eyebrow: 'Sleep · 7 Day Avg',
      value: sleepAvgMinutes != null ? formatMinutes(Math.round(sleepAvgMinutes)) : '—',
      deltaLabel: sleepResult.deltaLabel,
      deltaDirection: sleepResult.deltaDirection,
      goodDirection: 'up',
    },
    {
      key: 'nutrition',
      eyebrow: 'Nutrition · 7 Day Avg',
      value: nutritionTrend.averageCalories != null ? Math.round(nutritionTrend.averageCalories).toLocaleString('en-US') : '—',
      unit: nutritionTrend.averageCalories != null ? 'kcal' : undefined,
      deltaLabel: `Logged ${nutritionTrend.loggedDays} of 7 days`,
      deltaDirection: 'flat',
      goodDirection: 'up',
    },
  ];

  const sources: HealthDataSourceRow[] = [
    {
      label: 'Health Connect',
      detail: context.recoverySystem.dataFreshness.status === 'today' ? 'Synced with today\'s data' : 'Last sync did not include today',
      state: context.recoverySystem.dataFreshness.status === 'today' ? 'ok' : 'stale',
    },
    respiratoryRateSourceRow(baseline.respiratoryRate),
  ];

  return {
    trend,
    anchorValue: anchorPoint?.recovery != null ? `${Math.round(anchorPoint.recovery)}` : '—',
    tiles,
    sources,
  };
}

/**
 * Summary-layer visibility rule: a tile earns a place in the stat grid only
 * when it has a real current value — "—" means WholeMate has nothing to
 * summarize, and a tile whose whole content is "no data" belongs in Data
 * Sources & Freshness (provenance), not the summary grid. This is the only
 * check needed because every tile above already resolves to "—" exactly
 * when there's no current reading to show (see the `value:` lines in
 * assembleHealthDashboard) — baseline-calibrating/insufficient states still
 * carry a real current value and so remain visible, honestly labeled.
 */
export function selectVisibleHealthSignals(tiles: HealthStatTile[]): HealthStatTile[] {
  return tiles.filter((tile) => tile.value !== '—');
}

export type HealthDashboardResult =
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: HealthDashboardData };

export async function loadFreshHealthDashboardData(): Promise<HealthDashboardResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'unauthenticated' };

  try {
    const today = getBangkokDateKey(Date.now());
    const [context, historyResult, profile] = await Promise.all([
      buildCoachContextFromSupabase({}),
      loadHistoryItems(['sleep', 'workout', 'strength', 'meal'], {
        // recoveryTrendHistoryOptions has the wider lookback (75d vs 45d) —
        // spread it last so its createdAfter wins and both trends have
        // enough history, with the larger of the two row limits.
        ...nutritionTrendHistoryOptions(),
        ...recoveryTrendHistoryOptions(),
        limit: Math.max(recoveryTrendHistoryOptions().limit, nutritionTrendHistoryOptions().limit),
      }),
      loadProfileFromSupabase(),
    ]);

    if (!historyResult.ok) {
      return { status: 'error', message: historyResult.error };
    }

    const recoveryTrend = buildRecoveryTrend(historyResult.items, profile, 7, today);
    const nutritionTrend = buildNutritionTrend(historyResult.items, 7, today);

    return { status: 'ready', data: assembleHealthDashboard(context, recoveryTrend, nutritionTrend) };
  } catch (error) {
    console.error('[health-dashboard] load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your Health dashboard.' };
  }
}
