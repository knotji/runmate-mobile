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

function nightsOfBaseline(sampleCount: number): string {
  return `${sampleCount} night${sampleCount === 1 ? '' : 's'} of baseline so far`;
}

function deltaVsBaseline(delta: number, unit: string): string {
  if (delta === 0) return 'In line with your baseline';
  return `${delta > 0 ? '+' : ''}${delta} ${unit} vs your baseline`;
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
  const hrvDelta = latestNight?.hrv != null && baseline.hrv.value != null ? latestNight.hrv - baseline.hrv.value : null;
  const rhrDelta = latestNight?.restingHR != null && baseline.restingHR.value != null ? latestNight.restingHR - baseline.restingHR.value : null;

  const sleep7dMinutes = context.sleep7d
    .map((night) => night.durationMinutes)
    .filter((value): value is number => value != null);
  const sleepAvgMinutes = sleep7dMinutes.length ? sleep7dMinutes.reduce((sum, value) => sum + value, 0) / sleep7dMinutes.length : null;
  const sleepDeltaMinutes = sleepAvgMinutes != null && baseline.sleepDurationMinutes.value != null
    ? Math.round(sleepAvgMinutes - baseline.sleepDurationMinutes.value)
    : null;

  const tiles: HealthStatTile[] = [
    {
      key: 'hrv',
      eyebrow: 'HRV vs Baseline',
      value: latestNight?.hrv != null ? `${Math.round(latestNight.hrv)}` : '—',
      unit: 'ms',
      deltaLabel: hrvDelta != null ? deltaVsBaseline(Math.round(hrvDelta), 'ms') : nightsOfBaseline(baseline.hrv.sampleCount),
      deltaDirection: hrvDelta == null ? 'flat' : hrvDelta > 0 ? 'up' : hrvDelta < 0 ? 'down' : 'flat',
      goodDirection: 'up',
    },
    {
      key: 'rhr',
      eyebrow: 'Resting HR vs Baseline',
      value: latestNight?.restingHR != null ? `${Math.round(latestNight.restingHR)}` : '—',
      unit: 'bpm',
      deltaLabel: rhrDelta != null ? deltaVsBaseline(Math.round(rhrDelta), 'bpm') : nightsOfBaseline(baseline.restingHR.sampleCount),
      deltaDirection: rhrDelta == null ? 'flat' : rhrDelta > 0 ? 'up' : rhrDelta < 0 ? 'down' : 'flat',
      goodDirection: 'down',
    },
    {
      key: 'sleep',
      eyebrow: 'Sleep · 7 Day Avg',
      value: sleepAvgMinutes != null ? formatMinutes(Math.round(sleepAvgMinutes)) : '—',
      deltaLabel: sleepDeltaMinutes != null ? deltaVsBaseline(sleepDeltaMinutes, 'min') : 'Not enough nights logged yet',
      deltaDirection: sleepDeltaMinutes == null ? 'flat' : sleepDeltaMinutes > 0 ? 'up' : sleepDeltaMinutes < 0 ? 'down' : 'flat',
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
