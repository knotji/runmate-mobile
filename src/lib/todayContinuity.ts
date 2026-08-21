import type { CoachContext } from '@/lib/buildCoachContext';
import type { DailyRecommendation } from '@/lib/dailyRecommendation';
import { goalFromContext } from '@/lib/raceWeekAlignment';
import { getPlannedWorkoutForDateWithRaceDay, isRestDayWorkout } from '@/lib/todayTrainingPlan';
import type { RacePlan } from '@/types/race';

/**
 * "Yesterday → Today" — an optional continuity line connecting yesterday's
 * actual training to today's already-computed dailyRecommendation. Reads only
 * data CoachContext already loads for Today (yesterdayDate, workoutsYesterday,
 * the committed weekly plan) — no new fetch, no new decision. It only ever
 * fires when there's a real, checkable link between what happened yesterday
 * and today's recommendation; otherwise it renders nothing rather than
 * forcing a generic "all connected!" line.
 */
export type TodayContinuity =
  | { status: 'none' }
  | { status: 'gap'; message: string }
  | { status: 'ready'; tone: 'up' | 'down'; message: string };

const OVERTRAIN_THRESHOLD_KM = 2;

export function buildTodayContinuity(context: CoachContext, dailyRecommendation: DailyRecommendation): TodayContinuity {
  if (dailyRecommendation.status !== 'ready') return { status: 'none' };

  const goal = goalFromContext(context.raceGoal, {
    raceName: context.raceName,
    raceDate: context.raceDate,
    raceDistance: context.raceDistance,
    targetTime: context.targetTime,
  });
  const plannedYesterday = getPlannedWorkoutForDateWithRaceDay(context.racePlan as RacePlan | null, goal, context.yesterdayDate);
  const plannedWasRest = !plannedYesterday || isRestDayWorkout(plannedYesterday);

  const actual = context.workoutsYesterday;
  const hasActualTraining = Boolean(actual && (actual.runs.length > 0 || actual.walks.length > 0 || actual.other.length > 0));

  if (plannedWasRest && !hasActualTraining) {
    // A confirmed rest day yesterday only earns a continuity line when
    // today's recommendation is actually favorable - "you rested, but
    // today still says reduce" isn't a clean story, so say nothing rather
    // than force one.
    if (dailyRecommendation.action === 'push' || dailyRecommendation.action === 'normal') {
      return {
        status: 'ready',
        tone: 'up',
        message: `You rested yesterday, and today supports a ${dailyRecommendation.action === 'push' ? 'strong' : 'normal'} training day.`,
      };
    }
    return { status: 'none' };
  }

  if (!plannedWasRest && !hasActualTraining) {
    return { status: 'gap', message: "Yesterday's planned session hasn't synced yet, so it isn't reflected below." };
  }

  if (hasActualTraining && plannedYesterday && !plannedWasRest) {
    const actualKm = roundHalf(actual!.runs.reduce((sum, run) => sum + run.km, 0));
    const plannedKm = plannedYesterday.distanceKm ?? null;
    const overtrained = plannedKm != null && actualKm >= plannedKm + OVERTRAIN_THRESHOLD_KM;
    if (overtrained && (dailyRecommendation.action === 'reduce' || dailyRecommendation.action === 'recover')) {
      return {
        status: 'ready',
        tone: 'down',
        message: `Yesterday you covered ${actualKm} km, more than the planned ${plannedKm} km. ${dailyRecommendation.reason}`,
      };
    }
  }

  return { status: 'none' };
}

function roundHalf(value: number): number {
  return Math.round(value * 2) / 2;
}
