import { describe, expect, it } from 'vitest';
import { alignRaceWeekPlan, raceDayWorkout } from '@/lib/raceWeekAlignment';
import type { RaceGoal, WeekWorkout } from '@/types/race';

const goal: RaceGoal = { raceName: 'ASICS META Time Trials', raceDate: '2026-08-16', raceDistance: '10K', goalType: 'target_time', targetTime: '55:00' };
const workout = (day: string, workoutType: string, distanceKm: number | null): WeekWorkout => ({ day, workoutType, distanceKm, durationMin: null, targetPace: null, targetHR: null, description: workoutType });
const week = [workout('Monday', 'Rest', null), workout('Tuesday', 'Recovery', null), workout('Wednesday', 'Intervals', 6), workout('Thursday', 'Rest', null), workout('Friday', 'Easy Run', 8), workout('Saturday', 'Rest', null), workout('Sunday', 'Easy Run', 6)];

describe('alignRaceWeekPlan', () => {
  it('locks the active goal date as Race Day and matches distance and target pace', () => {
    expect(raceDayWorkout(goal)).toMatchObject({ day: 'Sunday', workoutType: 'Race Day', distanceKm: 10, durationMin: 55, targetPace: '5:30/km' });
  });

  it('turns a mismatched final week into a conservative race-aligned week', () => {
    const result = alignRaceWeekPlan(goal, week, '2026-08-10', '2026-08-10');
    expect(result.map((item) => item.workoutType)).toEqual(['Rest', 'Recovery', 'Race Primer', 'Rest', 'Shakeout Run', 'Rest', 'Race Day']);
    expect(result.find((item) => item.workoutType === 'Race Primer')?.distanceKm).toBe(4);
    expect(result.find((item) => item.workoutType === 'Shakeout Run')?.distanceKm).toBe(3);
  });

  it('never rewrites completed race-week days', () => {
    const result = alignRaceWeekPlan(goal, week, '2026-08-10', '2026-08-12', ['2026-08-12']);
    expect(result.find((item) => item.day === 'Wednesday')?.workoutType).toBe('Intervals');
    expect(result.find((item) => item.day === 'Sunday')?.workoutType).toBe('Race Day');
  });

  it('does nothing outside the seven-day race window', () => {
    expect(alignRaceWeekPlan(goal, week, '2026-08-03', '2026-08-03')).toEqual(week);
  });
});
