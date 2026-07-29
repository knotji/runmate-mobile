import { describe, expect, it } from 'vitest';
import { mergeRefreshedRacePlan, reconcileRacePlanSnapshots } from './racePlanRefresh';
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
});

describe('reconcileRacePlanSnapshots', () => {
  it('uses the latest pre-refresh schedule after several same-day broken refresh snapshots', () => {
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

    const result = reconcileRacePlanSnapshots([brokenLatest, brokenFirst, followed, original], '2026-07-29');

    expect(result?.planStartDate).toBe('2026-07-26');
    expect(result?.weeklyPlan?.slice(0, 4).map(({ workoutType }) => workoutType))
      .toEqual(['Long Run', 'Rest', 'Intervals', 'Recovery']);
    expect(result?.weeklyPlan?.[4].workoutType).toBe('Easy Run');
  });

  it('falls back to the oldest snapshot when all snapshots were created today', () => {
    const oldest = plan([workout('Monday', 'Rest', 0)], { createdAt: '2026-07-29T01:00:00.000Z' });
    const latest = plan([workout('Monday', 'Easy Run', 5)], { createdAt: '2026-07-29T02:00:00.000Z' });

    const result = reconcileRacePlanSnapshots([latest, oldest], '2026-07-29');

    expect(result?.weeklyPlan?.[0].workoutType).toBe('Rest');
  });
});
