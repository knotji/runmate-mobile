import type { RacePlan, TrainingWeek, WeekWorkout } from '@/types/race';
import { getBangkokDateKey } from '@/lib/date';
import { hasBodyRecompositionGoal } from '@/lib/goals/goalContext';
import type { UserGoalProfile } from '@/lib/goals/goalTypes';

/**
 * Refreshes guidance without rewriting the schedule users already followed.
 * The current week's sessions keep their day, workout type, and planned
 * distance so adherence and the schedule the runner committed to remain
 * stable. Matching generated sessions may enrich coaching details such as
 * pace, HR, purpose, and description. Later weeks may be regenerated.
 */
export function mergeRefreshedRacePlan(previous: RacePlan, generated: RacePlan, today: string): RacePlan {
  return mergeRefreshedRacePlanWithOptions(previous, generated, today);
}

export type RacePlanRefreshOptions = {
  /** Enables rolling refresh: past days and a completed today stay immutable. */
  dynamicUpcoming?: boolean;
  completedWorkoutDates?: string[];
  /** See applyStrengthPreferenceToUnlockedDays() below. */
  goalProfile?: UserGoalProfile | null;
};

export function mergeRefreshedRacePlanWithOptions(previous: RacePlan, generated: RacePlan, today: string, options: RacePlanRefreshOptions = {}): RacePlan {
  const currentWeek = currentPlanWeek(previous.planStartDate, today);
  const lockedDays = options.dynamicUpcoming ? lockedWeekdays(today, options.completedWorkoutDates ?? []) : null;
  const weeklyPlan = applyStrengthPreferenceToUnlockedDays(
    mergeCurrentWeek(previous.weeklyPlan ?? [], generated.weeklyPlan ?? [], lockedDays),
    options.goalProfile ?? null,
    lockedDays,
  );
  return {
    ...generated,
    planStartDate: previous.planStartDate ?? generated.planStartDate ?? today,
    createdAt: previous.createdAt ?? generated.createdAt ?? null,
    weeklyPlan,
    weeks: mergeTrainingWeeks(previous.weeks ?? [], generated.weeks ?? [], generated.weeklyPlan ?? [], currentWeek, lockedDays),
  };
}

const HARD_WORKOUT_PATTERN = /tempo|threshold|interval|speed|repeat|hill|race/i;
const SOFT_WORKOUT_PATTERN = /rest|recovery|easy/i;

/**
 * The server (generate-race-plan's applyStrengthPreference, plan-policy.ts)
 * already guarantees a body-recomposition Strength Training slot on its own
 * output - but mergeCurrentWeek() above always keeps the OLD workout for any
 * locked day (past, or already completed this week) regardless of what the
 * server generated, and the server's guarantee tends to land on exactly
 * those earliest-in-the-week days, since it has no visibility into which
 * days this client will treat as locked. Confirmed by a real refresh: a
 * user with a body-recomposition goal hit Refresh Plan mid-week (most of
 * the week already completed) and still saw zero Strength Training in the
 * preview, even after the server-side fix. Re-applies the same policy here,
 * restricted to genuinely open (unlocked) days only, so a mid-week refresh
 * doesn't silently drop the preference.
 */
function applyStrengthPreferenceToUnlockedDays(weeklyPlan: WeekWorkout[], goalProfile: UserGoalProfile | null, lockedDays: Set<number> | null): WeekWorkout[] {
  if (!hasBodyRecompositionGoal(goalProfile)) return weeklyPlan;
  if (weeklyPlan.some((item) => item.workoutType === 'Strength Training')) return weeklyPlan;
  const eligible = weeklyPlan
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => !lockedDays?.has(weekdayIndex(item.day))
      && SOFT_WORKOUT_PATTERN.test(item.workoutType)
      && !HARD_WORKOUT_PATTERN.test(weeklyPlan[index - 1]?.workoutType ?? '')
      && !HARD_WORKOUT_PATTERN.test(weeklyPlan[index + 1]?.workoutType ?? ''))
    .map(({ index }) => index)
    .slice(0, 2);
  if (eligible.length === 0) return weeklyPlan;
  return weeklyPlan.map((item, index) => (eligible.includes(index) ? {
    ...item,
    workoutType: 'Strength Training',
    distanceKm: null,
    durationMin: 30,
    targetPace: null,
    targetHR: 'Controlled effort',
    description: 'ฝึกความแข็งแรงของกล้ามเนื้อขาและแกนกลางลำตัว เสริมความมั่นคงให้การวิ่ง',
    purpose: 'ฝึกความแข็งแรงของกล้ามเนื้อขาและแกนกลางลำตัว เสริมความมั่นคงให้การวิ่ง',
    adjustment: 'หยุดหรือลดความหนักทันทีถ้ารู้สึกเจ็บหรือรู้สึกผิดปกติ',
  } : item));
}

