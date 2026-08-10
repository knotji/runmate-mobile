import { describe, expect, it } from 'vitest';
import { buildMobileRaceSummary, formatRaceWorkoutMetric, isRaceWorkoutToday } from './mobileRaceGoal';
import type { RaceGoal, RacePlan } from '@/types/race';

const goal: RaceGoal = {
  raceName: 'Bangkok 10K',
  raceDate: '2026-08-16',
  raceDistance: '10K',
  goalType: 'target_time',
  targetTime: '00:50:00',
};

const plan: RacePlan = {
  raceCountdownText: '', totalWeeks: 8, currentPhase: 'Build', planSummary: '', phases: [], weeks: [], safetyNotes: '',
  weeklyPlan: [
    { day: 'Monday', workoutType: 'Easy Run', distanceKm: 5, durationMin: null, targetPace: '6:00/km', targetHR: null, description: '' },
    { day: 'Tuesday', workoutType: 'Rest', distanceKm: null, durationMin: null, targetPace: null, targetHR: null, description: '' },
    { day: 'Wednesday', workoutType: 'Tempo Run', distanceKm: 7.5, durationMin: null, targetPace: '5:10/km', targetHR: null, description: '' },
  ],
};

describe('buildMobileRaceSummary', () => {
  it('builds countdown, progress, target pace, and active weekly totals', () => {
    expect(buildMobileRaceSummary(goal, plan, '2026-07-19')).toMatchObject({
      daysRemaining: 28,
      weeksRemaining: 4,
      currentWeek: 5,
      totalWeeks: 8,
      phase: 'Build',
      targetPace: '5:00/km',
      scheduledSessions: 2,
      scheduledDistanceKm: 12.5,
    });
  });

  it('formats only available workout metrics', () => {
    expect(formatRaceWorkoutMetric(plan.weeklyPlan![0])).toBe('5 km · 6:00/km');
  });

  it('matches today from English, Thai, or an explicit plan date', () => {
    expect(isRaceWorkoutToday({ ...plan.weeklyPlan![0], day: 'Sunday' }, '2026-07-19')).toBe(true);
    expect(isRaceWorkoutToday({ ...plan.weeklyPlan![0], day: 'วันอาทิตย์' }, '2026-07-19')).toBe(true);
    expect(isRaceWorkoutToday({ ...plan.weeklyPlan![0], day: 'Monday', date: '2026-07-19' } as never, '2026-07-19')).toBe(true);
    expect(isRaceWorkoutToday({ ...plan.weeklyPlan![0], day: 'Monday' }, '2026-07-19')).toBe(false);
  });

  it('uses human-friendly labels for rest and recovery sessions', () => {
    expect(formatRaceWorkoutMetric({ ...plan.weeklyPlan![1], distanceKm: 0, durationMin: 0, targetPace: 'N/A' })).toBe('Rest Day');
    expect(formatRaceWorkoutMetric({ ...plan.weeklyPlan![1], workoutType: 'Recovery', distanceKm: 0, durationMin: 30, targetPace: 'N/A' })).toBe('30 min · Easy Recovery');
  });

  it('orders the final week from today and replaces a generic run with Race Day', () => {
    const finalWeek = { ...plan, currentPhase: 'Race Week', weeklyPlan: [
      { ...plan.weeklyPlan![1], day: 'Monday' },
      { ...plan.weeklyPlan![0], day: 'Tuesday', workoutType: 'Recovery', distanceKm: null },
      { ...plan.weeklyPlan![0], day: 'Wednesday', workoutType: 'Intervals', distanceKm: 6 },
      { ...plan.weeklyPlan![1], day: 'Thursday' },
      { ...plan.weeklyPlan![0], day: 'Friday', distanceKm: 8 },
      { ...plan.weeklyPlan![1], day: 'Saturday' },
      { ...plan.weeklyPlan![0], day: 'Sunday', distanceKm: 6 },
    ] };
    const result = buildMobileRaceSummary(goal, finalWeek, '2026-08-10');
    expect(result.workouts.map((item) => item.workoutType)).toEqual(['Rest', 'Recovery', 'Race Primer', 'Rest', 'Shakeout Run', 'Rest', 'Race Day']);
    expect(result.scheduledDistanceKm).toBe(17);
  });
});
