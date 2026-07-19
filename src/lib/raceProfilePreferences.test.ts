import { describe, expect, it } from 'vitest';
import { applyProfilePreferencesToRaceGoal } from './raceProfilePreferences';
import type { RaceGoal } from '@/types/race';

const goal: RaceGoal = { raceName: '10K', raceDate: '2026-08-16', raceDistance: '10K', goalType: 'finish', trainingDaysPerWeek: 4, preferredLongRunDay: 'Sunday', currentLongestRunKm: 10 };

describe('Race Profile Preferences', () => {
  it('applies valid latest planning preferences and running baseline', () => {
    expect(applyProfilePreferencesToRaceGoal(goal, { displayName: 'Runner', weeklyTrainingDays: 5, preferredLongRunDay: 'Friday', currentLongestRunKm: 16.2 })).toMatchObject({ trainingDaysPerWeek: 5, preferredLongRunDay: 'Friday', currentLongestRunKm: 16.2 });
  });

  it('preserves the goal snapshot when profile preferences are missing or invalid', () => {
    expect(applyProfilePreferencesToRaceGoal(goal, { displayName: 'Runner', weeklyTrainingDays: 9 })).toEqual(goal);
  });

  it('normalizes a Thai long-run day', () => {
    expect(applyProfilePreferencesToRaceGoal(goal, { displayName: 'Runner', preferredLongRunDay: 'วันเสาร์' }).preferredLongRunDay).toBe('Saturday');
  });
});
