import { describe, expect, it } from 'vitest';
import { heavyTrainingDates, mergeRefreshedRacePlan, mergeRefreshedRacePlanWithOptions, reconcileRacePlanSnapshots } from './racePlanRefresh';
import type { RacePlan, WeekWorkout } from '@/types/race';

const workout = (day: string, workoutType: string, distanceKm: number | null, description = ''): WeekWorkout => ({
  day, workoutType, distanceKm, description, targetPace: null, targetHR: null,
});

function plan(weeklyPlan: WeekWorkout[], overrides: Partial<RacePlan> = {}): RacePlan {
  return {
    raceCountdownText: '', totalWeeks: 4, currentPhase: 'Build', planSummary: '', phases: [],
    weeks: [{ weekNumber: 1, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 20, longRunDistanceKm: 8, workouts: weeklyPlan }],
    safetyNotes: '', planStartDate: '2026-07-26', weeklyPlan,
    ...overrides,
  };
}

describe('mergeRefreshedRacePlan', () => {
  it('keeps the whole current-week schedule identity while enriching matching details', () => {
    const previous = plan([
      workout('Sunday', 'Easy Run', 5),
      workout('Monday', 'Recovery', 4),
      workout('Tuesday', 'Rest', null),
      workout('Wednesday', 'Tempo Run', 7, 'Tempo session'),
      workout('Thursday', 'Easy Run', 5),
    ]);
    const generated = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Intervals', 8),
      workout('Tuesday', 'Easy Run', 5),
      { ...workout('Wednesday', 'Tempo Run', 9, '2 km warm-up, 4 km tempo, 1 km cool-down'), targetPace: '5:20–5:30/km', targetHR: 'Zone 3–4' },
      workout('Thursday', 'Intervals', 9),
    ]);

    const result = mergeRefreshedRacePlan(previous, generated, '2026-07-29');

    expect(result.planStartDate).toBe('2026-07-26');
    expect(result.weeklyPlan?.slice(0, 3)).toEqual(previous.weeklyPlan?.slice(0, 3));
    expect(result.weeklyPlan?.[3]).toMatchObject({
      workoutType: 'Tempo Run',
      distanceKm: 7,
      description: '2 km warm-up, 4 km tempo, 1 km cool-down',
      targetPace: '5:20–5:30/km',
    });
    expect(result.weeklyPlan?.[4]).toMatchObject({ workoutType: 'Easy Run', distanceKm: 5 });
  });

  it('preserves completed historical weeks and replaces future weeks', () => {
    const oldWeek = { weekNumber: 1, phase: 'Base', weeklyFocus: '', targetWeeklyDistanceKm: 10, longRunDistanceKm: 5, workouts: [workout('Sunday', 'Easy Run', 5)] };
    const futureOld = { ...oldWeek, weekNumber: 3, workouts: [workout('Sunday', 'Easy Run', 6)] };
    const generatedPast = { ...oldWeek, workouts: [workout('Sunday', 'Intervals', 8)] };
    const generatedFuture = { ...futureOld, workouts: [workout('Sunday', 'Long Run', 12)] };
    const previous = plan([], { weeks: [oldWeek, futureOld] });
    const generated = plan([], { weeks: [generatedPast, generatedFuture] });

    const result = mergeRefreshedRacePlan(previous, generated, '2026-08-05');

    expect(result.weeks.find((week) => week.weekNumber === 1)).toEqual(oldWeek);
    expect(result.weeks.find((week) => week.weekNumber === 3)).toEqual(generatedFuture);
  });

  it('locks past days and dynamically replaces only upcoming days', () => {
    const previous = plan([
      workout('Sunday', 'Long Run', 10),
      workout('Monday', 'Rest', null),
      workout('Tuesday', 'Intervals', 7),
      workout('Wednesday', 'Recovery', null),
      workout('Thursday', 'Tempo Run', 7),
      workout('Friday', 'Easy Run', 5),
      workout('Saturday', 'Rest', null),
    ]);
    const generated = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Easy Run', 5),
      workout('Tuesday', 'Tempo Run', 6),
      workout('Wednesday', 'Easy Run', 4),
      workout('Thursday', 'Rest', null),
      workout('Friday', 'Long Run', 11),
      workout('Saturday', 'Recovery', null),
    ]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-07-29', {
      dynamicUpcoming: true,
      completedWorkoutDates: ['2026-07-28'],
    });

    expect(result.weeklyPlan?.map(({ workoutType }) => workoutType)).toEqual([
      'Long Run', 'Rest', 'Intervals', 'Easy Run', 'Rest', 'Long Run', 'Recovery',
    ]);
    expect(result.planStartDate).toBe(previous.planStartDate);
  });

  it('locks today when a workout was already recorded', () => {
    const previous = plan([workout('Wednesday', 'Recovery', null), workout('Thursday', 'Tempo Run', 7)]);
    const generated = plan([workout('Wednesday', 'Easy Run', 5), workout('Thursday', 'Rest', null)]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-07-29', {
      dynamicUpcoming: true,
      completedWorkoutDates: ['2026-07-29'],
    });

    expect(result.weeklyPlan?.[0].workoutType).toBe('Recovery');
    expect(result.weeklyPlan?.[1].workoutType).toBe('Rest');
  });

  it('always applies a freshly generated Race Day even when that date is locked as already completed', () => {
    // Reproduces a real-device bug: the runner logged an unrelated workout on the
    // actual race date, which locked that date under dynamicUpcoming, and the merge
    // then discarded the newly generated "Race Day" entry in favor of the stale
    // committed "Easy Run" — even though the generator (enforceRaceWeek) already
    // produced the correct Race Day workout for that date.
    const previous = plan([workout('Sunday', 'Easy Run', 6)]);
    const generated = plan([workout('Sunday', 'Race Day', 10, 'ASICS META Time Trials · 10K')]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-16', {
      dynamicUpcoming: true,
      completedWorkoutDates: ['2026-08-16'],
    });

    expect(result.weeklyPlan?.[0]).toMatchObject({ workoutType: 'Race Day', distanceKm: 10 });
  });

  it('guarantees a Strength Training slot on the one genuinely open day when a body-recomposition goal is active (real regression: mid-week refresh with most days already completed/locked)', () => {
    // Reproduces a real report: user had six_pack set, hit Refresh Plan on a
    // Friday with Sun-Fri already completed (locked) and the server's fresh
    // plan came back with zero Strength Training anywhere - the guarantee
    // must still land on the one day that's actually still open (Saturday).
    const previous = plan([
      workout('Sunday', 'Recovery', null),
      workout('Monday', 'Rest', null),
      workout('Tuesday', 'Easy Run', 6),
      workout('Wednesday', 'Tempo Run', 5),
      workout('Thursday', 'Easy Run', 5),
      workout('Friday', 'Recovery', null),
      workout('Saturday', 'Rest', null),
    ], { planStartDate: '2026-08-16' });
    const generated = plan([
      workout('Sunday', 'Recovery', null),
      workout('Monday', 'Rest', null),
      workout('Tuesday', 'Easy Run', 6),
      workout('Wednesday', 'Tempo Run', 5),
      workout('Thursday', 'Easy Run', 5),
      workout('Friday', 'Recovery', null),
      workout('Saturday', 'Rest', null),
    ]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-21', {
      dynamicUpcoming: true,
      completedWorkoutDates: ['2026-08-21'],
      goalProfile: { primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] },
    });

    expect(result.weeklyPlan?.map(({ workoutType }) => workoutType)).toEqual([
      'Recovery', 'Rest', 'Easy Run', 'Tempo Run', 'Easy Run', 'Recovery', 'Strength Training',
    ]);
  });

  it('does not inject Strength Training onto a locked day, even if it would otherwise be eligible', () => {
    const previous = plan([workout('Sunday', 'Rest', null), workout('Monday', 'Rest', null)], { planStartDate: '2026-08-16' });
    const generated = plan([workout('Sunday', 'Rest', null), workout('Monday', 'Rest', null)]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-21', {
      dynamicUpcoming: true,
      completedWorkoutDates: [],
      goalProfile: { primaryGoal: 'six_pack', secondaryGoals: [], guardrailGoals: [] },
    });

    // Both Sunday and Monday are before today (2026-08-21), so both are locked -
    // there is no open day to claim, and the plan must stay exactly as-is.
    expect(result.weeklyPlan?.map(({ workoutType }) => workoutType)).toEqual(['Rest', 'Rest']);
  });

  it('does nothing without a body-recomposition goal', () => {
    const previous = plan([workout('Saturday', 'Rest', null)], { planStartDate: '2026-08-16' });
    const generated = plan([workout('Saturday', 'Rest', null)]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-21', {
      dynamicUpcoming: true,
      completedWorkoutDates: [],
      goalProfile: { primaryGoal: 'running_consistency', secondaryGoals: [], guardrailGoals: [] },
    });

    expect(result.weeklyPlan?.[0].workoutType).toBe('Rest');
  });

  it('does not claim a day next to actually-heavy training, even when that day was only planned as Easy Run', () => {
    // The neighbor's plan says "Easy Run" (soft), but the runner actually
    // logged a heavy session there - the real load must still block it,
    // matching generate-race-plan's own recentHeavyDay guardrail.
    const previous = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Easy Run', 5),
      workout('Tuesday', 'Rest', null),
    ], { planStartDate: '2026-08-16' });
    const generated = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Easy Run', 5),
      workout('Tuesday', 'Rest', null),
    ]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-16', {
      dynamicUpcoming: true,
      completedWorkoutDates: [],
      goalProfile: { primaryGoal: 'six_pack', secondaryGoals: [], guardrailGoals: [] },
      heavyTrainingDates: new Set(['2026-08-17']), // Monday actually ran long/hard
    });

    // Sunday (before the heavy Monday) and Tuesday (after it) are both
    // adjacent to the actually-heavy day, so neither can take Strength
    // Training - the plan must stay exactly as generated.
    expect(result.weeklyPlan?.map(({ workoutType }) => workoutType)).toEqual(['Rest', 'Easy Run', 'Rest']);
  });

  it('still claims a day whose neighbor was actually light, even though a later day in the week was heavy', () => {
    const previous = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Easy Run', 5),
      workout('Tuesday', 'Rest', null),
    ], { planStartDate: '2026-08-16' });
    const generated = plan([
      workout('Sunday', 'Rest', null),
      workout('Monday', 'Easy Run', 5),
      workout('Tuesday', 'Rest', null),
    ]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-08-16', {
      dynamicUpcoming: true,
      completedWorkoutDates: [],
      goalProfile: { primaryGoal: 'six_pack', secondaryGoals: [], guardrailGoals: [] },
      heavyTrainingDates: new Set(['2026-08-20']), // Thursday, unrelated to this window
    });

    expect(result.weeklyPlan?.[0].workoutType).toBe('Strength Training');
  });

  it('applies the rolling schedule to the actual current training week, not generated week one', () => {
    const currentWeek = { weekNumber: 3, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 12, longRunDistanceKm: 7, workouts: [workout('Wednesday', 'Recovery', null), workout('Thursday', 'Tempo Run', 7)] };
    const previous = plan(currentWeek.workouts, { planStartDate: '2026-07-12', weeks: [currentWeek] });
    const generated = plan([workout('Wednesday', 'Easy Run', 4), workout('Thursday', 'Rest', null)]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-07-29', { dynamicUpcoming: true });

    expect(result.weeks.find((week) => week.weekNumber === 3)?.workouts.map(({ workoutType }) => workoutType))
      .toEqual(['Easy Run', 'Rest']);
  });
});

