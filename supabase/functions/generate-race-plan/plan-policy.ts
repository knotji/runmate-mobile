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

const isHardWorkout = (value: string) => /tempo|threshold|interval|speed|repeat|hill|race/i.test(value);

/**
 * A day is eligible to become Strength Training only if it's currently a
 * soft day (Rest/Recovery/Easy) and isn't next to a hard session on either
 * side - same "never adjacent to a hard session" rule buildFallbackPlan's
 * own strengthIndexes already follow, just derived from an actual weekly
 * plan's contents (any source: fallback or AI) instead of index-guessing.
 */
export function eligibleStrengthDayIndexes(weeklyPlan: Array<{ workoutType: string }>): number[] {
  return weeklyPlan
    .map((item, index) => ({ item, index }))
    .filter(({ item, index }) => /rest|recovery|easy/i.test(item.workoutType)
      && !isHardWorkout(weeklyPlan[index - 1]?.workoutType ?? '')
      && !isHardWorkout(weeklyPlan[index + 1]?.workoutType ?? ''))
    .map(({ index }) => index);
}

/**
 * Guarantees the body-recomposition Strength Training preference on a
 * FINAL weekly plan regardless of its source (fallback or AI-generated) -
 * see index.ts's normalizePlan() for why the AI path needs this: Gemini's
 * own per-day workoutType always wins over the fallback plan's, so the
 * fallback's strengthIndexes alone never reach a real AI-generated plan,
 * and the prompt's own instruction is explicitly skippable. Never touches
 * a plan that already has a Strength Training session (respects the AI's
 * or the fallback's own choice), and only ever claims days already left as
 * Rest/Recovery/Easy - never a run day the caller chose.
 */
export function applyStrengthPreference<T extends { workoutType: string }>(
  weeklyPlan: T[],
  goalProfile: unknown,
  input: { safeOnly: boolean; daysLeft: number },
  buildStrengthDay: (day: T) => T,
): T[] {
  const bodyRecompositionGoalActive = hasBodyRecompositionGoal(goalProfile);
  if (!bodyRecompositionGoalActive || weeklyPlan.some((item) => item.workoutType === 'Strength Training')) return weeklyPlan;
  const eligible = eligibleStrengthDayIndexes(weeklyPlan);
  const strengthIndexes = selectStrengthDayIndexes(eligible, { ...input, bodyRecompositionGoalActive, strengthAlreadyThisWeek: false });
  if (strengthIndexes.length === 0) return weeklyPlan;
  return weeklyPlan.map((item, index) => (strengthIndexes.includes(index) ? buildStrengthDay(item) : item));
}
