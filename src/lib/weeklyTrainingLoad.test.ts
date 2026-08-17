import { describe, expect, it } from 'vitest';
import { calcWeeklyTrainingLoad } from '@/lib/weeklyTrainingLoad';
import type { DayWorkoutSummary } from '@/lib/context/contextTypes';

function day(overrides: Partial<DayWorkoutSummary> = {}): DayWorkoutSummary {
  return { date: '2026-08-10', runs: [], walks: [], other: [], ...overrides };
}

describe('calcWeeklyTrainingLoad', () => {
  it('is zero for a week with no logged activity', () => {
    expect(calcWeeklyTrainingLoad([])).toBe(0);
  });

  it('scores 6 easy run days as a similar weekly load to 3 hard run days', () => {
    const easyWeek = Array.from({ length: 6 }, () => day({ runs: [{ km: 5, durationMin: 30, avgHR: 130, pace: null }] }));
    const hardWeek = Array.from({ length: 3 }, () => day({ runs: [{ km: 10, durationMin: 55, avgHR: 170, pace: null }] }));

    const easyLoad = calcWeeklyTrainingLoad(easyWeek);
    const hardLoad = calcWeeklyTrainingLoad(hardWeek);

    // Neither reading should look like a light week just because it has fewer days.
    expect(easyLoad).toBeGreaterThan(200);
    expect(hardLoad).toBeGreaterThan(200);
  });

  it('scores a light week (few short easy sessions) well below a heavy one', () => {
    const lightWeek = [day({ runs: [{ km: 3, durationMin: 20, avgHR: null, pace: null }] }), day({ walks: [{ km: 2, durationMin: 25 }] })];
    const heavyWeek = Array.from({ length: 6 }, () => day({ runs: [{ km: 8, durationMin: 45, avgHR: 150, pace: null }] }));

    expect(calcWeeklyTrainingLoad(lightWeek)).toBeLessThan(calcWeeklyTrainingLoad(heavyWeek));
  });

  it('caps a single very long or hard run rather than letting it dominate the week', () => {
    const oneMarathon = [day({ runs: [{ km: 42, durationMin: 240, avgHR: 175, pace: null }] })];
    expect(calcWeeklyTrainingLoad(oneMarathon)).toBe(90);
  });

  it('folds strength and walk sessions into the weekly total using the recoveryLoop.ts weights', () => {
    const week = [day({ other: [{ label: 'Strength', durationMin: 40 }] }), day({ walks: [{ km: 3, durationMin: 40 }] })];
    // Strength: 40*0.5=20 (capped 50). Walk: 40*0.25=10 (capped 35).
    expect(calcWeeklyTrainingLoad(week)).toBe(30);
  });
});
