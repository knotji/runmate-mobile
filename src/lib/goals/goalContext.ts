import type { CoachContext } from '@/lib/buildCoachContext';
import { BODY_GOALS, GOAL_TYPES, type GoalType, type UserGoalProfile } from './goalTypes';

// Cross-system rule for every consumer of a UserGoalProfile in this app:
// primary goal guides prioritization; secondary goals influence trade-offs
// and supporting recommendations, but must not override safety, recovery, or
// the primary training objective. Applied differently per system (training
// plan: primary leads, secondary claims eligible slots; fuel: primary and
// secondary both apply at once, in different dimensions; sleep/recovery:
// goals are supporting rationale only, never change the underlying
// recovery-driven decision) — see each consumer for its specific treatment.

// CoachContext.profile is typed as Record<string, unknown> | null, but at
// runtime every builder (coachContextService.ts's buildCoachContextFromSupabase/
// buildRecoveryCoreContextFromSupabase/buildRecoveryPageContextFromSupabase)
// populates it via loadProfileFromSupabase() -> rowToProfile(), i.e. the
// already-typed UserProfile (camelCase goalProfile), never the raw
// snake_case DB row. Reading `.goal_profile` here silently returned null
// for every real user regardless of what they set in Profile Settings -
// found via a real bug report (a user's six_pack secondary goal never
// affected their race plan, despite two separate fixes further downstream).
// Still filters out malformed/legacy JSON instead of trusting it blindly,
// since it flows into AI prompts downstream.
export function extractGoalProfile(context: Pick<CoachContext, 'profile'>): UserGoalProfile | null {
  const raw = context.profile;
  const value = raw && typeof raw === 'object' ? (raw as Record<string, unknown>).goalProfile : null;
  if (!value || typeof value !== 'object') return null;
  const input = value as Record<string, unknown>;
  const primaryGoal = isGoalType(input.primaryGoal) ? input.primaryGoal : null;
  if (!primaryGoal) return null;
  return {
    primaryGoal,
    secondaryGoals: Array.isArray(input.secondaryGoals) ? input.secondaryGoals.filter(isGoalType) : [],
    guardrailGoals: Array.isArray(input.guardrailGoals) ? input.guardrailGoals.filter(isGoalType) : [],
  };
}

// True when a body-recomposition goal (six_pack/fat_loss/muscle_gain) is
// present anywhere in the goal profile, primary or secondary.
export function hasBodyRecompositionGoal(goalProfile: UserGoalProfile | null): boolean {
  if (!goalProfile) return false;
  return (BODY_GOALS as string[]).includes(goalProfile.primaryGoal) || goalProfile.secondaryGoals.some((goal) => (BODY_GOALS as string[]).includes(goal));
}

function isGoalType(value: unknown): value is GoalType {
  return typeof value === 'string' && (GOAL_TYPES as readonly string[]).includes(value);
}
