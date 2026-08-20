// Cross-system rule (see src/lib/goals/goalContext.ts for the client-side
// mirror of this comment): primary goal guides prioritization, secondary
// goals influence trade-offs and supporting recommendations, but must not
// override safety, recovery, or the primary training objective. Applied here:
// running_consistency (primary) always keeps its run days untouched -
// offIndexes is only ever the non-run days the caller already decided, so
// this never claims a primary-goal running slot. A body-recomposition
// secondary goal (six_pack/fat_loss/muscle_gain) claims up to 2 eligible
// off-days per week instead of 1, when Recovery/race phase allow and a
// strength session isn't already committed this week - never by adding
// extra running volume on top of the planned days.

export type StrengthAllocationInput = {
  safeOnly: boolean;
  daysLeft: number;
  bodyRecompositionGoalActive: boolean;
  strengthAlreadyThisWeek: boolean;
};

export function selectStrengthDayIndexes(offIndexes: number[], input: StrengthAllocationInput): number[] {
  if (input.safeOnly || input.daysLeft <= 7 || offIndexes.length === 0 || input.strengthAlreadyThisWeek) return [];
  const desiredCount = input.bodyRecompositionGoalActive ? 2 : 1;
  return offIndexes.slice(0, Math.min(desiredCount, offIndexes.length));
}

const BODY_RECOMPOSITION_GOALS = new Set(['six_pack', 'fat_loss', 'muscle_gain']);

export function hasBodyRecompositionGoal(goalProfile: unknown): boolean {
  const profile = goalProfile && typeof goalProfile === 'object' ? goalProfile as Record<string, unknown> : null;
  if (!profile) return false;
  const primary = typeof profile.primaryGoal === 'string' ? profile.primaryGoal : null;
  const secondary = Array.isArray(profile.secondaryGoals) ? profile.secondaryGoals : [];
  return Boolean(primary && BODY_RECOMPOSITION_GOALS.has(primary)) || secondary.some((goal) => typeof goal === 'string' && BODY_RECOMPOSITION_GOALS.has(goal));
}
