import { daysBetween, getHistoryItemDateKey, shiftDate, weekdayIndex } from '@/lib/date';
import type { LocalHistoryItem } from '@/lib/localHistory';
import { dedupeWorkoutItems } from '@/lib/workoutDedupe';
import { buildTrainingAdherenceHistory, durationMinutes, normalizedActualKind, number, type TrainingAdherence } from '@/lib/trainingAdherence';
import type { RacePlan } from '@/types/race';
import type { RecoveryTrendInsight, RecoveryTrendPoint } from '@/lib/recoveryTrends';

export type RecapPeriod = 'week' | 'month';

export type PeriodTrainingSummary = {
  sessions: number;
  distanceKm: number;
  activeMinutes: number;
  activeDays: number;
  activeDateKeys: string[];
  trainingMix: { label: string; sessions: number }[];
};

/** Sessions/distance/active-time/mix derived directly from raw history items over [periodStart, periodEnd], unlike buildWeeklyTrainingSummary which is fixed to CoachContext's 7-day window. */
export function buildPeriodTrainingSummary(items: LocalHistoryItem[], periodStart: string, periodEnd: string): PeriodTrainingSummary {
  const workoutItems = dedupeWorkoutItems(items.filter((item) => item.type === 'workout' || item.type === 'strength'))
    .filter((item) => {
      const date = getHistoryItemDateKey(item);
      return date >= periodStart && date <= periodEnd;
    });

  const activeDates = new Set<string>();
  let distanceKm = 0;
  let activeMinutes = 0;
  let runSessions = 0;
  let walkSessions = 0;
  let otherSessions = 0;

  for (const item of workoutItems) {
    const data = item.data as { extracted?: Record<string, unknown> } | null;
    const extracted = data?.extracted ?? {};
    const kind = normalizedActualKind(item);
    if (kind === 'run' || kind === 'treadmill') runSessions += 1;
    else if (kind === 'walk') walkSessions += 1;
    else otherSessions += 1;

    distanceKm += number(extracted.distanceKm) ?? 0;
    const minutes = durationMinutes(extracted.duration) ?? 0;
    activeMinutes += minutes;
    if (minutes > 0) activeDates.add(getHistoryItemDateKey(item));
  }

  const trainingMix = [
    { label: 'Running', sessions: runSessions },
    { label: 'Walking', sessions: walkSessions },
    { label: 'Other Training', sessions: otherSessions },
  ].filter((entry) => entry.sessions > 0).sort((a, b) => b.sessions - a.sessions);

  return {
    sessions: runSessions + walkSessions + otherSessions,
    distanceKm: Math.round(distanceKm * 10) / 10,
    activeMinutes: Math.round(activeMinutes),
    activeDays: activeDates.size,
    activeDateKeys: [...activeDates].sort(),
    trainingMix,
  };
}

/**
 * Adherence over [periodStart, periodEnd], excluding days that haven't happened yet.
 * `todayDate` is the real current date and is used only to anchor how far back
 * buildTrainingAdherenceHistory fetches (it needs the REAL current week to correctly
 * detect "this week" and use the plan's live weeklyPlan, rather than resolving a
 * historical week that happens to contain periodEnd as if it were the live week).
 * The fetched per-day results are then flattened and re-aggregated over the
 * requested [periodStart, periodEnd] window — reusing the existing plan-matching
 * logic entirely, only the aggregation window changes.
 */
export function buildPeriodAdherence(plan: RacePlan | null, items: LocalHistoryItem[], periodStart: string, periodEnd: string, todayDate: string): TrainingAdherence {
  const weeksNeeded = Math.ceil((daysBetween(periodStart, todayDate) + 1) / 7) + 1;
  const weeks = buildTrainingAdherenceHistory(plan, items, todayDate, weeksNeeded);
  const days = weeks
    .flatMap((week) => week.days)
    .filter((day) => day.date >= periodStart && day.date <= periodEnd && day.status !== 'recovery');
  const completed = days.filter((day) => day.status === 'completed').length;
  const modified = days.filter((day) => day.status === 'modified').length;
  const missed = days.filter((day) => day.status === 'missed').length;
  const planned = days.length;
  return {
    completed,
    modified,
    missed,
    planned,
    percentage: planned > 0 ? Math.round(((completed + modified) / planned) * 100) : 0,
    days,
  };
}

