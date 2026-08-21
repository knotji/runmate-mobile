import { describe, expect, it } from 'vitest';
import { applyStrengthPreference, eligibleStrengthDayIndexes, hasBodyRecompositionGoal, selectStrengthDayIndexes } from './plan-policy';

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

describe('eligibleStrengthDayIndexes', () => {
  it('picks Rest/Recovery/Easy days that are not adjacent to a hard session', () => {
    const plan = [
      { workoutType: 'Easy Run' }, // 0 - eligible
      { workoutType: 'Rest' }, // 1 - adjacent to hard (index 2)
      { workoutType: 'Tempo Run' }, // 2 - hard, not soft
      { workoutType: 'Recovery' }, // 3 - adjacent to hard (index 2)
      { workoutType: 'Easy Run' }, // 4 - eligible
      { workoutType: 'Rest' }, // 5 - eligible
      { workoutType: 'Long Run' }, // 6 - not soft
    ];
    expect(eligibleStrengthDayIndexes(plan)).toEqual([0, 4, 5]);
  });
});

describe('applyStrengthPreference (real-world regression: AI-generated plan with zero Strength Training)', () => {
  const buildStrengthDay = (item: { day: string; workoutType: string }) => ({ ...item, workoutType: 'Strength Training' });

  it('injects Strength Training onto an AI-generated plan that omitted it entirely, when a body-recomposition goal is active', () => {
    // Mirrors the real bug report: Gemini returned a full week with no
    // Strength Training even though the user's secondary goal is six_pack.
    const geminiPlan = [
      { day: 'Sunday', workoutType: 'Recovery' },
      { day: 'Monday', workoutType: 'Rest' },
      { day: 'Tuesday', workoutType: 'Easy Run' },
      { day: 'Wednesday', workoutType: 'Tempo Run' },
      { day: 'Thursday', workoutType: 'Easy Run' },
      { day: 'Friday', workoutType: 'Recovery' },
      { day: 'Saturday', workoutType: 'Rest' },
    ];
    const result = applyStrengthPreference(geminiPlan, { primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'] }, { safeOnly: false, daysLeft: 30 }, buildStrengthDay);
    expect(result.filter((item) => item.workoutType === 'Strength Training').length).toBe(2);
    // Never touches the Tempo Run or the days immediately beside it (Tuesday/Thursday).
    expect(result[3].workoutType).toBe('Tempo Run');
    expect(result[2].workoutType).not.toBe('Strength Training');
    expect(result[4].workoutType).not.toBe('Strength Training');
  });

  it('does nothing when no body-recomposition goal is active', () => {
    const plan = [{ day: 'Sunday', workoutType: 'Rest' }, { day: 'Monday', workoutType: 'Rest' }];
    const result = applyStrengthPreference(plan, { primaryGoal: 'running_consistency', secondaryGoals: [] }, { safeOnly: false, daysLeft: 30 }, buildStrengthDay);
    expect(result).toEqual(plan);
  });

  it('does not duplicate or override when the AI plan already includes a Strength Training session', () => {
    const plan = [{ day: 'Sunday', workoutType: 'Strength Training' }, { day: 'Monday', workoutType: 'Rest' }];
    const result = applyStrengthPreference(plan, { primaryGoal: 'six_pack', secondaryGoals: [] }, { safeOnly: false, daysLeft: 30 }, buildStrengthDay);
    expect(result).toEqual(plan);
    expect(result.filter((item) => item.workoutType === 'Strength Training').length).toBe(1);
  });

  it('never injects during Race Week, even with the goal active and eligible days present', () => {
    const plan = [{ day: 'Sunday', workoutType: 'Rest' }, { day: 'Monday', workoutType: 'Rest' }];
    const result = applyStrengthPreference(plan, { primaryGoal: 'six_pack', secondaryGoals: [] }, { safeOnly: false, daysLeft: 5 }, buildStrengthDay);
    expect(result).toEqual(plan);
  });

  it('never injects when the week is safety-capped (pain/illness/low Recovery)', () => {
    const plan = [{ day: 'Sunday', workoutType: 'Rest' }, { day: 'Monday', workoutType: 'Rest' }];
    const result = applyStrengthPreference(plan, { primaryGoal: 'six_pack', secondaryGoals: [] }, { safeOnly: true, daysLeft: 30 }, buildStrengthDay);
    expect(result).toEqual(plan);
  });

  it('never touches a run day even when every other day is somehow ineligible', () => {
    const plan = [{ day: 'Sunday', workoutType: 'Long Run' }, { day: 'Monday', workoutType: 'Tempo Run' }];
    const result = applyStrengthPreference(plan, { primaryGoal: 'six_pack', secondaryGoals: [] }, { safeOnly: false, daysLeft: 30 }, buildStrengthDay);
    expect(result).toEqual(plan);
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
