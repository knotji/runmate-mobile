import { describe, expect, it } from 'vitest';
import type { Workout } from '@capgo/capacitor-health';
import { selectLatestRunningWorkout } from './exerciseRoute';

function workout(workoutType: Workout['workoutType'], startDate: string, platformId?: string): Workout {
  return {
    workoutType,
    duration: 1800,
    startDate,
    endDate: new Date(Date.parse(startDate) + 1_800_000).toISOString(),
    platformId,
  };
}

describe('selectLatestRunningWorkout', () => {
  it('finds the latest run after querying mixed workout types', () => {
    const result = selectLatestRunningWorkout([
      workout('cycling', '2026-07-26T01:00:00.000Z', 'cycle'),
      workout('running', '2026-07-24T01:00:00.000Z', 'older-run'),
      workout('trackAndField', '2026-07-25T01:00:00.000Z', 'latest-run'),
    ]);

    expect(result?.platformId).toBe('latest-run');
  });

  it('ignores run records that cannot be used for a native route read', () => {
    expect(selectLatestRunningWorkout([
      workout('running', '2026-07-26T01:00:00.000Z'),
      workout('walking', '2026-07-25T01:00:00.000Z', 'walk'),
    ])).toBeUndefined();
  });
});