/**
 * Rebuilds the visible plan from the snapshot immediately before the latest
 * buggy timeline reset. The old refresh flow changed planStartDate to the date
 * the refresh was saved; that transition is a durable boundary in snapshot
 * history and identifies the plan the runner was following without guessing.
 */
export function reconcileRacePlanSnapshots(plansNewestFirst: RacePlan[], today: string): RacePlan | null {
  const latest = plansNewestFirst[0];
  if (!latest) return null;
  const chronological = [...plansNewestFirst].reverse();
  let baseline = latest;
  for (let index = 1; index < chronological.length; index += 1) {
    const previous = chronological[index - 1];
    const candidate = chronological[index];
    const previousStart = previous.planStartDate?.slice(0, 10);
    const candidateStart = candidate.planStartDate?.slice(0, 10);
    const candidateSavedDate = candidate.createdAt ? getBangkokDateKey(candidate.createdAt) : null;
    if (
      previousStart
      && candidateStart
      && candidateSavedDate
      && candidateStart > previousStart
      && candidateStart === candidateSavedDate
    ) {
      baseline = previous;
    }
  }
  return baseline === latest ? latest : mergeRefreshedRacePlan(baseline, latest, today);
}

function mergeTrainingWeeks(previous: TrainingWeek[], generated: TrainingWeek[], generatedCurrentWorkouts: WeekWorkout[], currentWeek: number | null, lockedDays: Set<number> | null): TrainingWeek[] {
  if (currentWeek === null) return generated;
  const oldByNumber = new Map(previous.map((week) => [week.weekNumber, week]));
  const newByNumber = new Map(generated.map((week) => [week.weekNumber, week]));
  const weekNumbers = [...new Set([...oldByNumber.keys(), ...newByNumber.keys()])].sort((a, b) => a - b);

  return weekNumbers.flatMap((weekNumber) => {
    const oldWeek = oldByNumber.get(weekNumber);
    const generatedWeek = newByNumber.get(weekNumber);
    const newWeek = weekNumber === currentWeek && !generatedWeek && generatedCurrentWorkouts.length > 0 && oldWeek
      ? { ...oldWeek, workouts: generatedCurrentWorkouts }
      : generatedWeek;
    if (weekNumber < currentWeek) return oldWeek ? [oldWeek] : [];
    if (weekNumber > currentWeek) return newWeek ? [newWeek] : oldWeek ? [oldWeek] : [];
    if (!oldWeek) return newWeek ? [newWeek] : [];
    if (!newWeek) return [oldWeek];
    const workouts = mergeCurrentWeek(oldWeek.workouts, newWeek.workouts, lockedDays);
    return [{
      ...newWeek,
      workouts,
      targetWeeklyDistanceKm: sumDistance(workouts),
      longRunDistanceKm: longestDistance(workouts),
    }];
  });
}

