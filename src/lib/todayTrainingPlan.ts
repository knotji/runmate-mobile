import type { CoachContext } from '@/lib/buildCoachContext';
import type { RaceGoal, RacePlan, WeekWorkout } from '@/types/race';
import { goalFromContext, raceDayWorkout } from '@/lib/raceWeekAlignment';
import { normalizeWeekdayLabel } from '@/lib/raceGoalFormatting';

/**
 * Picks today's planned workout from the active race plan's weekly schedule.
 * Ported from runmate-ai's getTodayPlannedWorkout(): tries an explicit date match first,
 * then a weekday-label match, then falls back to a planStartDate offset into weeklyPlan.
 */
export function getTodayPlannedWorkout(context: CoachContext): WeekWorkout | null {
  const goal = goalFromContext(context.raceGoal, { raceName: context.raceName, raceDate: context.raceDate, raceDistance: context.raceDistance, targetTime: context.targetTime });
  return getPlannedWorkoutForDateWithRaceDay(context.racePlan as RacePlan | null, goal, context.todayDate);
}

/**
 * Same as getPlannedWorkoutForDate(), but overrides the weekly plan's own entry for
 * the active Race Goal's race date with a dedicated Race Day workout. The weekly plan
 * generator does not always mark its own final day as Race Day (e.g. it can still read
 * "Easy Run" on the taper's last day) even though the active Race Goal already knows
 * today is race day — any caller that renders a planned-workout card for a specific
 * date must go through this, not the plan lookup alone, or it can show a stale plan
 * entry that contradicts the Race Goal page shown elsewhere in the app.
 */
export function getPlannedWorkoutForDateWithRaceDay(
  plan: RacePlan | null,
  goal: Pick<RaceGoal, 'raceName' | 'raceDate' | 'raceDistance' | 'targetTime'> | null,
  date: string,
): WeekWorkout | null {
  if (goal?.raceDate === date) return raceDayWorkout(goal);
  return getPlannedWorkoutForDate(plan, date);
}

export function getPlannedWorkoutForDate(plan: RacePlan | null, date: string): WeekWorkout | null {
  if (!plan) return null;
  const weeklyPlan = Array.isArray(plan.weeklyPlan) ? plan.weeklyPlan : [];
  if (!weeklyPlan.length) return plan.todayWorkout ?? null;

  for (const workout of weeklyPlan) {
    const raw = workout as WeekWorkout & { date?: string; dateKey?: string; dayDate?: string };
    const workoutDate = raw.date ?? raw.dateKey ?? raw.dayDate;
    if (workoutDate?.slice(0, 10) === date) return workout;
  }

  const todayWeekday = bangkokWeekdayIndex(date);
  for (const workout of weeklyPlan) {
    if (normalizeWeekdayLabel(workout.day) === todayWeekday) return workout;
  }

  if (plan.planStartDate) {
    const startMs = Date.parse(`${plan.planStartDate}T12:00:00+07:00`);
    const todayMs = Date.parse(`${date}T12:00:00+07:00`);
    if (!Number.isNaN(startMs) && !Number.isNaN(todayMs)) {
      const offset = Math.round((todayMs - startMs) / 86_400_000);
      if (offset >= 0 && offset < weeklyPlan.length) return weeklyPlan[offset] ?? null;
    }
  }

  return plan.todayWorkout ?? null;
}

function bangkokWeekdayIndex(date: string): number {
  const parsed = new Date(`${date}T12:00:00+07:00`);
  return Number.isNaN(parsed.getTime()) ? -1 : parsed.getDay();
}

function isPlannedStrengthType(workoutType: string): boolean {
  return workoutType.includes('strength') || workoutType.includes('เวท');
}

function isPlannedRunType(workoutType: string): boolean {
  return (
    workoutType.includes('run') ||
    workoutType.includes('วิ่ง') ||
    workoutType.includes('ซ้อม') ||
    workoutType.includes('แข่ง') ||
    workoutType.includes('race') ||
    workoutType.includes('interval') ||
    workoutType.includes('tempo') ||
    workoutType.includes('easy')
  );
}

function isPlannedRecoveryType(workoutType: string): boolean {
  return (
    workoutType.includes('recovery') ||
    workoutType.includes('rest') ||
    workoutType.includes('พัก') ||
    workoutType.includes('ฟื้น') ||
    workoutType.includes('walk') ||
    workoutType.includes('เดิน')
  );
}

export function isRestDayWorkout(workout: WeekWorkout | null): boolean {
  if (!workout) return false;
  const workoutType = (workout.workoutType ?? '').trim().toLowerCase();
  return /^(rest|rest day)$/.test(workoutType) || /^(พัก|วันพัก)$/.test(workoutType);
}

