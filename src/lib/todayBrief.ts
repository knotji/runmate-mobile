import type { CoachContext, MealContextSummary, WeekSleepRow } from '@/lib/buildCoachContext';
import type { AdaptiveTrainingRecommendation } from '@/lib/adaptiveTrainingPlan';
import { describePlannedWorkout, type DailyRecommendationAction } from '@/lib/dailyRecommendation';
import type { RunMateRecoverySystem } from '@/lib/recoverySystem';
import type { WeekWorkout } from '@/types/race';
import type { TodayTrainingPlanStatus } from '@/lib/todayTrainingPlan';

export type TodayBriefItem = {
  eyebrow: string;
  title: string;
  summary: string;
};

export type TodayReadinessStatus = 'ready' | 'steady' | 'reduce' | 'recover';
export type TodayReadiness = TodayBriefItem & { status: TodayReadinessStatus };

export type TodayBrief = {
  readiness: TodayReadiness;
  limiter: TodayBriefItem;
  action: TodayBriefItem;
  evidence: TodayBriefItem[];
};

type BriefOptions = {
  planned: WeekWorkout | null;
  recommendation: AdaptiveTrainingRecommendation | null;
  planStatus: TodayTrainingPlanStatus | null;
  /**
   * The same action already shown as the "Today's Focus" badge above this card
   * (buildDailyRecommendation()'s output). readinessItem() must key its "Body
   * Status" text off this instead of independently re-deriving one from
   * overallScore alone — dailyRecommendation.ts's reduce/recover thresholds also
   * check sleep performance, current Strain, and weekly load, so a day can read
   * "reduce" there while overallScore alone still clears 67 — re-deriving
   * separately produced a badge/body-status contradiction ("Reduce Load" next to
   * "Ready For A Normal Day") whenever the trigger wasn't the composite score.
   */
  dailyAction?: DailyRecommendationAction | null;
};

const CAFFEINE_PATTERN = /\b(coffee|espresso|americano|latte|cappuccino|mocha|cold brew|tea|matcha|cocoa|chocolate|energy drink|cola)\b|กาแฟ|ชา|มัทฉะ|โกโก้|ช็อกโกแลต|เครื่องดื่มชูกำลัง/i;

export function buildTodayBrief(context: CoachContext, options: BriefOptions): TodayBrief {
  const latest = context.sleep7d?.[0] ?? context.sleepHistory?.[0] ?? null;
  const baseline = (context.sleepBaseline30d ?? []).filter((night) => night.date !== latest?.date);
  const caffeine = latestCaffeine(context.mealsToday ?? []);
  const readiness = buildTodayReadiness(context.recoverySystem, options.dailyAction ?? null);
  const limiter = limiterItem(context, latest, baseline);
  const action = actionItem(context, options, caffeine, limiter);
  const evidence = evidenceItems(context, latest, baseline, caffeine);
  return { readiness, limiter, action, evidence };
}

/**
 * Takes RunMateRecoverySystem directly (not the full CoachContext) so the
 * Today hero card can render this as soon as Recovery is ready, before the
 * rest of CoachContext (sleep7d, meals, etc. - needed by limiter/action/
 * evidence below) has finished loading. dailyAction is still optional/null
 * during that same early window; it sharpens the same thresholds once the
 * daily recommendation resolves, it never changes them.
 */
