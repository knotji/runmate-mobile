import { describe, expect, it } from 'vitest';
import { hasBodyRecompositionGoal, selectStrengthDayIndexes } from './plan-policy';

describe('selectStrengthDayIndexes', () => {
  // The acceptance scenario the user specified: primaryGoal=running_consistency,
  // secondaryGoals=[six_pack], sufficient recovery, 5 planned training days (so
  // 2 off-days remain), no strength session yet this week -> an eligible
  // off-day is allocated to strength/core rather than left Rest/Recovery.
  it('allocates an eligible off-day to strength when a body-recomposition goal is active and recovery is sufficient', () => {
    const offIndexes = [3, 6]; // 2 off-days out of 7, from a 5-day-per-week plan
    const result = selectStrengthDayIndexes(offIndexes, { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false });
    expect(result.length).toBeGreaterThan(0);
    expect(result).toEqual(expect.arrayContaining([3]));
  });

  it('prefers up to 2 strength/core opportunities per week when a body-recomposition goal is active, not just 1', () => {
    const result = selectStrengthDayIndexes([3, 6], { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false });
    expect(result).toEqual([3, 6]);
  });

  it('without a body-recomposition goal, still keeps the existing single-slot behavior', () => {
    const result = selectStrengthDayIndexes([3, 6], { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: false, strengthAlreadyThisWeek: false });
    expect(result).toEqual([3]);
  });

  it('never allocates strength during Race Week, even with a body-recomposition goal active', () => {
    expect(selectStrengthDayIndexes([3, 6], { safeOnly: false, daysLeft: 5, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false })).toEqual([]);
  });

  it('never allocates strength when Recovery/pain/illness caps the week to safe-only training', () => {
    expect(selectStrengthDayIndexes([3, 6], { safeOnly: true, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false })).toEqual([]);
  });

  it('does not stack another strength session when one is already committed this week', () => {
    expect(selectStrengthDayIndexes([3, 6], { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: true })).toEqual([]);
  });

  it('returns nothing when there are no off-days to allocate (a full running week)', () => {
    expect(selectStrengthDayIndexes([], { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false })).toEqual([]);
  });

  it('never touches a primary-goal running day - offIndexes is the only input, so a run day can never appear in the result', () => {
    const runIndexes = [0, 1, 2, 4, 5];
    const offIndexes = [3, 6];
    const result = selectStrengthDayIndexes(offIndexes, { safeOnly: false, daysLeft: 30, bodyRecompositionGoalActive: true, strengthAlreadyThisWeek: false });
    expect(result.some((index) => runIndexes.includes(index))).toBe(false);
  });
});

describe('hasBodyRecompositionGoal', () => {
  it('is true for a primary body-recomposition goal', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'six_pack', secondaryGoals: [] })).toBe(true);
  });

  it('is true for a secondary body-recomposition goal', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'] })).toBe(true);
  });

  it('is false when no body-recomposition goal is present', () => {
    expect(hasBodyRecompositionGoal({ primaryGoal: 'running_consistency', secondaryGoals: ['sleep_better'] })).toBe(false);
  });

  it('is false for null/malformed input instead of throwing', () => {
    expect(hasBodyRecompositionGoal(null)).toBe(false);
    expect(hasBodyRecompositionGoal('six_pack')).toBe(false);
    expect(hasBodyRecompositionGoal({ secondaryGoals: 'six_pack' })).toBe(false);
  });
});
