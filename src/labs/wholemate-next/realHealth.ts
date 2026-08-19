// Optional real-data mode for the Health Next prototype — same rule as
// realToday.ts: read-only, reuses the exact builders the shipped Health
// trend/nutrition pages already call, never writes anything back.
import { supabase } from '@/lib/supabaseClient';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { buildPersonalBaseline } from '@/lib/personalBaseline';
import { loadHistoryItems } from '@/lib/cloudHistory';
import { loadProfileFromSupabase } from '@/lib/profileStorage';
import { buildRecoveryTrend, recoveryTrendHistoryOptions } from '@/lib/recoveryTrends';
import { buildNutritionTrend, nutritionTrendHistoryOptions } from '@/lib/nutritionTrends';
import { formatMinutes } from '@/lib/sleepDetailFormatting';
import { getBangkokDateKey } from '@/lib/date';
import type { DataSourceRow, StatTile, TrendDay } from './mockHealth';

function trendStatus(score: number | null): TrendDay['status'] {
  if (score == null) return 'caution';
  if (score >= 70) return 'good';
  if (score >= 50) return 'steady';
  if (score >= 30) return 'caution';
  return 'low';
}

function weekdayLabel(dateKey: string): string {
  return new Intl.DateTimeFormat('en-US', { weekday: 'short', timeZone: 'Asia/Bangkok' }).format(new Date(`${dateKey}T12:00:00+07:00`));
}

// 'insufficient' (zero samples) really is missing; 'calibrating' (a handful
// of samples, not enough to trust as a baseline yet) is not the same claim
// as 'ready' — showing both as a flat "Synced" would overstate how solid a
//2-night reading is, so this gets its own in-between state.
function respiratoryRateSourceRow(respiratoryRate: ReturnType<typeof buildPersonalBaseline>['respiratoryRate']): DataSourceRow {
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

export type RealHealthResult =
  | { status: 'unauthenticated' }
  | { status: 'error'; message: string }
  | {
      status: 'ready';
      trend: TrendDay[];
      anchorValue: string;
      tiles: StatTile[];
      sources: DataSourceRow[];
    };

export async function loadRealHealthData(): Promise<RealHealthResult> {
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
    const baseline = buildPersonalBaseline(context);

    const trend: TrendDay[] = recoveryTrend.points.map((point) => ({
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

    const tiles: StatTile[] = [
      {
        key: 'hrv',
        eyebrow: 'HRV vs Baseline',
        value: latestNight?.hrv != null ? `${Math.round(latestNight.hrv)}` : '—',
        unit: 'ms',
        deltaLabel: hrvDelta != null ? `${hrvDelta >= 0 ? '+' : ''}${Math.round(hrvDelta)} ms vs your baseline` : `${baseline.hrv.sampleCount} nights of baseline so far`,
        deltaDirection: hrvDelta == null ? 'flat' : hrvDelta > 0 ? 'up' : hrvDelta < 0 ? 'down' : 'flat',
        goodDirection: 'up',
      },
      {
        key: 'rhr',
        eyebrow: 'Resting HR vs Baseline',
        value: latestNight?.restingHR != null ? `${Math.round(latestNight.restingHR)}` : '—',
        unit: 'bpm',
        deltaLabel: rhrDelta != null ? `${rhrDelta >= 0 ? '+' : ''}${Math.round(rhrDelta)} bpm vs your baseline` : `${baseline.restingHR.sampleCount} nights of baseline so far`,
        deltaDirection: rhrDelta == null ? 'flat' : rhrDelta > 0 ? 'up' : rhrDelta < 0 ? 'down' : 'flat',
        goodDirection: 'down',
      },
      {
        key: 'sleep',
        eyebrow: 'Sleep · 7 Day Avg',
        value: sleepAvgMinutes != null ? formatMinutes(Math.round(sleepAvgMinutes)) : '—',
        deltaLabel: sleepDeltaMinutes != null ? `${sleepDeltaMinutes >= 0 ? '+' : ''}${sleepDeltaMinutes} min vs your baseline` : 'Not enough nights logged yet',
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

    const sources: DataSourceRow[] = [
      {
        label: 'Health Connect',
        detail: context.recoverySystem.dataFreshness.status === 'today' ? 'Synced with today\'s data' : 'Last sync did not include today',
        state: context.recoverySystem.dataFreshness.status === 'today' ? 'ok' : 'stale',
      },
      respiratoryRateSourceRow(baseline.respiratoryRate),
    ];

    return {
      status: 'ready',
      trend,
      anchorValue: anchorPoint?.recovery != null ? `${Math.round(anchorPoint.recovery)}` : '—',
      tiles,
      sources,
    };
  } catch (error) {
    console.error('[wholemate-next] real Health data load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your real data.' };
  }
}