export function buildTodayReadiness(recovery: RunMateRecoverySystem, dailyAction: DailyRecommendationAction | null): TodayReadiness {
  if (recovery.scoreState === 'stale' || recovery.scoreState === 'unscorable' || recovery.scoreState === 'pending') {
    return {
      status: 'steady',
      eyebrow: 'Body Readiness',
      title: 'Waiting For Fresh Sleep Data',
      summary: 'Use the saved plan cautiously until the latest overnight record is available.',
    };
  }
  if (recovery.scoreState === 'calibrating') {
    return {
      status: 'steady',
      eyebrow: 'Body Readiness',
      title: 'Recovery Is Still Calibrating',
      summary: 'Use today as early guidance while WholeMate builds your personal baseline.',
    };
  }
  if (dailyAction === 'recover') {
    return {
      status: 'recover',
      eyebrow: 'Body Readiness',
      title: 'Recovery Comes First',
      summary: 'Your current signals favor recovery over demanding training.',
    };
  }
  if (dailyAction === 'reduce') {
    return {
      status: 'reduce',
      eyebrow: 'Body Readiness',
      title: 'Keep Today Controlled',
      summary: 'You can stay active, but today is better suited to controlled effort.',
    };
  }
  if (dailyAction === 'push') {
    return {
      status: 'ready',
      eyebrow: 'Body Readiness',
      title: 'Ready To Push Today',
      summary: 'Your current signals support a strong training day.',
    };
  }
  if (dailyAction === 'normal') {
    return {
      status: 'steady',
      eyebrow: 'Body Readiness',
      title: 'Ready For A Normal Day',
      summary: 'Your current recovery signals support a normal day without adding extra load.',
    };
  }
  // dailyAction unavailable (e.g. the daily recommendation itself reports
  // insufficient_data for a reason the state checks above don't cover) —
  // fall back to the composite score alone rather than showing nothing.
  if (recovery.overallScore >= 67) {
    return {
      status: 'steady',
      eyebrow: 'Body Readiness',
      title: 'Ready For A Normal Day',
      summary: 'Your current recovery signals support a normal day without adding extra load.',
    };
  }
  if (recovery.overallScore >= 34) {
    return {
      status: 'reduce',
      eyebrow: 'Body Readiness',
      title: 'Keep Today Controlled',
      summary: 'You can stay active, but today is better suited to controlled effort.',
    };
  }
  return {
    status: 'recover',
    eyebrow: 'Body Readiness',
    title: 'Recovery Comes First',
    summary: 'Your current signals favor recovery over demanding training.',
  };
}

function limiterItem(context: CoachContext, latest: WeekSleepRow | null, baseline: WeekSleepRow[]): TodayBriefItem {
  const recovery = context.recoverySystem;
  if (context.activePain) {
    return {
      eyebrow: 'Likely Limiter',
      title: 'Active Pain Takes Priority',
      summary: 'Avoid movements that aggravate the area, regardless of today\'s score.',
    };
  }
  if (context.activeSick) {
    return {
      eyebrow: 'Likely Limiter',
      title: 'Recovery Symptoms Take Priority',
      summary: 'Your latest check-in favors recovery over additional training load.',
    };
  }
  const strainScore = recovery.strain?.score;
  if (strainScore != null && strainScore >= 14) {
    return {
      eyebrow: 'Likely Limiter',
      title: `Strain Is Already ${formatNumber(strainScore)}/21`,
      summary: 'You have already accumulated substantial load today.',
    };
  }
  if (!latest || recovery.dataFreshness.status !== 'today') {
    return {
      eyebrow: 'Likely Limiter',
      title: 'Latest Sleep Is Missing',
      summary: 'WholeMate cannot identify a trustworthy limiter until the newest sleep record is synced.',
    };
  }

  const awakeBaseline = average(baseline.map((night) => night.awakeMinutes));
  if (latest.awakeMinutes != null && (latest.awakeMinutes >= 45 || (awakeBaseline != null && latest.awakeMinutes >= awakeBaseline + 15))) {
    return {
      eyebrow: 'Likely Limiter',
      title: `${Math.round(latest.awakeMinutes)} Min Awake During Sleep`,
      summary: awakeBaseline == null
        ? 'Your sleep contained a meaningful amount of awake time.'
        : `That is ${signedMinutes(latest.awakeMinutes - awakeBaseline)} versus your recent baseline.`,
    };
  }

  const hrvBaseline = average(baseline.map((night) => night.hrv));
  if (latest.hrv != null && hrvBaseline != null && latest.hrv <= hrvBaseline * 0.9) {
    return {
      eyebrow: 'Likely Limiter',
      title: 'HRV Below Your Baseline',
      summary: `${formatNumber(latest.hrv)} ms versus a recent baseline of ${formatNumber(hrvBaseline)} ms.`,
    };
  }

  const restingHrBaseline = average(baseline.map((night) => night.restingHR));
  if (latest.restingHR != null && restingHrBaseline != null && latest.restingHR >= restingHrBaseline + 5) {
    return {
      eyebrow: 'Likely Limiter',
      title: 'Resting HR Above Your Baseline',
      summary: `${formatNumber(latest.restingHR)} bpm versus a recent baseline of ${formatNumber(restingHrBaseline)} bpm.`,
    };
  }

  const sleep = recovery.sleepPerformance;
  if (sleep.actualSleepMinutes != null && sleep.sleepNeedMinutes - sleep.actualSleepMinutes >= 30) {
    return {
      eyebrow: 'Likely Limiter',
      title: `${formatDuration(sleep.sleepNeedMinutes - sleep.actualSleepMinutes)} Short Of Sleep Need`,
      summary: `You slept ${formatDuration(sleep.actualSleepMinutes)} against a current need of ${formatDuration(sleep.sleepNeedMinutes)}.`,
    };
  }

  return {
    eyebrow: 'Likely Limiter',
    title: 'No Single Strong Limiter',
    summary: 'Available sleep, HRV, and resting-heart-rate signals are close to your recent pattern.',
  };
}

