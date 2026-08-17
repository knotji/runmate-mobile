import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildCoachContextFromData } from '@/lib/context/buildCoachContextCore';
import type { LocalHistoryItem } from '@/lib/localHistory';
import type { RaceResult } from '@/types/race';

const TODAY = '2026-08-16';

function workoutItem(overrides: Partial<LocalHistoryItem> = {}): LocalHistoryItem {
  return {
    id: 'workout-1',
    type: 'workout',
    dateKey: TODAY,
    createdAt: `${TODAY}T10:00:00+07:00`,
    data: {
      extracted: { workoutKind: 'outdoor_run', workoutName: 'Outdoor Run', date: TODAY, distanceKm: 10.2, duration: '54:51', avgHR: 177 },
      coach: {}, confidence: 'high', unclearFields: [],
    },
    ...overrides,
  };
}

function raceResult(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    raceGoalId: 'goal-1',
    linkedHistoryItemId: 'workout-1',
    raceName: 'ASICS : META : Time : Trials Thailand 2026',
    raceDate: TODAY,
    raceDistance: '10K',
    goalType: 'finish',
    targetTime: '55:00',
    actualDistanceKm: 10.2,
    actualTime: '54:51',
    actualPace: '5:24',
    avgHr: 177,
    maxHr: null,
    cadence: null,
    calories: null,
    elevationM: null,
    resultStatus: 'completed',
    goalResult: 'completed',
    coachSummary: null,
    reflection: null,
    rawWorkoutData: null,
    ...overrides,
  };
}

describe('buildCoachContextFromData — race result / todayWorkouts double counting', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00+07:00`));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('does not double-count a race result that is linked to a workout already logged today', () => {
    const context = buildCoachContextFromData({
      items: [workoutItem()],
      profile: null, raceGoal: null, racePlan: null,
      raceResults: [raceResult()],
    });
    expect(context.todayWorkouts).toHaveLength(1);
    expect(context.todayWorkouts[0].label).toBe('Outdoor Run');
  });

  it('still adds a race result as its own entry when it is not linked to an already-logged workout', () => {
    const context = buildCoachContextFromData({
      items: [workoutItem()],
      profile: null, raceGoal: null, racePlan: null,
      raceResults: [raceResult({ linkedHistoryItemId: null })],
    });
    expect(context.todayWorkouts).toHaveLength(2);
    expect(context.todayWorkouts.map((w) => w.label)).toContain('Race ASICS : META : Time : Trials Thailand 2026');
  });
});

describe('buildCoachContextFromData — weeklyTrainingLoad7d', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00+07:00`));
  });
  afterEach(() => { vi.useRealTimers(); });

  it('is zero with no workouts in the last 7 days', () => {
    const context = buildCoachContextFromData({ items: [], profile: null, raceGoal: null, racePlan: null });
    expect(context.weeklyTrainingLoad7d).toBe(0);
  });

  it('reflects a hard run more heavily than a plain day count would', () => {
    const context = buildCoachContextFromData({ items: [workoutItem()], profile: null, raceGoal: null, racePlan: null });
    // One 10.2 km run at a high average HR should already sit near the per-day
    // cap used by recoveryLoop.ts's calcDayLoad(), not a token nonzero amount.
    expect(context.weeklyTrainingLoad7d).toBeGreaterThanOrEqual(80);
  });
});
