// Optional real-data mode for the Today Next prototype. Read-only: this
// only calls the same account-backed context builder the shipped Today
// page already uses, and never writes anything back — flipping this on
// can't affect production data or the real Today page.
import { supabase } from '@/lib/supabaseClient';
import { buildCoachContextFromSupabase } from '@/lib/coachContextService';
import { buildRecoveryExplainability } from '@/lib/recoveryExplainability';
import { buildDailyRecommendation, type DailyRecommendationAction } from '@/lib/dailyRecommendation';
import { buildEnergyReserve } from '@/lib/energyReserve';
import { getTodayPlannedWorkout } from '@/lib/todayTrainingPlan';
import { loadDailyStrainCheckIn } from '@/lib/strainContext';
import { formatMinutes } from '@/lib/sleepDetailFormatting';
import type { BodyStatus, RingMetric, TodayMockScenario } from './mockToday';

const STATUS_FOR_ACTION: Record<DailyRecommendationAction, BodyStatus> = {
  push: 'ready',
  normal: 'steady',
  reduce: 'reduce',
  recover: 'recover',
};

const TITLE_FOR_ACTION: Record<DailyRecommendationAction, string> = {
  push: 'Ready To Push Today',
  normal: 'Ready For A Normal Day',
  reduce: 'Keep Today Controlled',
  recover: 'Recovery Comes First',
};

const ACTION_LABEL_FOR_ACTION: Record<DailyRecommendationAction, string> = {
  push: 'View Today’s Plan',
  normal: 'View Today’s Plan',
  reduce: 'Adjust Today’s Plan',
  recover: 'See What’s Shaping This',
};

function scoreStatus(score: number, good: number, steady: number, caution: number): RingMetric['status'] {
  if (score >= good) return 'good';
  if (score >= steady) return 'steady';
  if (score >= caution) return 'caution';
  return 'low';
}

// Real freshness, not the mock's fixed "Updated 12 min ago" — this data mode
// exists specifically to sanity-check the design against live data, so the
// timestamp should be live too.
function describeFreshness(sleepDataFreshness: 'today' | 'stale' | 'missing', fetchedAt: Date): string {
  const time = new Intl.DateTimeFormat('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Bangkok' }).format(fetchedAt);
  if (sleepDataFreshness === 'today') return `Live from your account · fetched ${time}`;
  if (sleepDataFreshness === 'stale') return `Live from your account · last night's data is stale, fetched ${time}`;
  return `Live from your account · fetched ${time}`;
}

export type RealTodayResult =
  | { status: 'unauthenticated' }
  | { status: 'unavailable'; reason: string }
  | { status: 'error'; message: string }
  | { status: 'ready'; scenario: TodayMockScenario };

export async function loadRealTodayScenario(): Promise<RealTodayResult> {
  const { data } = await supabase.auth.getSession();
  if (!data.session) return { status: 'unauthenticated' };

  try {
    const context = await buildCoachContextFromSupabase({});
    const recovery = context.recoverySystem;
    const explainability = buildRecoveryExplainability(recovery);
    const planned = getTodayPlannedWorkout(context);
    const dailyRecommendation = buildDailyRecommendation(context, explainability, planned);

    if (dailyRecommendation.status !== 'ready') {
      return { status: 'unavailable', reason: dailyRecommendation.reason };
    }

    const checkIn = loadDailyStrainCheckIn(context.todayDate);
    const energy = buildEnergyReserve({
      recovery,
      checkIn,
      activePain: context.activePain,
      activeSick: context.activeSick,
    });

    const topFactor = explainability.status === 'ready' ? explainability.hurting[0] ?? explainability.helping[0] ?? null : null;
    const secondaryFactor = explainability.status === 'ready'
      ? (explainability.hurting.find((factor) => factor.key !== topFactor?.key) ?? explainability.helping.find((factor) => factor.key !== topFactor?.key) ?? null)
      : null;
    const recoveryScore = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating' ? Math.round(recovery.overallScore) : null;
    const sleepScore = recovery.sleepPerformance.state !== 'unscorable' ? recovery.sleepPerformance.score : null;
    const sleepMinutes = recovery.sleepPerformance.actualSleepMinutes;

    const metrics: RingMetric[] = [
      {
        key: 'recovery',
        label: 'Recovery',
        value: recoveryScore ?? 0,
        displayValue: recoveryScore != null ? `${recoveryScore}` : '—',
        unit: '/100',
        status: recoveryScore != null ? scoreStatus(recoveryScore, 80, 67, 34) : 'steady',
      },
      {
        key: 'sleep',
        label: 'Sleep',
        value: sleepScore != null ? Math.round(sleepScore) : 0,
        displayValue: sleepMinutes != null ? formatMinutes(sleepMinutes) : '—',
        status: sleepScore != null ? scoreStatus(sleepScore, 85, 70, 50) : 'steady',
      },
      {
        key: 'strain',
        label: 'Strain',
        value: Math.min(100, Math.round((recovery.strain.score / 21) * 100)),
        displayValue: recovery.strain.score.toFixed(1),
        unit: '/21',
        status: 'steady',
      },
      {
        key: 'energy',
        label: 'Energy',
        value: energy.score ?? 0,
        displayValue: energy.score != null ? `${energy.score}` : '—',
        unit: '/100',
        status: energy.score != null ? scoreStatus(energy.score, 75, 55, 30) : 'steady',
      },
    ];

    return {
      status: 'ready',
      scenario: {
        id: 'real',
        label: 'You, Right Now',
        status: STATUS_FOR_ACTION[dailyRecommendation.action],
        statusTitle: TITLE_FOR_ACTION[dailyRecommendation.action],
        statusSummary: dailyRecommendation.reason,
        mainReason: {
          eyebrow: 'Why',
          title: topFactor?.detail ?? dailyRecommendation.reason,
          // Deliberately not the planned-workout note here — that already
          // has its own line in "One Useful Move" below, and repeating it
          // in both places reads as the app not having anything more to say.
          detail: secondaryFactor?.detail ?? 'Based on your most recent overnight signals and this week\'s training load.',
        },
        oneThing: {
          title: dailyRecommendation.label,
          detail: dailyRecommendation.plannedWorkoutNote ? `Today's plan: ${dailyRecommendation.plannedWorkoutNote}.` : dailyRecommendation.reason,
          actionLabel: ACTION_LABEL_FOR_ACTION[dailyRecommendation.action],
        },
        metrics,
        freshness: describeFreshness(recovery.dataFreshness.status, new Date()),
      },
    };
  } catch (error) {
    console.error('[wholemate-next] real-data load failed', error);
    return { status: 'error', message: error instanceof Error ? error.message : 'Could not load your real data.' };
  }
}