export type TodayTrainingPlanStatus = 'pending' | 'completed' | 'logged_different';

/**
 * Compares today's logged workouts against the planned workout type.
 * - 'pending': nothing logged today yet — the plan below is still today's to-do.
 * - 'completed': something logged today matches the planned type.
 * - 'logged_different': something WAS logged today, but it doesn't match the plan
 *   (e.g. planned an easy run but logged strength instead). This must be shown
 *   distinctly from 'pending' — silently falling back to "still to do" would be
 *   misleading on a day the user already trained differently than planned.
 */
export function getTodayTrainingPlanStatus(context: CoachContext, planned: WeekWorkout | null): TodayTrainingPlanStatus {
  if (!planned || context.todayWorkouts.length === 0) return 'pending';
  if (isRestDayWorkout(planned)) return 'logged_different';
  const plannedType = (planned.workoutType ?? '').toLowerCase();

  const loggedStrength = context.todayWorkouts.some((w) => w.kind === 'strength');
  const loggedRun = context.todayWorkouts.some((w) => w.kind === 'run' || w.kind === 'race');
  const loggedWalkOrOther = context.todayWorkouts.some((w) => w.kind === 'walk' || w.kind === 'other' || w.kind === 'cycling');

  let matched = false;
  if (isPlannedStrengthType(plannedType)) matched = loggedStrength;
  else if (isPlannedRunType(plannedType)) matched = loggedRun;
  else if (isPlannedRecoveryType(plannedType)) matched = loggedWalkOrOther || loggedRun;

  return matched ? 'completed' : 'logged_different';
}

const THAI_PLAN_FIELD_TRANSLATIONS: Array<[RegExp, string]> = [
  [/โซน/g, 'Zone'],
  [/ไม่เกิน/g, 'Max'],
  [/อย่างน้อย/g, 'Min'],
  [/ประมาณ/g, 'About'],
];

/**
 * Race plan fields (targetPace, targetHR) come from runmate-ai's Thai-first plan
 * generator and may contain Thai words even though the mobile UI is English-only.
 * Translate the common ones at the presentation boundary rather than changing the
 * stored plan data.
 */
export function translatePlanFieldToEnglish(value: string): string {
  const translated = THAI_PLAN_FIELD_TRANSLATIONS.reduce((text, [pattern, replacement]) => text.replace(pattern, replacement), value);
  return normalizePaceToHalfMinute(translated);
}

function normalizePaceToHalfMinute(value: string): string {
  const matches = [...value.matchAll(/\b(\d{1,2}):(\d{2})\b/g)];
  if (matches.length === 0) return value;

  let index = 0;
  return value.replace(/\b(\d{1,2}):(\d{2})\b/g, (_match, minutes: string, seconds: string) => {
    const totalSeconds = Number(minutes) * 60 + Number(seconds);
    const roundedSeconds = matches.length > 1
      ? index++ === 0 ? Math.floor(totalSeconds / 30) * 30 : Math.ceil(totalSeconds / 30) * 30
      : Math.round(totalSeconds / 30) * 30;
    return `${Math.floor(roundedSeconds / 60)}:${String(roundedSeconds % 60).padStart(2, '0')}`;
  });
}

export type TodayTrainingPlanGuidance = {
  headline: string;
  summary: string;
};

/**
 * A short, session-specific instruction for today's planned workout — what to actually
 * do with the plan below, not a restatement of the Recovery zone. Training Guidance
 * already states the zone and the general guardrail, so this stays null whenever Recovery
 * is in the green zone to avoid repeating the same message twice on one screen.
 */
export function buildTodayTrainingPlanGuidance(context: CoachContext, planned: WeekWorkout | null): TodayTrainingPlanGuidance | null {
  if (!planned) return null;
  if (isRestDayWorkout(planned)) {
    return { headline: 'Rest And Recover', summary: 'Take today easy and focus on recovery.' };
  }
  const recovery = context.recoverySystem;
  const scorable = recovery.scoreState === 'scored' || recovery.scoreState === 'calibrating';
  const score = scorable ? recovery.overallScore : null;

  if (score == null) {
    return { headline: 'Follow The Plan', summary: 'Recovery isn’t scored yet — follow today’s session as written.' };
  }
  if (score < 34) {
    return { headline: 'Scale This Back', summary: 'Shorten today’s distance or drop to an easy effort instead of the plan as written.' };
  }
  if (score < 67) {
    return { headline: 'Keep It Controlled', summary: 'Stick to the planned session below, but don’t push past it.' };
  }
  return null;
}
