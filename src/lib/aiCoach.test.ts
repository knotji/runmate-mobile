import { describe, expect, it } from 'vitest';
import { buildAiCoachContext } from '@/lib/aiCoach';
import type { CoachContext } from '@/lib/buildCoachContext';

describe('buildAiCoachContext', () => {
  it('sends compact coaching facts without raw records or account fields', () => {
    const source = {
      todayDate: '2026-07-20',
      profile: { email: 'private@example.com', secretNote: 'do not send' },
      raceGoal: null,
      racePlan: null,
      activeRaceGoal: null,
      activeRaceStatus: 'none',
      raceName: null,
      raceDate: null,
      raceDistance: null,
      daysUntilRace: null,
      targetTime: null,
      todayWorkouts: [],
      totalSessions: 3,
      totalRunKm: 12.34,
      runDays7d: 2,
      longestRun7dKm: 7,
      lastWorkoutDate: '2026-07-19',
      nutritionToday: { mealCount: 2, caloriesKcal: 1200, proteinG: 80, carbsG: 130, fatG: 40 },
      mealsToday: [{ foods: ['Rice', 'Egg'], mealType: 'Lunch' }],
      activePain: false,
      recentMaxPain: null,
      latestPain: null,
      activeSick: false,
      sickRiskLevel: 'low',
      recoverySystem: {
        scoreState: 'scored', overallScore: 72, overallLabel: 'Good',
        dataFreshness: { status: 'today' },
        strain: { score: 4.24, estimated: true },
        sleepPerformance: { state: 'scored', score: 74, actualSleepMinutes: 390, sleepNeedMinutes: 420, sleepDebtMinutes: 30 },
        fuelInsight: { status: 'top_up', summary: 'Add protein.' },
        sourceCoverage: { used: ['Sleep Duration'], missing: ['HRV'] },
      },
    } as unknown as CoachContext;

    const result = buildAiCoachContext(source);
    const serialized = JSON.stringify(result);

    expect(result.recovery.score).toBe(72);
    expect(result.recovery.sleepDuration).toBe('6h 30m');
    expect(result.recovery.sleepNeed).toBe('7h');
    expect(result.recovery.sleepShortfall).toBe('30m');
    expect(result.recentTraining.runDistanceKm7d).toBe(12.3);
    expect(result.nutritionToday?.foods).toEqual(['Rice', 'Egg']);
    expect(result.nutritionToday?.mealLog).toEqual([{ type: 'Lunch', foods: ['Rice', 'Egg'], caloriesKcal: undefined, proteinG: undefined, carbsG: undefined, fatG: undefined }]);
    expect(serialized).not.toContain('private@example.com');
    expect(serialized).not.toContain('secretNote');
    expect(serialized).not.toContain('profile');
  });
});
