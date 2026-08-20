import { describe, expect, it } from 'vitest';
import { extractGoalProfile, hasBodyRecompositionGoal } from './goalContext';

describe('extractGoalProfile', () => {
  it('returns a valid goal profile from the raw Supabase profile row', () => {
    const context = { profile: { goal_profile: { primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] } } };
    expect(extractGoalProfile(context)).toEqual({ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] });
  });

  it('returns null when there is no profile or no goal_profile column', () => {
    expect(extractGoalProfile({ profile: null })).toBeNull();
    expect(extractGoalProfile({ profile: {} })).toBeNull();
  });

  it('returns null when primaryGoal is missing or not a known GoalType', () => {
    expect(extractGoalProfile({ profile: { goal_profile: { secondaryGoals: ['six_pack'] } } })).toBeNull();
    expect(extractGoalProfile({ profile: { goal_profile: { primaryGoal: 'become_the_goat' } } })).toBeNull();
  });

  it('drops unknown/legacy strings from secondaryGoals and guardrailGoals instead of trusting them', () => {
    const context = { profile: { goal_profile: { primaryGoal: 'running_consistency', secondaryGoals: ['six_pack', 'legacy_value', 123], guardrailGoals: ['stress_balance', null] } } };
    expect(extractGoalProfile(context)).toEqual({ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: ['stress_balance'] });
  });

  it('treats a non-object goal_profile as malformed rather than throwing', () => {
    expect(extractGoalProfile({ profile: { goal_profile: 'running_consistency' } })).toBeNull();
    expect(extractGoalProfile({ profile: { goal_profile: null } })).toBeNull();
  });
});

describe('hasBodyRecompositionGoal', () => {
  it('is true when the primary goal is a body-recomposition goal', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'six_pack', secondaryGoals: [], guardrailGoals: [] })).toBe(true);
  });

  it('is true when a secondary goal is a body-recomposition goal', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] })).toBe(true);
  });

  it('is false when no body-recomposition goal is present', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'running_consistency', secondaryGoals: ['sleep_better'], guardrailGoals: [] })).toBe(false);
  });

  it('is false when there is no goal profile at all', () => {
    expect(hasBodyRecompositionGoal(null)).toBe(false);
  });
});