describe('heavyTrainingDates', () => {
  it('flags a day with 8km+ of actual running as heavy', () => {
    const result = heavyTrainingDates([{ date: '2026-08-17', runs: [{ km: 8.2, durationMin: 45 }] }]);
    expect(result.has('2026-08-17')).toBe(true);
  });

  it('flags a day with 60+ total minutes across runs/walks/other as heavy, even with low distance', () => {
    const result = heavyTrainingDates([{
      date: '2026-08-17',
      runs: [{ km: 3, durationMin: 25 }],
      walks: [{ durationMin: 20 }],
      other: [{ durationMin: 20 }],
    }]);
    expect(result.has('2026-08-17')).toBe(true);
  });

  it('does not flag a genuinely easy/short day', () => {
    const result = heavyTrainingDates([{ date: '2026-08-17', runs: [{ km: 4, durationMin: 25 }] }]);
    expect(result.has('2026-08-17')).toBe(false);
  });
});

describe('reconcileRacePlanSnapshots', () => {
  it('restores the snapshot immediately before a broken timeline reset', () => {
    const original = plan([
      workout('Sun', 'Easy Run', 5),
      workout('Mon', 'Recovery', 0),
      workout('Tue', 'Tempo Run', 7),
      workout('Wed', 'Recovery', 0),
      workout('Thu', 'Easy Run', 6),
    ], { createdAt: '2026-07-20T08:00:00.000Z' });
    const followed = plan([
      workout('Sun', 'Long Run', 10),
      workout('Mon', 'Rest', 0),
      workout('Tue', 'Intervals', 7),
      workout('Wed', 'Recovery', 4),
      workout('Thu', 'Easy Run', 6),
    ], { createdAt: '2026-07-28T08:00:00.000Z' });
    const brokenFirst = plan([
      workout('Sun', 'Rest', 0),
      workout('Mon', 'Intervals', 8),
      workout('Tue', 'Rest', 0),
      workout('Wed', 'Easy Run', 6),
      workout('Thu', 'Tempo Run', 8),
    ], { planStartDate: '2026-07-29', createdAt: '2026-07-29T01:00:00.000Z' });
    const brokenLatest = plan([
      workout('Sun', 'Long Run', 12),
      workout('Mon', 'Rest', 0),
      workout('Tue', 'Easy Run', 6),
      workout('Wed', 'Intervals', 8),
      workout('Thu', 'Long Run', 10),
    ], { planStartDate: '2026-07-29', createdAt: '2026-07-29T02:00:00.000Z' });

    const result = reconcileRacePlanSnapshots([brokenLatest, brokenFirst, followed, original], '2026-07-30');

    expect(result?.planStartDate).toBe('2026-07-26');
    expect(result?.weeklyPlan?.slice(0, 4).map(({ workoutType }) => workoutType))
      .toEqual(['Long Run', 'Rest', 'Intervals', 'Recovery']);
    expect(result?.weeklyPlan?.[4].workoutType).toBe('Easy Run');
  });

  it('does not mistake legitimate same-timeline revisions for the reset boundary', () => {
    const initial = plan([workout('Monday', 'Tempo Run', 6)], {
      planStartDate: '2026-07-01',
      createdAt: '2026-07-01T09:00:00.000Z',
    });
    const oldest = plan([workout('Monday', 'Recovery', 4)], {
      planStartDate: '2026-07-19',
      createdAt: '2026-07-19T02:00:00.000Z',
    });
    const followed = plan([workout('Monday', 'Rest', 0)], {
      planStartDate: '2026-07-26',
      createdAt: '2026-07-28T01:00:00.000Z',
    });
    const brokenLatest = plan([workout('Monday', 'Easy Run', 5)], {
      planStartDate: '2026-07-29',
      createdAt: '2026-07-29T02:00:00.000Z',
    });

    const result = reconcileRacePlanSnapshots([brokenLatest, followed, oldest, initial], '2026-07-30');

    expect(result?.weeklyPlan?.[0].workoutType).toBe('Rest');
  });
});