export type WeeklyRecapHighlights = {
  period: RecapPeriod;
  periodTitle: string;
  periodStart: string;
  periodEnd: string;
  periodStartWeekday: number;
  periodDates: string[];
  dateRangeLabel: string;
  recoveryAverage: number | null;
  recoveryInsightTitle: string;
  recoveryInsightSummary: string;
  sleepBestScore: number | null;
  sleepScoredNights: number;
  adherencePercentage: number;
  adherenceCompleted: number;
  adherenceModified: number;
  adherenceMissed: number;
  adherencePlanned: number;
  sessions: number;
  distanceKm: number;
  activeMinutes: number;
  activeDateKeys: string[];
  topTrainingMixLabel: string | null;
};

export function buildWeeklyRecapHighlights(input: {
  period: RecapPeriod;
  periodStart: string;
  periodEnd: string;
  summary: PeriodTrainingSummary;
  adherence: TrainingAdherence;
  recoveryPoints: RecoveryTrendPoint[];
  recoveryInsight: RecoveryTrendInsight;
}): WeeklyRecapHighlights {
  const { period, periodStart, periodEnd, summary, adherence, recoveryPoints, recoveryInsight } = input;
  const scoredRecovery = recoveryPoints.filter((point): point is RecoveryTrendPoint & { recovery: number } => point.recovery != null);
  const recoveryAverage = scoredRecovery.length
    ? Math.round(scoredRecovery.reduce((sum, point) => sum + point.recovery, 0) / scoredRecovery.length)
    : null;
  const scoredSleep = recoveryPoints.filter((point): point is RecoveryTrendPoint & { sleep: number } => point.sleep != null);
  const sleepBestScore = scoredSleep.length ? Math.round(Math.max(...scoredSleep.map((point) => point.sleep))) : null;

  const periodDates: string[] = [];
  for (let date = periodStart; date <= periodEnd; date = shiftDate(date, 1)) periodDates.push(date);

  return {
    period,
    periodTitle: period === 'week' ? 'Your Week' : 'Your Month',
    periodStart,
    periodEnd,
    periodStartWeekday: weekdayIndex(periodStart),
    periodDates,
    dateRangeLabel: formatDateRange(periodStart, periodEnd),
    recoveryAverage,
    recoveryInsightTitle: recoveryInsight.title,
    recoveryInsightSummary: recoveryInsight.summary,
    sleepBestScore,
    sleepScoredNights: scoredSleep.length,
    adherencePercentage: adherence.percentage,
    adherenceCompleted: adherence.completed,
    adherenceModified: adherence.modified,
    adherenceMissed: adherence.missed,
    adherencePlanned: adherence.planned,
    sessions: summary.sessions,
    distanceKm: summary.distanceKm,
    activeMinutes: summary.activeMinutes,
    activeDateKeys: summary.activeDateKeys,
    topTrainingMixLabel: summary.trainingMix[0]?.label ?? null,
  };
}

function formatDateRange(start: string, end: string): string {
  const startDate = new Date(`${start}T12:00:00+07:00`);
  const endDate = new Date(`${end}T12:00:00+07:00`);
  const sameMonth = startDate.getUTCMonth() === endDate.getUTCMonth() && startDate.getUTCFullYear() === endDate.getUTCFullYear();
  const startLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(startDate);
  const endLabel = new Intl.DateTimeFormat('en-US', { month: sameMonth ? undefined : 'short', day: 'numeric', timeZone: 'Asia/Bangkok' }).format(endDate);
  return `${startLabel} – ${endLabel}`;
}