function actionItem(
  context: CoachContext,
  options: BriefOptions,
  caffeine: CaffeineFinding | null,
  limiter: TodayBriefItem,
): TodayBriefItem {
  const recommendation = options.recommendation;
  if (recommendation && recommendation.action !== 'keep') {
    return {
      eyebrow: 'One Adjustment',
      title: recommendation.headline,
      summary: recommendation.summary,
    };
  }

  if (caffeine && isLateMeal(caffeine.meal.mealType) && /sleep|awake|HRV|Resting HR/i.test(`${limiter.title} ${limiter.summary}`)) {
    return {
      eyebrow: 'One Adjustment',
      title: 'No More Caffeine Today',
      summary: caffeine.meal.loggedAt
        ? `Last caffeine logged at ${formatLoggedTime(caffeine.meal.loggedAt)}.`
        : 'Caffeine appears in today’s meal log.',
    };
  }

  if (context.recoverySystem.sleepPerformance.state !== 'unscorable' && context.recoverySystem.sleepPerformance.score < 70) {
    return {
      eyebrow: 'One Adjustment',
      title: 'Protect Tonight’s Sleep Window',
      summary: 'Keep your wake time consistent and begin winding down 30 minutes earlier tonight.',
    };
  }

  if (options.planStatus === 'completed') {
    return {
      eyebrow: 'One Adjustment',
      title: 'Keep The Remaining Load Light',
      summary: 'Today’s planned session is complete, so avoid adding another demanding workout.',
    };
  }

  if (options.planStatus === 'logged_different') {
    return {
      eyebrow: 'One Adjustment',
      title: 'Count Today’s Session',
      summary: 'You already trained differently from the plan. Avoid stacking the missed session on top today.',
    };
  }

  if (options.planned) {
    // By this point recommendation is either absent or action === 'keep' (a
    // non-'keep' recommendation already returned above) - its own headline
    // for 'keep' is always the same generic "Keep The Original Plan" text
    // (adaptiveTrainingPlan.ts), so it's deliberately not used here.
    // describePlannedWorkout() (dailyRecommendation.ts) only formats fields
    // WeekWorkout already has (workoutType/distanceKm/durationMin) - never a
    // new number - so "keep the plan" states the actual concrete session
    // ("Easy Run · 5 km · 40 min") instead of a generic instruction with the
    // details hidden in a collapsed accordion.
    const planDetail = describePlannedWorkout(options.planned);
    const isRest = planDetail === 'Rest Day';
    return {
      eyebrow: 'One Adjustment',
      title: planDetail ?? 'Keep The Original Plan',
      summary: isRest
        ? 'Today is a scheduled rest day — no training planned.'
        : `Complete ${planDetail} as written, without adding extra distance or intensity.`,
    };
  }

  return {
    eyebrow: 'One Adjustment',
    title: 'Keep Today Steady',
    summary: 'Stay active at a comfortable effort and avoid adding unplanned training load.',
  };
}

