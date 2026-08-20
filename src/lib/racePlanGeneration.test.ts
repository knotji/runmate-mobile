import { describe, expect, it } from 'vitest';
import { buildRacePlanGenerationContext } from '@/lib/racePlanGeneration';
import type { CoachContext } from '@/lib/buildCoachContext';

describe('buildRacePlanGenerationContext', () => {
  it('keeps daily workout facts and the committed week for a dynamic refresh', () => {
    const context = {
      todayDate: '2026-08-05',
      recoverySystem: { overallScore: 72, scoreState: 'good' },
      totalRunKm: 18,
      longestRun7dKm: 10,
      activePain: false,
      activeSick: false,
      workouts7d: [
        { date: '2026-08-05', runs: [{ km: 5, durationMin: 32, avgHR: 145, pace: '6:24/km' }], walks: [], other: [] },
        { date: '2026-08-03', runs: [], walks: [], other: [{ label: 'Strength', durationMin: 30 }] },
      ],
      racePlan: { weeklyPlan: [{ day: 'Thursday', workoutType: 'Tempo Run', distanceKm: 7 }] },
    } as unknown as CoachContext;

    const result = buildRacePlanGenerationContext(context);

    expect(result.completedWorkoutDates).toEqual(['2026-08-05', '2026-08-03']);
    expect(result.recentWorkouts).toEqual(context.workouts7d);
    expect(result.currentWeeklyPlan).toEqual([{ day: 'Thursday', workoutType: 'Tempo Run', distanceKm: 7 }]);
    expect(result.goalProfile).toBeNull();
  });

  it('extracts the goal profile from the raw Supabase profile row when present', () => {
    const context = {
      todayDate: '2026-08-05',
      recoverySystem: { overallScore: 72, scoreState: 'good' },
      totalRunKm: 18,
      longestRun7dKm: 10,
      activePain: false,
      activeSick: false,
      workouts7d: [],
      racePlan: {},
      profile: { goal_profile: { primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] } },
    } as unknown as CoachContext;

    const result = buildRacePlanGenerationContext(context);

    expect(result.goalProfile).toEqual({ primaryGoal: 'running_consistency', secondaryGoals: ['six_pack'], guardrailGoals: [] });
  });
});
