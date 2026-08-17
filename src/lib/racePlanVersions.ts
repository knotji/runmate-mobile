import type { RacePlan, RacePlanVersion, WeekWorkout } from '@/types/race';
import { normalizeWeekdayLabel } from '@/lib/raceGoalFormatting';

export type RacePlanChange = {
  day: string;
  before: WeekWorkout | null;
  after: WeekWorkout | null;
  kind: 'added' | 'removed' | 'changed' | 'unchanged';
};

export function buildRacePlanDiff(current: RacePlan, proposed: RacePlan): RacePlanChange[] {
  const beforeByDay = workoutMap(current.weeklyPlan ?? []);
  const afterByDay = workoutMap(proposed.weeklyPlan ?? []);
  const days = [...new Set([...beforeByDay.keys(), ...afterByDay.keys()])].sort((a, b) => a - b);
  return days.map((dayIndex) => {
    const before = beforeByDay.get(dayIndex) ?? null;
    const after = afterByDay.get(dayIndex) ?? null;
    return {
      day: weekdayLabel(dayIndex),
      before,
      after,
      kind: !before ? 'added' : !after ? 'removed' : sameWorkout(before, after) ? 'unchanged' : 'changed',
    };
  });
}

export function prepareActivePlanVersion(
  plan: RacePlan,
  versions: RacePlanVersion[],
  options: { restoredFromPlanId?: string | null } = {},
): RacePlan {
  const active = versions.find((version) => version.status === 'active') ?? versions[0] ?? null;
  const nextVersion = Math.max(0, ...versions.map((version) => version.plan.planVersion ?? 0)) + 1;
  return {
    ...plan,
    storageId: null,
    planVersion: nextVersion,
    planStatus: 'active',
    supersedesPlanId: active?.id ?? plan.storageId ?? null,
    restoredFromPlanId: options.restoredFromPlanId ?? null,
    updatedAt: new Date().toISOString(),
  };
}

export function prepareLegacyActivePlanVersion(plan: RacePlan): RacePlan {
  return {
    ...plan,
    storageId: null,
    planVersion: 1,
    planStatus: 'active',
    supersedesPlanId: plan.storageId ?? null,
    restoredFromPlanId: null,
    updatedAt: new Date().toISOString(),
  };
}

function workoutMap(workouts: WeekWorkout[]): Map<number, WeekWorkout> {
  return new Map(workouts.map((workout) => [normalizeWeekdayLabel(workout.day), workout]));
}

function sameWorkout(left: WeekWorkout, right: WeekWorkout): boolean {
  return left.workoutType === right.workoutType
    && left.distanceKm === right.distanceKm
    && left.targetPace === right.targetPace
    && left.description === right.description
    && left.durationMin === right.durationMin;
}

function weekdayLabel(index: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][index] ?? 'Day';
}
