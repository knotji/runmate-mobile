import { describe, expect, it } from 'vitest';
import { mergeRefreshedRacePlan, mergeRefreshedRacePlanWithOptions, reconcileRacePlanSnapshots } from './racePlanRefresh';
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

  it('applies the rolling schedule to the actual current training week, not generated week one', () => {
    const currentWeek = { weekNumber: 3, phase: 'Build', weeklyFocus: '', targetWeeklyDistanceKm: 12, longRunDistanceKm: 7, workouts: [workout('Wednesday', 'Recovery', null), workout('Thursday', 'Tempo Run', 7)] };
    const previous = plan(currentWeek.workouts, { planStartDate: '2026-07-12', weeks: [currentWeek] });
    const generated = plan([workout('Wednesday', 'Easy Run', 4), workout('Thursday', 'Rest', null)]);

    const result = mergeRefreshedRacePlanWithOptions(previous, generated, '2026-07-29', { dynamicUpcoming: true });

    expect(result.weeks.find((week) => week.weekNumber === 3)?.workouts.map(({ workoutType }) => workoutType))
      .toEqual(['Easy Run', 'Rest']);
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