function mergeCurrentWeek(previous: WeekWorkout[], generated: WeekWorkout[], lockedDays: Set<number> | null = null): WeekWorkout[] {
  const generatedByDay = new Map(generated.map((workout) => [weekdayIndex(workout.day), workout]));
  const previousByDay = new Map(previous.map((workout) => [weekdayIndex(workout.day), workout]));
  const days = [...new Set([...previousByDay.keys(), ...generatedByDay.keys()])].sort((a, b) => a - b);

  return days.flatMap((day) => {
    const oldWorkout = previousByDay.get(day);
    const newWorkout = generatedByDay.get(day);
    // Race Day is an immutable fact from the active Race Goal (see raceDayWorkout()/
    // enforceRaceWeek() on the generator side) — it must always win over whatever was
    // previously committed for that date, even if the date is locked as already
    // completed (e.g. an unrelated workout was logged that day) or the workout kind
    // otherwise "changed" from the runner's committed plan. Every other check below
    // exists specifically to protect a runner's committed schedule from being silently
    // rewritten by the AI; Race Day is not a discretionary AI decision, so it is not
    // subject to that protection.
    if (newWorkout?.workoutType === 'Race Day') return [newWorkout];
    if (lockedDays?.has(day)) return oldWorkout ? [oldWorkout] : [];
    if (lockedDays) return newWorkout ? [newWorkout] : oldWorkout ? [oldWorkout] : [];
    if (!oldWorkout) return newWorkout ? [newWorkout] : [];
    if (!newWorkout || workoutKind(oldWorkout.workoutType) !== workoutKind(newWorkout.workoutType)) return [oldWorkout];
    return [{
      ...oldWorkout,
      targetPace: newWorkout.targetPace ?? oldWorkout.targetPace,
      targetHR: newWorkout.targetHR ?? oldWorkout.targetHR,
      description: newWorkout.description || oldWorkout.description,
      durationMin: newWorkout.durationMin ?? oldWorkout.durationMin,
      purpose: newWorkout.purpose ?? oldWorkout.purpose,
      adjustment: newWorkout.adjustment ?? oldWorkout.adjustment,
    }];
  });
}

function lockedWeekdays(today: string, completedWorkoutDates: string[]): Set<number> {
  const completed = new Set(completedWorkoutDates.map((date) => date.slice(0, 10)));
  const todayDate = new Date(`${today}T12:00:00Z`);
  const start = new Date(todayDate);
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const locked = new Set<number>();
  for (let day = 0; day < 7; day += 1) {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + day);
    const key = date.toISOString().slice(0, 10);
    if (key < today || completed.has(key)) locked.add(day);
  }
  return locked;
}

function sumDistance(workouts: WeekWorkout[]): number {
  return Math.round(workouts.reduce((total, workout) => total + (workout.distanceKm ?? 0), 0) * 10) / 10;
}

function longestDistance(workouts: WeekWorkout[]): number | null {
  const values = workouts.map((workout) => workout.distanceKm).filter((value): value is number => value != null);
  return values.length ? Math.max(...values) : null;
}

function currentPlanWeek(planStartDate: string | null | undefined, today: string): number | null {
  if (!planStartDate) return null;
  const start = startOfWeek(planStartDate.slice(0, 10));
  const current = startOfWeek(today);
  const difference = Math.round((Date.parse(`${current}T12:00:00Z`) - Date.parse(`${start}T12:00:00Z`)) / 86_400_000);
  return difference < 0 ? null : Math.floor(difference / 7) + 1;
}

function startOfWeek(dateKey: string): string {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - date.getUTCDay());
  return date.toISOString().slice(0, 10);
}

function weekdayIndex(value: string): number {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T12:00:00+07:00`).getDay();
  const day = value.trim().toLowerCase();
  if (day.startsWith('sun')) return 0;
  if (day.startsWith('mon')) return 1;
  if (day.startsWith('tue')) return 2;
  if (day.startsWith('wed')) return 3;
  if (day.startsWith('thu')) return 4;
  if (day.startsWith('fri')) return 5;
  if (day.startsWith('sat')) return 6;
  return -1;
}

function workoutKind(value: string): string {
  const kind = value.toLowerCase();
  if (/rest|recovery day|พัก/.test(kind)) return 'rest';
  if (/tempo|threshold/.test(kind)) return 'tempo';
  if (/interval|speed|repeat/.test(kind)) return 'interval';
  if (/long/.test(kind)) return 'long';
  if (/easy|recovery run/.test(kind)) return 'easy';
  if (/strength|weight|core/.test(kind)) return 'strength';
  return kind.replace(/\s+/g, '_');
}