function evidenceItems(
  context: CoachContext,
  latest: WeekSleepRow | null,
  baseline: WeekSleepRow[],
  caffeine: CaffeineFinding | null,
): TodayBriefItem[] {
  const items: TodayBriefItem[] = [];
  if (latest) {
    items.push({
      eyebrow: 'Sleep',
      title: latest.durationMinutes == null ? 'Duration Unavailable' : `${formatDuration(latest.durationMinutes)} Asleep`,
      summary: latest.awakeMinutes == null
        ? 'Awake duration was not available from the provider.'
        : `${Math.round(latest.awakeMinutes)} min awake during the recorded sleep window.`,
    });
  }
  const hrvBaseline = average(baseline.map((night) => night.hrv));
  const restingHrBaseline = average(baseline.map((night) => night.restingHR));
  if (latest?.hrv != null || latest?.restingHR != null) {
    items.push({
      eyebrow: 'Personal Baseline',
      title: [
        latest.hrv == null ? null : `HRV ${formatNumber(latest.hrv)} ms`,
        latest.restingHR == null ? null : `RHR ${formatNumber(latest.restingHR)} bpm`,
      ].filter(Boolean).join(' · '),
      summary: [
        hrvBaseline == null ? null : `HRV baseline ${formatNumber(hrvBaseline)} ms`,
        restingHrBaseline == null ? null : `RHR baseline ${formatNumber(restingHrBaseline)} bpm`,
      ].filter(Boolean).join(' · ') || 'More nights are needed for a personal comparison.',
    });
  }
  if (caffeine) {
    items.push({
      eyebrow: 'Caffeine Signal',
      title: `${caffeine.food} · ${caffeine.meal.mealType}`,
      summary: caffeine.meal.loggedAt
        ? `Logged at ${formatLoggedTime(caffeine.meal.loggedAt)}. Consumption time was not confirmed.`
        : 'Consumption time was not recorded.',
    });
  }
  if (context.todayPrimaryWorkout) {
    items.push({
      eyebrow: 'Today’s Activity',
      title: context.todayPrimaryWorkout.label,
      summary: context.todayPrimaryWorkout.durationText ?? 'Workout details are available in Activity.',
    });
  }
  return items.slice(0, 4);
}

type CaffeineFinding = { food: string; meal: MealContextSummary };

function latestCaffeine(meals: MealContextSummary[]): CaffeineFinding | null {
  return [...meals]
    .sort((a, b) => Date.parse(b.loggedAt ?? '') - Date.parse(a.loggedAt ?? ''))
    .map((meal) => ({ meal, food: meal.foods.find((food) => CAFFEINE_PATTERN.test(food)) }))
    .find((finding): finding is CaffeineFinding => Boolean(finding.food)) ?? null;
}

function isLateMeal(mealType: string): boolean {
  return /lunch|dinner|snack|afternoon|evening|กลางวัน|เย็น|ของว่าง/i.test(mealType);
}

function average(values: Array<number | null>): number | null {
  const valid = values.filter((value): value is number => value != null && Number.isFinite(value));
  return valid.length >= 2 ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function formatLoggedTime(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'an unknown time';
  return new Intl.DateTimeFormat('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  }).format(parsed);
}

function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const remainder = rounded % 60;
  return hours && remainder ? `${hours}h ${remainder}m` : hours ? `${hours}h` : `${remainder}m`;
}

function signedMinutes(value: number): string {
  const rounded = Math.round(value);
  return `${rounded >= 0 ? '+' : ''}${rounded} min`;
}

function formatNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
